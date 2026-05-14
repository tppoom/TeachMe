/**
 * The TeachMe 5-stage course generation pipeline.
 *
 *   1. INTAKE   — parse learner inputs and reference material into a learner
 *                 profile + topic frame.
 *   2. ATLAS    — build a concept graph (nodes + dependency edges + tags).
 *                 Detect prerequisite gaps and material-coverage gaps.
 *   3. SYLLABUS — cluster atlas nodes into chapters with per-subtopic
 *                 teaching plans (formats, code examples, visuals).
 *   4. AUTHOR   — write each chapter (streamed). Per-chapter self-review.
 *   5. VERIFY   — global completeness pass across all chapters.
 *
 * The orchestrator yields PipelineEvents — see `pipeline-types.ts`.
 *
 * Provider parity: every stage uses `extractStructured`, which tries strict
 * JSON first and falls back to a markdown-headings parser. Smaller / local
 * models that struggle with JSON can emit `## field_name` blocks and still
 * make the pipeline succeed.
 */

import { runCompletion, streamCompletion } from './provider'
import {
  extractJson,
  extractStructured,
  isObject,
  asString,
  asStringArray,
  asEnum,
  asNumber,
} from './structured'
import { sanitizeMermaid } from './sanitize-mermaid'
import {
  INSTRUCTOR_PERSONA,
  FORMAT_CATALOGUE,
  VISUALS_DISCIPLINE,
  KNOWLEDGE_COMPLETENESS_GUARD,
  DEPTH_STANDARD,
  SUBTOPIC_FORMATTING_RULES,
  SUBTOPIC_DEPTH_FLOOR,
  CODE_EXAMPLES_REQUIREMENT,
  REFERENCE_INTEGRATION_RULES,
  NO_REFERENCE_BLOCK,
  ANTI_PATTERNS,
  RESTRAINT_MANIFESTO,
} from './teaching'
import type {
  CourseInputs,
  LearnerProfile,
  TopicFrame,
  ReferenceConcept,
  Atlas,
  AtlasNode,
  AtlasNodeKind,
  Syllabus,
  ChapterPlan,
  ChapterType,
  SubtopicPlan,
  CodeExampleDecl,
  CodeExamplePurpose,
  VisualHint,
  PipelineEvent,
  ChapterSnapshot,
  InputMode,
  TopicCategory,
  RequestedStyle,
  MaterialsTreatment,
  DepthPreference,
  ModifyIntent,
  ModifyScope,
} from './pipeline-types'
import type {
  LessonContent,
  LessonSection,
  TeachingFormat,
} from '@/types/lesson'
import type { LessonExample, Visual, Subtopic } from '@/types/lesson'

// ─── MODEL INVOCATION HELPERS ────────────────────────────────────────────

async function collectStream(gen: AsyncGenerator<string>): Promise<string> {
  let out = ''
  for await (const chunk of gen) out += chunk
  return out
}

const runComplete = (system: string, prompt: string, maxOutputTokens = 8000) =>
  runCompletion({ system, prompt, maxOutputTokens })

const runStream = (system: string, prompt: string, maxOutputTokens = 16000) =>
  streamCompletion({ system, prompt, maxOutputTokens })

/**
 * Prepended to every post-Intake stage's system prompt so the requested
 * output language dominates style. JSON keys + enum values stay English;
 * only human-readable strings switch.
 */
function langPreamble(profile: LearnerProfile): string {
  const lang = profile.language?.trim() || 'English'
  if (lang.toLowerCase() === 'english') {
    return `OUTPUT LANGUAGE — ENGLISH.
Write every human-readable string in your output in fluent English.`
  }
  return `OUTPUT LANGUAGE — ${lang}.
CRITICAL: every human-readable string in your output MUST be written in ${lang}.
This includes: titles, hooks, objectives, summaries, prose content, example titles and bodies, common mistake explanations, key points, exercise prompts/hints/solutions, recap text, atlas node names and descriptions, and chapter / subtopic titles.

The following stay in English (do NOT translate them):
  - JSON property names (e.g. "title", "subtopics", "examples")
  - Enum values (e.g. "concept", "skill", "mental_model", "code_example", "diagram", "basic", "realworld")
  - Code: variable names, function names, language keywords, library names, class names, file paths
  - Proper nouns / technical product names with no native equivalent (e.g. "PostgreSQL", "React", "Kubernetes")
  - Section markers like "## Mental model" → translate the heading to ${lang}, but keep the same structural role

Do NOT mix English prose into ${lang} content unless quoting code or naming a product. If a concept has both an English and a native term, use the native term and gloss the English in parentheses on first mention.

`
}

// ════════════════════════════════════════════════════════════════════════
// STAGE 1 — INTAKE
// ════════════════════════════════════════════════════════════════════════

const INTAKE_SYSTEM = `${INSTRUCTOR_PERSONA}

ROLE: Intake analyst. You read what the learner asked for and any reference materials they attached, and you produce two structured artifacts:

  A. LearnerProfile — what the learner brings, what they want, what level to target, and what category the topic falls into.
  B. TopicFrame    — what the topic IS, where it sits in the wider field, and (if reference material was attached) every concept the material mentions, classified by depth.

OUTPUT: ONLY valid JSON. No prose, no markdown fences.

SCHEMA:
{
  "profile": {
    "priorKnowledge": ["specific concept the learner already knows; be precise: 'what a function return value is' not 'basic programming'"],
    "goal": "one-sentence statement of what the learner wants to be able to do (paraphrase their instructions if there's no explicit goal)",
    "audience": "target level: 'absolute beginner' | 'beginner with adjacent experience' | 'intermediate' | 'working professional' | 'expert deepening' — whichever fits",
    "topicCategory": "programming | technical | conceptual | mixed",
    "requestedStyle": "summary | expanded_explanation | exam_prep | beginner_intro | practical_application | structured_course | reference",
    "materialsTreatment": "primary_source | supplementary | expand_beyond | not_applicable",
    "depthPreference": "shallow_overview | standard | deep_dive",
    "specialRequests": ["verbatim or near-verbatim specific asks pulled from the learner's instructions: 'use Python', 'skip basics', 'focus on grad school exam', 'short bullet points', 'include diagrams', etc."],
    "language": "the language the COURSE OUTPUT must be written in. See LANGUAGE DETECTION rules below."
  },
  "frame": {
    "topic": "the topic, restated precisely",
    "framing": "2-3 sentences naming what this topic IS at a high level — the kind of thing you would tell a curious newcomer",
    "context": "1 sentence on the wider field this sits in (parent / sibling areas)",
    "subAreas": ["the 4-8 major sub-areas of the topic"],
    "referenceConcepts": [
      {
        "name": "concept name",
        "excerpt": "verbatim short excerpt or near-verbatim sentence from the reference that introduced it",
        "depth": "shallow_mention | covered | in_depth | implied"
      }
    ],
    "materialsHaveCode": false
  }
}

MATERIALS-HAVE-CODE: Set "frame.materialsHaveCode" to TRUE only if the uploaded reference materials actually contain code (function definitions, statements, snippets in fenced blocks, REPL output, shell commands, config files). Set FALSE otherwise. If no materials are attached at all, set FALSE. The pipeline uses this to decide whether to add code examples to the course — DO NOT mark it true just because the topic involves programming.

TOPIC CATEGORY:
  - "programming" : a programming language, framework, library, dev tool, database, API. Code examples will dominate.
  - "technical"   : non-programming engineering / science (math, ML theory, networking, systems). Diagrams and worked examples dominate.
  - "conceptual"  : humanities, business, soft skills, design. Examples are real-world scenarios, not code.
  - "mixed"       : crosses multiple categories — e.g. "data structures" (programming + technical theory).

REQUESTED STYLE — what kind of course did the learner actually ask for? READ the instructions carefully. Map cues to the right style:
  - mentions "summary", "summarize", "tldr", "overview", "key points only", "condensed"           → "summary"
  - mentions "explain in depth", "expand on", "go beyond", "fill in the gaps", "comprehensive"     → "expanded_explanation"
  - mentions "exam", "test prep", "quiz", "review for", "midterm", "final", "certification"        → "exam_prep"
  - mentions "I'm new", "from scratch", "no background", "ELI5", "simple terms"                    → "beginner_intro"
  - mentions "how to use", "how do I", "applied", "real-world", "hands on", "build something"     → "practical_application"
  - mentions "cheat sheet", "reference", "look up", "quick reference"                              → "reference"
  - no instructions, OR generic "teach me X"                                                       → "structured_course"
  If multiple cues fire, pick the dominant one. If the instructions describe something not on this list (e.g. "make it funny"), still pick the closest match here AND record the specific ask under specialRequests.

MATERIALS TREATMENT — how should the uploaded materials be used?
  - "primary_source"   : the learner clearly wants the course built ON the materials. Track them closely. Cues: "summarize this", "teach me what's in these slides", "exam prep for this chapter", or when materials are attached and instructions don't override.
  - "supplementary"    : materials are background/quotes; the learner wants the wider topic. Cues: "teach me X — here are some notes I have".
  - "expand_beyond"    : materials are a starting point; learner wants what's missing too. Cues: "explain everything this assumes", "fill in the gaps".
  - "not_applicable"   : no materials attached. ALWAYS use this when referenceConcepts is empty AND no reference text was provided.

DEPTH PREFERENCE — how thorough?
  - "shallow_overview" : summary, cheat sheet, "just the gist", time-constrained ("I have 30 minutes").
  - "deep_dive"        : "go deep", "rigorous", "I want to really understand", expanded_explanation style usually pairs with this.
  - "standard"         : everything else — the default.

SPECIAL REQUESTS — extract ANY specific ask from the instructions verbatim or near-verbatim. Examples: "use Python not JavaScript", "include diagrams", "make it short", "compare to React", "focus on the Cambridge syllabus". Empty array if there are none.

LANGUAGE DETECTION — what language must the COURSE output be in?
  Priority order:
    1. If the goal text contains an EXPLICIT language request ("in Vietnamese", "en español", "auf Deutsch", "日本語で", "in Thai", "ในภาษาไทย", etc.), that wins.
    2. Otherwise, if the goal/topic itself is written in a non-English language, the course output language matches.
    3. Otherwise, if the reference materials are predominantly in a non-English language, that language wins.
    4. Otherwise, default to "English".
  Output the language using its common English name when ambiguous — but native names ("Tiếng Việt", "Español", "日本語", "ภาษาไทย") are also fine. Be precise: "English", "Vietnamese", "Spanish", "French", "German", "Japanese", "Korean", "Chinese (Simplified)", "Chinese (Traditional)", "Thai", "Portuguese", etc.

NOTE: code identifiers (variable names, function names, keywords) ALWAYS stay in their natural language (English-style). Only the human-readable prose, titles, summaries, and explanations switch language.

REFERENCE PARSING RULES:
  - If reference material is attached, EXTRACT every distinct concept it names. A slide that says "Hash Tables" contains the concept "Hash Tables".
  - "shallow_mention" : the source mentioned it but did not explain.
  - "covered"         : the source explained it briefly (a paragraph or two).
  - "in_depth"        : the source explained it thoroughly, with examples.
  - "implied"         : not named directly, but assumed by the source.
  - If no reference is attached, return an empty referenceConcepts array.

PRINCIPLE: be specific. "Hash Tables" is a concept. "Data structures" is too vague to be a concept here unless that is the literal heading of a slide.`

function buildIntakePrompt(inputs: CourseInputs): string {
  const lines: string[] = [`Topic: ${inputs.topic}`]
  if (inputs.priorKnowledge) lines.push(`Learner says they already know: ${inputs.priorKnowledge}`)
  if (inputs.goals) lines.push(`Learner's specific goal: ${inputs.goals}`)
  if (inputs.referenceTexts && inputs.referenceTexts.length > 0) {
    lines.push(
      ``,
      `--- REFERENCE MATERIAL ---`,
      inputs.referenceTexts.join('\n\n---\n\n').slice(0, 80_000),
      `--- END REFERENCE ---`,
    )
  }
  return lines.join('\n')
}

function coerceReferenceConcept(v: unknown): ReferenceConcept {
  if (!isObject(v)) return { name: '', excerpt: '', depth: 'shallow_mention' }
  return {
    name: asString(v.name),
    excerpt: asString(v.excerpt),
    depth: asEnum(v.depth, ['shallow_mention', 'covered', 'in_depth', 'implied'] as const, 'shallow_mention'),
  }
}

function detectInputMode(inputs: CourseInputs): InputMode {
  const hasGoal = !!inputs.goals && inputs.goals.trim().length > 0
  const hasFiles = (inputs.referenceTexts?.length ?? 0) > 0
  if (hasGoal && hasFiles) return 'topic_with_goal_files'
  if (hasGoal) return 'topic_with_goal'
  if (hasFiles) return 'topic_with_files'
  return 'topic_only'
}

function coerceLearnerProfile(v: unknown, inputs: CourseInputs): LearnerProfile {
  const obj = isObject(v) ? v : {}
  const hasFiles = (inputs.referenceTexts?.length ?? 0) > 0
  const materialsDefault: MaterialsTreatment = hasFiles ? 'primary_source' : 'not_applicable'
  return {
    priorKnowledge: asStringArray(obj.priorKnowledge),
    goal: asString(obj.goal, inputs.goals ?? `Become competent at ${inputs.topic}`),
    audience: asString(obj.audience, 'beginner with adjacent experience'),
    inputMode: detectInputMode(inputs),
    topicCategory: asEnum<TopicCategory>(obj.topicCategory, ['programming', 'technical', 'conceptual', 'mixed'] as const, 'mixed'),
    requestedStyle: asEnum<RequestedStyle>(
      obj.requestedStyle,
      ['summary', 'expanded_explanation', 'exam_prep', 'beginner_intro', 'practical_application', 'structured_course', 'reference'] as const,
      'structured_course',
    ),
    materialsTreatment: asEnum<MaterialsTreatment>(
      obj.materialsTreatment,
      ['primary_source', 'supplementary', 'expand_beyond', 'not_applicable'] as const,
      materialsDefault,
    ),
    depthPreference: asEnum<DepthPreference>(
      obj.depthPreference,
      ['shallow_overview', 'standard', 'deep_dive'] as const,
      'standard',
    ),
    specialRequests: asStringArray(obj.specialRequests),
    language: asString(obj.language, 'English').trim() || 'English',
  }
}

function coerceTopicFrame(v: unknown, inputs: CourseInputs): TopicFrame {
  const obj = isObject(v) ? v : {}
  return {
    topic: asString(obj.topic, inputs.topic),
    framing: asString(obj.framing),
    context: asString(obj.context),
    subAreas: asStringArray(obj.subAreas),
    referenceConcepts: Array.isArray(obj.referenceConcepts) ? obj.referenceConcepts.map(coerceReferenceConcept).filter(c => c.name) : [],
    materialsHaveCode: typeof obj.materialsHaveCode === 'boolean' ? obj.materialsHaveCode : false,
  }
}

export async function runIntake(inputs: CourseInputs): Promise<{ profile: LearnerProfile; frame: TopicFrame }> {
  const raw = await runComplete(INTAKE_SYSTEM, buildIntakePrompt(inputs), 6000)
  const parsed = extractJson(raw)
  if (isObject(parsed)) {
    return {
      profile: coerceLearnerProfile(parsed.profile, inputs),
      frame: coerceTopicFrame(parsed.frame, inputs),
    }
  }
  // Fallback: degrade gracefully so later stages still run.
  return {
    profile: coerceLearnerProfile(undefined, inputs),
    frame: coerceTopicFrame(undefined, inputs),
  }
}

// ════════════════════════════════════════════════════════════════════════
// STAGE 2 — ATLAS
// ════════════════════════════════════════════════════════════════════════

const ATLAS_SYSTEM = `${INSTRUCTOR_PERSONA}

ROLE: Knowledge cartographer. Given a topic, learner profile, and (optionally) parsed reference concepts, produce a complete CONCEPT GRAPH for what a competent learner of this topic must understand.

OUTPUT: ONLY valid JSON. No prose, no markdown fences.

This atlas is the master plan. Every concept you list will become a subtopic somewhere in the course. Every dependency you encode will determine teaching order. If you omit a concept here, it will not be taught.

SCHEMA:
{
  "nodes": [
    {
      "id": "kebab-case-id",
      "name": "Human-readable concept name",
      "description": "1 sentence describing the concept — what it IS",
      "kind": "prerequisite | core | advanced | optional",
      "dependsOn": ["ids of nodes that must be taught first"],
      "alreadyKnown": false,
      "fromReference": ["names of reference concepts (from the input) that this node teaches; empty if not in reference"],
      "suggestedShape": "syntax | conceptual | comparison | process | skill"
    }
  ],
  "prerequisiteGaps": ["names of concepts the learner must know but does not — these will be inserted as their own chapters"]
}

NODE KINDS:
  - "prerequisite" : foundational — must be known before the topic. Mark "alreadyKnown=true" if the learner profile says they know it; otherwise the syllabus will turn this into a prereq chapter.
  - "core"         : a central concept the course must teach in depth.
  - "advanced"     : an elaboration / edge case beyond the core. May be cut if the learner only wants basics.
  - "optional"     : useful context. Cut first if scope is tight.

ATLAS RULES:

1. COMPLETENESS — capture EVERY concept needed for working competence. For a programming language: keywords, syntax, data structures, error handling, testing, build tooling, debugging, idioms, common libraries. For a topic like "transformers": linear algebra prereqs, attention, positional encoding, training loop, common pitfalls. Omit nothing essential.

2. REFERENCE COVERAGE — for every reference concept the input lists, you MUST produce at least one atlas node that teaches it. Set "fromReference" to the matching reference concept names. If the reference is shallow ("just slide titles"), each title becomes its own node — and you EXPAND it: add the prerequisite nodes and elaboration nodes the slide title implies but does not contain.

3. PREREQUISITE EXPANSION — if the topic requires foundational knowledge the learner profile does NOT list as known, create explicit prerequisite nodes AND list the gap names in "prerequisiteGaps". Example: if learner wants "transformers" but doesn't list "matrix multiplication" as prior knowledge, create a "matrix-multiplication" node (kind=prerequisite) and add "matrix multiplication" to prerequisiteGaps.

4. DEPENDENCIES — every "dependsOn" must reference a node id you also defined. The graph must be a DAG (no cycles). If A depends on B, B must be taught first.

5. NODE COUNT — match the topic:
     - Narrow / focused           : 12-20 nodes
     - Medium-breadth             : 20-40 nodes
     - Broad / multi-faceted      : 40-80 nodes

6. ID DISCIPLINE — kebab-case, stable, descriptive. "matrix-multiplication" not "concept-1".

7. NO REDUNDANCY — each concept gets exactly one node. If two reference items are the same concept, merge them.

${KNOWLEDGE_COMPLETENESS_GUARD}`

function modeBriefForAtlas(profile: LearnerProfile): string {
  switch (profile.inputMode) {
    case 'topic_only':
      return `INPUT MODE — TOPIC ONLY. The learner gave only a topic; no goal, no materials.
Build a COMPLETE atlas: foundations + core concepts + practical/real-world usage.
Aim for breadth AND depth. Cover prerequisites, idioms, common patterns, debugging, and at least one project-grade applied area.
The course must take the learner from "knows nothing" to "can do real work in this field". Do not hold back on scope.`

    case 'topic_with_goal':
      return `INPUT MODE — TOPIC + GOAL. The learner's goal: "${profile.goal}".
PRIORITIZE the goal: every atlas node should serve achieving it directly OR be a prerequisite the learner MUST know to truly understand goal-relevant material.
DO NOT pad with tangential nodes. Mark anything not directly serving the goal as "optional" or omit it entirely.
DO include "must-know" foundations — if the goal needs concept X and the learner doesn't know X's prerequisites, ADD them. The principle is: "teach what they HAVE to know to truly understand the goal."`

    case 'topic_with_files':
      return `INPUT MODE — TOPIC + UPLOADED MATERIALS. The materials are the PRIMARY source.
Most atlas nodes should map to a reference concept (set fromReference). Only add additional nodes when:
  (a) a reference concept is shallow and needs prerequisite/elaboration nodes to be teachable, OR
  (b) the materials silently assume foundational knowledge the learner profile lacks.
DO NOT introduce broad unrelated topics that go beyond the materials.
EXPAND every reference concept — even a slide with just "Hash Tables" becomes a full concept node + the prerequisite nodes that slide silently assumes (e.g. "What is a hash function").`

    case 'topic_with_goal_files':
      return `INPUT MODE — TOPIC + GOAL + UPLOADED MATERIALS. Both signals matter.
The materials are the PRIMARY source — most nodes map to reference concepts (set fromReference).
The goal "${profile.goal}" steers prioritization: concepts directly serving the goal are "core"; concepts in the materials but tangential to the goal are "advanced" or "optional".
Add new nodes (beyond the materials) ONLY when the goal demands prerequisites the materials don't cover.`
  }
}

function categoryBriefForAtlas(profile: LearnerProfile): string {
  switch (profile.topicCategory) {
    case 'programming':
      return `TOPIC CATEGORY — PROGRAMMING.
Atlas must cover syntax / language constructs, runtime / mental model, idiomatic patterns, common libraries, debugging, testing, and tooling. Set suggestedShape="syntax" for syntax-heavy nodes; "process" for runtime/lifecycle; "comparison" for "X vs Y" choices.`
    case 'technical':
      return `TOPIC CATEGORY — TECHNICAL (non-programming).
Atlas focuses on mathematical / mechanical understanding, derivations, and trade-offs. Use suggestedShape="conceptual" for theory; "process" for procedural derivations; "comparison" for choices.`
    case 'conceptual':
      return `TOPIC CATEGORY — CONCEPTUAL.
Atlas focuses on frameworks of thought, mental models, real-world examples, decision tools. Use suggestedShape="conceptual" for ideas; "skill" for applied practice.`
    case 'mixed':
      return `TOPIC CATEGORY — MIXED.
The atlas combines syntax/code-heavy nodes with conceptual nodes. Use suggestedShape per node based on what each concept actually IS.`
  }
}

function buildAtlasPrompt(inputs: CourseInputs, profile: LearnerProfile, frame: TopicFrame): string {
  const lines: string[] = [
    modeBriefForAtlas(profile),
    ``,
    categoryBriefForAtlas(profile),
    ``,
    `Topic: ${frame.topic}`,
    `Topic framing: ${frame.framing}`,
    `Wider context: ${frame.context}`,
    `Major sub-areas: ${frame.subAreas.join(', ')}`,
    ``,
    `Learner profile:`,
    `  Audience: ${profile.audience}`,
    `  Goal: ${profile.goal}`,
    `  Already knows: ${profile.priorKnowledge.length > 0 ? profile.priorKnowledge.join('; ') : '(nothing declared)'}`,
  ]

  if (frame.referenceConcepts.length > 0) {
    lines.push(
      ``,
      `Reference concepts (every one MUST become at least one atlas node — expand if shallow):`,
    )
    frame.referenceConcepts.forEach(rc => {
      lines.push(`  - ${rc.name} [${rc.depth}] — ${rc.excerpt.slice(0, 120)}`)
    })
  }

  if (inputs.referenceTexts && inputs.referenceTexts.length > 0) {
    lines.push(
      ``,
      `Full reference material (use to discover concepts the structured list above may have missed):`,
      inputs.referenceTexts.join('\n\n---\n\n').slice(0, 60_000),
    )
  }

  lines.push(
    ``,
    `Build the complete atlas now. Every reference concept becomes at least one node; missing prerequisites are inserted and listed in prerequisiteGaps.`,
  )

  return lines.join('\n')
}

function coerceAtlasNode(v: unknown, idx: number, profilePriorKnowledge: string[]): AtlasNode {
  if (!isObject(v)) {
    return {
      id: `node-${idx + 1}`,
      name: '',
      description: '',
      kind: 'core',
      dependsOn: [],
      alreadyKnown: false,
      fromReference: [],
      suggestedShape: 'conceptual',
    }
  }
  const name = asString(v.name)
  // Auto-mark known if the learner explicitly listed this concept.
  const alreadyKnownDeclared = typeof v.alreadyKnown === 'boolean' ? v.alreadyKnown : false
  const matchesPrior = profilePriorKnowledge.some(pk =>
    pk.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(pk.toLowerCase())
  )
  return {
    id: asString(v.id, `node-${idx + 1}`),
    name,
    description: asString(v.description),
    kind: asEnum<AtlasNodeKind>(v.kind, ['prerequisite', 'core', 'advanced', 'optional'] as const, 'core'),
    dependsOn: asStringArray(v.dependsOn),
    alreadyKnown: alreadyKnownDeclared || matchesPrior,
    fromReference: asStringArray(v.fromReference),
    suggestedShape: asEnum(v.suggestedShape, ['syntax', 'conceptual', 'comparison', 'process', 'skill'] as const, 'conceptual'),
  }
}

function topoStable<T extends { id: string; dependsOn: string[] }>(nodes: T[]): T[] {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const visited = new Set<string>()
  const out: T[] = []
  function visit(n: T, stack: Set<string>) {
    if (visited.has(n.id)) return
    if (stack.has(n.id)) return // break cycle silently
    stack.add(n.id)
    for (const dep of n.dependsOn) {
      const d = byId.get(dep)
      if (d) visit(d, stack)
    }
    stack.delete(n.id)
    visited.add(n.id)
    out.push(n)
  }
  for (const n of nodes) visit(n, new Set())
  return out
}

function summarizeAtlas(nodes: AtlasNode[]): Atlas['summary'] {
  let pre = 0, core = 0, adv = 0, refCovered = 0
  for (const n of nodes) {
    if (n.kind === 'prerequisite') pre++
    else if (n.kind === 'core') core++
    else if (n.kind === 'advanced') adv++
    if (n.fromReference.length > 0) refCovered++
  }
  return {
    nodeCount: nodes.length,
    prerequisites: pre,
    core,
    advanced: adv,
    referenceCovered: refCovered,
  }
}

export async function runAtlas(inputs: CourseInputs, profile: LearnerProfile, frame: TopicFrame): Promise<Atlas> {
  const raw = await runComplete(langPreamble(profile) + ATLAS_SYSTEM, buildAtlasPrompt(inputs, profile, frame), 12000)
  const parsed = extractJson(raw)
  let nodes: AtlasNode[] = []
  let prerequisiteGaps: string[] = []

  if (isObject(parsed)) {
    if (Array.isArray(parsed.nodes)) {
      nodes = parsed.nodes.map((n, i) => coerceAtlasNode(n, i, profile.priorKnowledge))
    }
    prerequisiteGaps = asStringArray(parsed.prerequisiteGaps)
  }

  // De-dup ids
  const seen = new Set<string>()
  nodes = nodes.filter(n => {
    if (!n.id || seen.has(n.id)) return false
    seen.add(n.id)
    return true
  })

  // Topological sort so order respects dependencies
  nodes = topoStable(nodes)

  return {
    nodes,
    prerequisiteGaps,
    summary: summarizeAtlas(nodes),
  }
}

// ════════════════════════════════════════════════════════════════════════
// STAGE 3 — SYLLABUS
// ════════════════════════════════════════════════════════════════════════

const VALID_FORMATS: readonly TeachingFormat[] = [
  'mental_model', 'definition', 'analogy', 'step_by_step', 'real_world_scenario',
  'comparison_table', 'code_example', 'wrong_way', 'common_mistakes', 'recap',
] as const

const SYLLABUS_SYSTEM = `${INSTRUCTOR_PERSONA}

ROLE: Curriculum designer. You are given a CONCEPT ATLAS — every concept the course must teach. Your job is to cluster atlas nodes into chapters, assign teaching shapes, and produce a complete per-chapter PLAN.

OUTPUT: ONLY valid JSON. No prose, no markdown fences.

${FORMAT_CATALOGUE}

${VISUALS_DISCIPLINE}

SCHEMA:
{
  "overview": "2-3 sentences. Open with the real problem this topic solves. Close with the specific capability the learner gains. NEVER start with 'In this lesson' or use 'explore'.",
  "summary": "2-3 sentences for the END of the lesson. Name specific capabilities the learner now has — concrete and testable.",
  "prerequisiteTopics": ["specific concepts the learner is assumed to already know"],
  "learningObjectives": ["By the end, the learner can: [specific, observable, testable action]"],
  "knowledgeGaps": ["specific misconception beginners hold and consistently get wrong"],
  "referenceCoverage": ["EVERY reference concept name from the atlas's fromReference fields, exactly as they appear in the atlas"],
  "chapters": [
    {
      "id": "c1",
      "type": "concept | skill | comparison | debugging | project | prerequisite",
      "title": "Specific name of what is being learned — never vague ('Introduction', 'Basics')",
      "objective": "After this chapter, the learner can: [specific, testable action]",
      "hook": "A concrete scenario, real failure, or surprising fact. NOT a rhetorical question.",
      "summary": "1 sentence — used in the live syllabus and by adjacent chapters",
      "teaches": ["atlas node ids this chapter teaches — must equal the union of subtopic.teaches"],
      "subtopics": [
        {
          "id": "c1-1",
          "title": "Specific name of the sub-idea",
          "summary": "1 sentence — what the learner understands after this subtopic",
          "teaches": ["atlas node ids this subtopic teaches; usually 1-3"],
          "formats": ["mental_model", "definition", "code_example"],
          "codeExamples": [
            {
              "purpose": "basic | realworld | variation | wrong_way",
              "language": "python | javascript | typescript | go | rust | java | sql | bash | ...",
              "scenario": "1 sentence describing what the example demonstrates and the realistic context"
            }
          ],
          "visualHint": "none | diagram | chart | comparison_table",
          "commonMistakes": ["1 specific misconception. Empty array if none."]
        }
      ]
    }
  ]
}

PLANNING RULES:

1. EVERY ATLAS NODE GETS TAUGHT — across all chapters' subtopics, the union of "teaches" arrays MUST equal the set of atlas node ids (excluding nodes marked alreadyKnown=true). No node is dropped silently. The "optional" kind may be cut if scope is tight, but be intentional.

2. CHAPTER COHESION — one chapter = one mental model. Group atlas nodes that share a coherent narrative. A chapter that teaches 12 unrelated concepts is wrong; a chapter that teaches "everything the learner needs to use functions correctly" is right.

3. CHAPTER TYPES:
     - "prerequisite" : a foundational chapter inserted because the learner is missing background. Place these FIRST.
     - "concept"      : the standard "teach this idea" chapter.
     - "skill"        : building / doing — the learner produces something.
     - "comparison"   : when distinguishing 2+ similar things is the lesson.
     - "debugging"    : common errors and how to fix them. EVERY non-trivial topic gets one.
     - "project"      : an applied capstone. Most topics benefit from one near the end.

4. CHAPTER COUNT — match the atlas size AND the input mode:
     Atlas size:
       - 12-20 nodes   → 5-7 chapters
       - 20-40 nodes   → 8-11 chapters
       - 40-80 nodes   → 12-16 chapters
       - 80+ nodes     → 17-22 chapters
     The MINIMUM is 5 chapters. A "course" with 3 chapters is not a course; the experience should feel substantial.
     If you produced fewer chapters than the atlas demands, you split too greedily — re-merge until counts are right.

5. SUBTOPICS PER CHAPTER — 4-6 (minimum 3). Each subtopic should be teachable in 4-8 minutes of reading; never produce a subtopic so thin it could be a single bullet point.

6. FORMAT CHOICE per subtopic — 2-5 formats per subtopic, ordered. Format follows substance:
     - Pure-concept subtopic ("what is X?")  → ["mental_model", "analogy", "recap"]
     - Syntax subtopic ("the X keyword")     → ["definition", "code_example", "wrong_way", "recap"]
     - "Compare X and Y" subtopic            → ["mental_model", "comparison_table", "real_world_scenario"]
     - Process subtopic ("how the loop runs") → ["mental_model", "step_by_step", "code_example"]

7. CODE EXAMPLES — declare per subtopic.
     For PROGRAMMING topics, examples are the spine of the course:
       - AGGREGATE 12-40+ examples across the syllabus, scaled to scope.
       - Most syntax-heavy subtopics declare 1-2 examples; key idiom/pattern subtopics declare 2-3.
       - Each major concept gets at least ONE "realworld" example.
       - Every debugging chapter gets at least ONE "wrong_way" example.
       - When a subtopic teaches syntax, you MUST include "code_example" in formats AND declare a corresponding codeExamples entry.
     For TECHNICAL (non-programming) topics, examples MUST be empty — use "real_world_scenario" formats and worked numerical examples instead. Do NOT add "code_example" to formats.
     For CONCEPTUAL topics, examples MUST be empty.
     For MIXED topics, only add codeExamples to subtopics that are EXPLICITLY about programming syntax or code. Subtopics about theory, history, concepts, ethics, or process MUST have empty codeExamples and must NOT include "code_example" in formats.

8. ORDERING — a chapter never assumes a concept that no earlier chapter taught. Atlas dependencies must be respected. Prerequisite chapters come first.

9. REFERENCE COVERAGE — every reference concept name (from atlas nodes' fromReference fields) appears in referenceCoverage AND is taught by some subtopic.

10. ID DISCIPLINE — chapter ids are c1, c2, c3 ...; subtopic ids are c1-1, c1-2 ...

${KNOWLEDGE_COMPLETENESS_GUARD}`

/**
 * Decide whether code examples should appear in this course.
 *
 *   - explicit programming topic                       → ALLOW
 *   - files attached AND files contain code            → ALLOW
 *   - files attached AND files have NO code            → SUPPRESS
 *   - no files, conceptual / technical topic           → SUPPRESS
 *   - no files, mixed topic (non-programming)          → SUPPRESS (allow per-subtopic only)
 *   - no files, programming topic                      → ALLOW (the model decides)
 */
function codePolicy(profile: LearnerProfile, frame: TopicFrame): 'allow' | 'suppress' {
  const filesAttached = profile.inputMode === 'topic_with_files' || profile.inputMode === 'topic_with_goal_files'
  if (filesAttached && !frame.materialsHaveCode && profile.topicCategory !== 'programming') {
    return 'suppress'
  }
  if (profile.topicCategory === 'conceptual') return 'suppress'
  if (profile.topicCategory === 'technical') return 'suppress'
  return 'allow'
}

function codePolicyBrief(profile: LearnerProfile, frame: TopicFrame): string {
  if (codePolicy(profile, frame) === 'suppress') {
    return `CODE POLICY — SUPPRESS.
Do NOT introduce code examples in this course. Reasons: ${
      profile.topicCategory === 'conceptual'
        ? 'this is a conceptual topic where code adds noise.'
        : profile.topicCategory === 'technical'
          ? 'this is a non-programming technical topic — use worked numerical/mechanical examples instead.'
          : 'the uploaded materials contain no code, and the topic does not inherently require it.'
    }
Concretely:
  - Every subtopic's "codeExamples" array MUST be empty.
  - "code_example" MUST NOT appear in any subtopic's "formats".
  - Use "real_world_scenario", "step_by_step", "comparison_table", "analogy", or "mental_model" instead.
  - The course teaches just as well with prose + structured examples.`
  }
  return `CODE POLICY — ALLOW.
Code examples are appropriate for this course. Use them where syntax is genuinely the lesson; otherwise prefer prose / scenarios / comparisons. Do not bolt code onto every subtopic.`
}

/**
 * Steering brief built from the inferred RequestedStyle, MaterialsTreatment, and
 * DepthPreference. Used by Syllabus and Author stages to shape chapter count,
 * depth, treatment of materials, and any verbatim special requests.
 */
function intentBrief(profile: LearnerProfile, stage: 'syllabus' | 'author'): string {
  const styleLines: Record<RequestedStyle, string> = {
    summary:
      `REQUESTED STYLE — SUMMARY.
The learner wants a CONDENSED course. ${stage === 'syllabus'
        ? 'Cut chapter count to roughly HALF of the normal range. Each chapter has 3-4 (not 4-6) subtopics. Drop "optional" atlas nodes and most "advanced" ones. Skip a debugging chapter and a project chapter unless the materials themselves include one.'
        : 'Keep subtopic prose TIGHT — get to the point. Drop second examples when one suffices. Prefer "definition" and "recap" over long "mental_model" walks.'}`,
    expanded_explanation:
      `REQUESTED STYLE — EXPANDED EXPLANATION.
The learner wants MORE than what they brought. ${stage === 'syllabus'
        ? 'Aim for the upper end of the chapter-count range. Add explicit prerequisite chapters even if not strictly required. Each subtopic earns deeper treatment (more formats, more examples).'
        : 'Use multiple formats per subtopic. Expand on what materials only hint at. Include analogies and mental models even where the source is terse. Examples should be detailed and motivated.'}`,
    exam_prep:
      `REQUESTED STYLE — EXAM PREP.
The learner is preparing for a test. ${stage === 'syllabus'
        ? 'Organize chapters around TESTABLE concepts. Every chapter MUST include "common_mistakes" subtopics. Add a final "review" or "practice" chapter. Prefer "comparison" chapters when the topic has distinctions students confuse.'
        : 'Sharpen "commonMistakes" and "exercise" sections — these are the highest-value outputs. Add 3-5 common mistakes per subtopic (not 1-2). Exercises should be exam-style: specific, scorable, with a clean canonical answer.'}`,
    beginner_intro:
      `REQUESTED STYLE — BEGINNER INTRO.
The learner is new. ${stage === 'syllabus'
        ? 'Start with one or two explicit prerequisite/foundations chapters. Prefer "analogy" and "mental_model" formats heavily over "definition" or "syntax". Skip advanced atlas nodes.'
        : 'Lead every subtopic with an analogy or concrete mental model. Examples should be deliberately simple and motivated. No jargon without immediate plain-English gloss. Common mistakes should target newbie traps.'}`,
    practical_application:
      `REQUESTED STYLE — PRACTICAL APPLICATION.
The learner wants to USE this, not study it. ${stage === 'syllabus'
        ? 'Most chapters should be "skill" or "project" type. Strong bias toward "code_example" with purpose="realworld". Include a debugging chapter and end with a project chapter.'
        : 'Examples are the spine. Every subtopic that can carry a realistic scenario should have one. Code examples should be production-flavored (HTTP, DB, files), never toy. Mental models are short — get to the doing.'}`,
    reference:
      `REQUESTED STYLE — REFERENCE.
The learner wants a lookup-friendly artifact. ${stage === 'syllabus'
        ? 'Many small focused chapters organized by topic, not narrative. Each subtopic is independent and re-readable. No hooks chained across chapters.'
        : 'Each subtopic should stand alone. Lead with the definition. Tables and lists are welcome. Drop hooks and recaps that imply linear reading.'}`,
    structured_course:
      `REQUESTED STYLE — STRUCTURED COURSE (the default).
Build a complete, narrative course front-to-back. ${stage === 'syllabus'
        ? 'Use the standard chapter-count range. Mix concept / skill / debugging / project chapters as the atlas warrants.'
        : 'Balance theory and practice. Use the full format catalogue as each subtopic warrants.'}`,
  }

  const materialsLines: Record<MaterialsTreatment, string> = {
    primary_source:
      `MATERIALS TREATMENT — PRIMARY SOURCE.
The uploaded materials ARE the course. Chapter ordering tracks the materials. Do NOT introduce topics the materials don't touch unless they're strict prerequisites the materials silently assume.`,
    supplementary:
      `MATERIALS TREATMENT — SUPPLEMENTARY.
Teach the wider topic. Use the materials as EXAMPLES, QUOTES, or CASE STUDIES inside chapters — not as the spine of the syllabus. Reference concepts may be a subset of what you teach.`,
    expand_beyond:
      `MATERIALS TREATMENT — EXPAND BEYOND.
The materials are a starting point. Cover them fully, then ADD: prerequisites they assume, elaborations they gloss over, related concepts they imply. The final course is larger than the source.`,
    not_applicable:
      `MATERIALS TREATMENT — NONE.
No materials. Build the course from the topic alone.`,
  }

  const depthLines: Record<DepthPreference, string> = {
    shallow_overview:
      `DEPTH — SHALLOW OVERVIEW. Each subtopic is shorter; 2-3 formats max; fewer examples. The course can be read in ~15 minutes.`,
    deep_dive:
      `DEPTH — DEEP DIVE. Each subtopic earns its full treatment: multiple formats, multiple examples, common mistakes spelled out, exercises that demand application not recall.`,
    standard:
      `DEPTH — STANDARD. Default depth — apply the depth floor and formatting rules as written.`,
  }

  const specialBlock = profile.specialRequests.length > 0
    ? `\nSPECIAL REQUESTS — honour these verbatim asks from the learner:\n${profile.specialRequests.map(r => `  - ${r}`).join('\n')}`
    : ''

  return `${styleLines[profile.requestedStyle]}\n\n${materialsLines[profile.materialsTreatment]}\n\n${depthLines[profile.depthPreference]}${specialBlock}`
}

function modeBriefForSyllabus(profile: LearnerProfile): string {
  switch (profile.inputMode) {
    case 'topic_only':
      return `INPUT MODE — TOPIC ONLY. Build the FULL course experience: prerequisite chapter(s) if needed, foundations, core concepts, idioms, debugging, applied/project work. Aim toward the upper end of the chapter-count range. Do not skimp; the learner expects a complete course.`
    case 'topic_with_goal':
      return `INPUT MODE — TOPIC + GOAL. The learner's goal: "${profile.goal}".
Chapters should be ORDERED so the goal is reachable as soon as the prerequisites are in. Drop tangential atlas nodes (mark as optional) rather than padding chapters. The course can be on the lower end of the chapter range if the goal is narrow — but every chapter must drive toward the goal.`
    case 'topic_with_files':
      return `INPUT MODE — TOPIC + UPLOADED MATERIALS. Chapter count and ordering should TRACK the materials. If the materials have 8 sections, expect 8-12 chapters. DO NOT add unrelated chapters. DO add prerequisite chapters at the start when the materials silently assume background knowledge.`
    case 'topic_with_goal_files':
      return `INPUT MODE — TOPIC + GOAL + UPLOADED MATERIALS. Chapter ordering should TRACK the materials, but goal "${profile.goal}" determines emphasis: chapters serving the goal go deeper (more subtopics, more examples). Tangential material content gets a single recap-style chapter or is dropped.`
  }
}

function categoryBriefForSyllabus(profile: LearnerProfile): string {
  switch (profile.topicCategory) {
    case 'programming':
      return `TOPIC CATEGORY — PROGRAMMING. Code examples are the spine. Most syntax-heavy subtopics include "code_example" in formats with at least one declared codeExamples entry. Aim for 12-40+ aggregate code examples across the syllabus. Always include a "debugging" chapter with "wrong_way" examples and a "project" or "skill" chapter near the end.`
    case 'technical':
      return `TOPIC CATEGORY — TECHNICAL. Use "real_world_scenario", "step_by_step", and "comparison_table" formats heavily. Numerical/worked examples instead of code. Diagrams (visualHint="diagram") for processes and structures.`
    case 'conceptual':
      return `TOPIC CATEGORY — CONCEPTUAL. Use "mental_model", "analogy", "real_world_scenario", "common_mistakes" heavily. No code, no math-heavy diagrams unless directly warranted.`
    case 'mixed':
      return `TOPIC CATEGORY — MIXED. Pick formats per subtopic based on what the subtopic actually teaches.`
  }
}

function buildSyllabusPrompt(inputs: CourseInputs, profile: LearnerProfile, frame: TopicFrame, atlas: Atlas): string {
  const refConceptNames = Array.from(new Set(
    atlas.nodes.flatMap(n => n.fromReference).filter(Boolean)
  ))

  const lines: string[] = [
    modeBriefForSyllabus(profile),
    ``,
    categoryBriefForSyllabus(profile),
    ``,
    intentBrief(profile, 'syllabus'),
    ``,
    codePolicyBrief(profile, frame),
    ``,
    RESTRAINT_MANIFESTO,
    ``,
    `Topic: ${frame.topic}`,
    `Audience: ${profile.audience}`,
    `Goal / instructions: ${profile.goal}`,
    `Already knows: ${profile.priorKnowledge.length > 0 ? profile.priorKnowledge.join('; ') : '(none declared)'}`,
    ``,
    `═══ ATLAS — ${atlas.nodes.length} concepts ═══`,
    ``,
  ]
  for (const n of atlas.nodes) {
    const tags: string[] = [n.kind]
    if (n.alreadyKnown) tags.push('learner-already-knows')
    if (n.fromReference.length > 0) tags.push(`from-reference: ${n.fromReference.join(', ')}`)
    const deps = n.dependsOn.length > 0 ? `  ⟵ depends on: ${n.dependsOn.join(', ')}` : ''
    lines.push(`[${n.id}] ${n.name}  (${tags.join(' / ')})`)
    lines.push(`    ${n.description}`)
    if (deps) lines.push(deps)
  }

  if (atlas.prerequisiteGaps.length > 0) {
    lines.push(``, `Prerequisite GAPS — these MUST become "prerequisite" chapters at the start of the syllabus:`)
    atlas.prerequisiteGaps.forEach(g => lines.push(`  - ${g}`))
  }

  if (refConceptNames.length > 0) {
    lines.push(``, `Reference concepts that MUST appear in referenceCoverage and be taught:`)
    refConceptNames.forEach(rc => lines.push(`  - ${rc}`))
  }

  lines.push(``, `Build the complete syllabus now. Every non-already-known atlas node ends up in exactly one subtopic's "teaches" array. Respect the dependency graph: never teach a concept before its prerequisites.`)

  return lines.join('\n')
}

function coerceCodeExampleDecl(v: unknown): CodeExampleDecl {
  if (!isObject(v)) return { purpose: 'basic', language: '', scenario: '' }
  return {
    purpose: asEnum<CodeExamplePurpose>(v.purpose, ['basic', 'realworld', 'variation', 'wrong_way'] as const, 'basic'),
    language: asString(v.language),
    scenario: asString(v.scenario),
  }
}

function asFormatArray(v: unknown): TeachingFormat[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is TeachingFormat =>
    typeof x === 'string' && (VALID_FORMATS as readonly string[]).includes(x)
  )
}

function coerceSubtopicPlan(v: unknown, chapterId: string, idx: number): SubtopicPlan {
  if (!isObject(v)) {
    return {
      id: `${chapterId}-${idx + 1}`,
      title: `Subtopic ${idx + 1}`,
      summary: '',
      teaches: [],
      formats: [],
      codeExamples: [],
      visualHint: 'none',
      commonMistakes: [],
    }
  }
  return {
    id: asString(v.id, `${chapterId}-${idx + 1}`),
    title: asString(v.title, `Subtopic ${idx + 1}`),
    summary: asString(v.summary),
    teaches: asStringArray(v.teaches),
    formats: asFormatArray(v.formats),
    codeExamples: Array.isArray(v.codeExamples) ? v.codeExamples.map(coerceCodeExampleDecl) : [],
    visualHint: asEnum<VisualHint>(v.visualHint, ['none', 'diagram', 'chart', 'comparison_table'] as const, 'none'),
    commonMistakes: asStringArray(v.commonMistakes),
  }
}

function coerceChapterPlan(v: unknown, idx: number): ChapterPlan {
  if (!isObject(v)) {
    return {
      id: `c${idx + 1}`,
      type: 'concept',
      title: `Chapter ${idx + 1}`,
      objective: '',
      hook: '',
      summary: '',
      teaches: [],
      subtopics: [],
    }
  }
  const id = asString(v.id, `c${idx + 1}`)
  const subtopics = Array.isArray(v.subtopics)
    ? v.subtopics.map((st, j) => coerceSubtopicPlan(st, id, j))
    : []
  return {
    id,
    type: asEnum<ChapterType>(v.type, ['concept', 'skill', 'comparison', 'debugging', 'project', 'prerequisite'] as const, 'concept'),
    title: asString(v.title, `Chapter ${idx + 1}`),
    objective: asString(v.objective),
    hook: asString(v.hook),
    summary: asString(v.summary),
    teaches: asStringArray(v.teaches).length > 0
      ? asStringArray(v.teaches)
      : Array.from(new Set(subtopics.flatMap(s => s.teaches))),
    subtopics,
  }
}

export async function runSyllabus(
  inputs: CourseInputs,
  profile: LearnerProfile,
  frame: TopicFrame,
  atlas: Atlas,
): Promise<Syllabus> {
  const raw = await runComplete(langPreamble(profile) + SYLLABUS_SYSTEM, buildSyllabusPrompt(inputs, profile, frame, atlas), 12000)
  const parsed = extractJson(raw)
  if (!isObject(parsed)) {
    return {
      overview: '',
      summary: '',
      prerequisiteTopics: [],
      learningObjectives: [],
      knowledgeGaps: [],
      referenceCoverage: [],
      chapters: [],
    }
  }

  const chaptersRaw = Array.isArray(parsed.chapters) ? parsed.chapters : []
  return {
    overview: asString(parsed.overview),
    summary: asString(parsed.summary),
    prerequisiteTopics: asStringArray(parsed.prerequisiteTopics),
    learningObjectives: asStringArray(parsed.learningObjectives),
    knowledgeGaps: asStringArray(parsed.knowledgeGaps),
    referenceCoverage: asStringArray(parsed.referenceCoverage),
    chapters: chaptersRaw.map(coerceChapterPlan),
  }
}

// ════════════════════════════════════════════════════════════════════════
// STAGE 4 — AUTHOR (per chapter, streaming)
// ════════════════════════════════════════════════════════════════════════

interface AuthorArgs {
  inputs: CourseInputs
  profile: LearnerProfile
  frame: TopicFrame
  atlas: Atlas
  syllabus: Syllabus
  chapter: ChapterPlan
  chapterIndex: number
}

function renderSubtopicContract(st: SubtopicPlan, atlas: Atlas): string {
  const taughtNodes = st.teaches
    .map(id => atlas.nodes.find(n => n.id === id))
    .filter((n): n is AtlasNode => !!n)

  const codeBlock = st.codeExamples.length > 0
    ? st.codeExamples
        .map((ex, i) => `      ${i + 1}. purpose=${ex.purpose}, language=${ex.language}\n         scenario: ${ex.scenario}`)
        .join('\n')
    : '      (no code examples declared — produce no code unless a "code_example" format is in the formats list)'

  const mistakesBlock = st.commonMistakes.length > 0
    ? st.commonMistakes.map(m => `      - ${m}`).join('\n')
    : '      (none pre-specified — if "common_mistakes" format is declared, use your expertise to identify 2-4)'

  const teachesBlock = taughtNodes.length > 0
    ? taughtNodes.map(n => `      - [${n.id}] ${n.name}: ${n.description}`).join('\n')
    : '      (no atlas concepts mapped — teach what the title implies)'

  return `  SUBTOPIC ${st.id}: "${st.title}"
    Summary the learner should be able to give: ${st.summary}
    Atlas concepts this subtopic teaches:
${teachesBlock}
    Declared formats (render content under ## headings IN THIS ORDER): ${st.formats.join(' → ') || '(none)'}
    Visual hint: ${st.visualHint}
    Code examples to produce (one per declared item — match purpose):
${codeBlock}
    Common mistakes to address (in commonMistakes array):
${mistakesBlock}`
}

function buildAuthorSystem(args: AuthorArgs): string {
  const { syllabus, chapter, chapterIndex } = args
  const total = syllabus.chapters.length

  const priorChapters = syllabus.chapters.slice(0, chapterIndex)
  const nextChapter = syllabus.chapters[chapterIndex + 1]

  const priorBlock = priorChapters.length > 0
    ? priorChapters.map((c, i) => `  ${i + 1}. "${c.title}" — ${c.summary}`).join('\n')
    : '  (none — this is the first chapter)'

  const nextBlock = nextChapter
    ? `  Next: "${nextChapter.title}" — ${nextChapter.summary}`
    : '  (none — this is the final chapter)'

  const subtopicContracts = chapter.subtopics
    .map(st => renderSubtopicContract(st, args.atlas))
    .join('\n\n')

  const hasRefs = (args.inputs.referenceTexts?.length ?? 0) > 0
  const sourceBlock = hasRefs ? REFERENCE_INTEGRATION_RULES : NO_REFERENCE_BLOCK

  const categoryEmphasis = (() => {
    switch (args.profile.topicCategory) {
      case 'programming':
        return `CATEGORY EMPHASIS — PROGRAMMING TOPIC.
Code examples are the primary teaching device. Every syntax-related subtopic MUST include a "code_example" format and a corresponding entry in "examples".
Each code example MUST be:
  - Complete (imports, setup, demonstration, output if any)
  - Realistic (production-style scenarios — HTTP handler, DB query, retry, queue, parsing, etc — NEVER toy "Hello World" or "foo / bar / baz")
  - Commented (every non-obvious line)
  - Substantial (10+ lines for "realworld"; 5+ for "basic")
Default to MORE examples, not fewer. If a subtopic teaches a concept that maps to syntax and you produced no example, you have failed the contract.`
      case 'technical':
        return `CATEGORY EMPHASIS — TECHNICAL (non-programming) TOPIC. Use worked numerical/mechanical examples and step-by-step derivations. ABSOLUTELY NO code blocks or code examples — the subtopic contract will never declare them. If any subtopic has an "examples" entry with a "code" field, leave it empty.`
      case 'conceptual':
        return `CATEGORY EMPHASIS — CONCEPTUAL TOPIC. Use real-world scenarios as your primary teaching device. No code, no math-heavy diagrams unless the concept genuinely demands them.`
      case 'mixed':
        return `CATEGORY EMPHASIS — MIXED. Match the teaching shape to each individual subtopic.
Code examples are ONLY appropriate for subtopics that explicitly teach programming syntax or code. All other subtopics (theory, concepts, processes, comparisons) MUST use prose, scenarios, analogies, and structured examples — no code blocks.
Diagrams (Mermaid) are ONLY appropriate when the subtopic contract's visualHint is "diagram". If visualHint is "none" or "comparison_table", the visuals array MUST be empty.`
    }
  })()

  const visualGuidance = chapter.subtopics.some(s => s.visualHint === 'diagram' || s.visualHint === 'chart')
    ? `Some subtopics declared visualHint="diagram" or "chart". Produce a Visual object for THOSE subtopics ONLY, attached to that subtopic's "visuals" array. visualHint="comparison_table" is rendered as a markdown table inside content, NOT as a Visual object. visualHint="none" means no Visual.`
    : `No subtopic declared visualHint="diagram" or "chart". All subtopics' "visuals" arrays should be empty.`

  return `${langPreamble(args.profile)}${INSTRUCTOR_PERSONA}

ROLE: Chapter author. You write ONE chapter of a multi-chapter course. Stay focused on this chapter. Other chapters are written separately.

OUTPUT: JSON only — a single chapter object as specified at the bottom. No text outside the JSON, no markdown fences.

═══════════════════════════════════════════════════
COURSE-LEVEL CONTEXT
═══════════════════════════════════════════════════
Topic: ${args.inputs.topic}
You are writing chapter ${chapterIndex + 1} of ${total}: "${chapter.title}"

PRIOR CHAPTERS (already taught — assume the learner read these; never re-teach):
${priorBlock}

UPCOMING:
${nextBlock}

═══════════════════════════════════════════════════
THIS CHAPTER'S CONTRACT — SATISFY ALL OF IT
═══════════════════════════════════════════════════
ID: ${chapter.id}
Title: ${chapter.title}
Type: ${chapter.type}
Objective: ${chapter.objective}
Hook (use verbatim or paraphrase as the chapter's hook field): ${chapter.hook}
Chapter summary: ${chapter.summary}

SUBTOPICS — produce ONE subtopic in your output per entry below, IN THIS ORDER:

${subtopicContracts}

═══════════════════════════════════════════════════
SOURCE
═══════════════════════════════════════════════════
${sourceBlock}

═══════════════════════════════════════════════════
${categoryEmphasis}

═══════════════════════════════════════════════════
${intentBrief(args.profile, 'author')}

═══════════════════════════════════════════════════
${codePolicyBrief(args.profile, args.frame)}

═══════════════════════════════════════════════════
${RESTRAINT_MANIFESTO}

═══════════════════════════════════════════════════
${DEPTH_STANDARD}

═══════════════════════════════════════════════════
${SUBTOPIC_FORMATTING_RULES}

═══════════════════════════════════════════════════
${SUBTOPIC_DEPTH_FLOOR}

═══════════════════════════════════════════════════
${CODE_EXAMPLES_REQUIREMENT}

═══════════════════════════════════════════════════
VISUALS
${visualGuidance}

Visual object shapes (only insert when declared by visualHint="diagram" or "chart"):
  Mermaid : { "type": "mermaid", "title": "...", "syntax": "flowchart TD\\n  A[Node] --> B[Node]", "diagramType": "flowchart" }
  Chart   : { "type": "chart", "title": "...", "chartType": "bar", "data": { "labels": [...], "datasets": [{ "label": "...", "data": [...] }] } }

Mermaid syntax rules — MUST follow exactly, the renderer is strict:
  - MUST start with: flowchart TD  (or flowchart LR for left-to-right)
  - Node syntax: A[Label]  — square brackets only. Do NOT use A(Label), A{Label}, or A>Label].
  - INSIDE [ ] labels, these characters are FORBIDDEN: / \\ : ; ( ) { } < > | " ' \` and any HTML/markdown.
    Examples that are WRONG:
      Root[/]                  → use Root["Root level"] instead
      API[api/]                → use API["api"]
      UserID[:id]              → use UserID["user id"]
      Parser[ParseInt(s)]      → use Parser["ParseInt"]
    If a label has spaces, ALWAYS wrap it in double quotes:  A["My Label"]
  - Arrows: A --> B  or  A -->|short label| B  (edge labels: alphanumeric + spaces only, no dots / parens / colons)
    WRONG:  A -->|c.Next()| B   → RIGHT:  A -->|c Next| B
  - Maximum 10 nodes per diagram. Maximum 25 characters per label.
  - One statement per line. No trailing semicolons.
  - If you cannot express a concept within these rules, set visualHint="none" and skip the diagram. A missing visual is BETTER than a broken one.

═══════════════════════════════════════════════════
COMMON MISTAKES OUTPUT FORMAT (for both subtopic-level and chapter-level commonMistakes arrays):
Each item is a SINGLE string in this exact form:
  "Mistake: [exact wrong action]. Why: [the false belief that causes it]. Fix: [the correct mental model]."

═══════════════════════════════════════════════════
EXERCISE OUTPUT FORMAT (one chapter-level exercise required):
{
  "prompt": "A specific concrete task. Includes enough context that there is a clear right answer. Requires APPLYING this chapter's concept, not recalling it.",
  "hint": "Nudges toward the right approach without revealing the solution.",
  "solution": "Complete answer with step-by-step explanation."
}

═══════════════════════════════════════════════════
${ANTI_PATTERNS}

═══════════════════════════════════════════════════
${KNOWLEDGE_COMPLETENESS_GUARD}

═══════════════════════════════════════════════════
OUTPUT — produce ONLY this JSON object, nothing else:
{
  "id": "${chapter.id}",
  "title": "${chapter.title}",
  "objective": "${chapter.objective}",
  "hook": "1-2 sentences. The concrete situation, problem, or surprise that makes the learner want this chapter. NEVER 'In this chapter'.",
  "subtopics": [
    {
      "id": "[matches the planned subtopic id]",
      "title": "[matches the planned subtopic title]",
      "summary": "1 sentence — what the learner now understands",
      "content": "The teaching prose, structured under ## headings IN THE ORDER OF THE DECLARED FORMATS.",
      "examples": [{ "title": "...", "body": "...", "code": "...", "language": "..." }],
      "commonMistakes": ["Mistake: ... . Why: ... . Fix: ... ."],
      "visuals": []
    }
  ],
  "keyPoints": ["Non-obvious insight a learner might miss even after reading."],
  "summary": "1-2 sentences naming the specific capability the learner now has.",
  "exercise": { "prompt": "...", "hint": "...", "solution": "..." }
}`
}

function buildAuthorPrompt(args: AuthorArgs): string {
  const lines: string[] = [
    `Write chapter ${args.chapterIndex + 1} of ${args.syllabus.chapters.length}: "${args.chapter.title}".`,
    ``,
    `Topic: ${args.inputs.topic}`,
    `Audience: ${args.profile.audience}`,
  ]
  if (args.profile.priorKnowledge.length > 0) {
    lines.push(`Learner already knows (do NOT re-teach): ${args.profile.priorKnowledge.join('; ')}`)
  }
  if (args.syllabus.prerequisiteTopics.length > 0) {
    lines.push(`Course-level prerequisites assumed: ${args.syllabus.prerequisiteTopics.join('; ')}`)
  }
  if (args.syllabus.knowledgeGaps.length > 0) {
    lines.push(`Beginner misconceptions to address where relevant: ${args.syllabus.knowledgeGaps.join('; ')}`)
  }

  if ((args.inputs.referenceTexts?.length ?? 0) > 0) {
    lines.push(
      ``,
      `═══ REFERENCE MATERIAL — extract every concept relevant to THIS chapter's subtopics and teach it deeply ═══`,
      args.inputs.referenceTexts!.join('\n\n---\n\n').slice(0, 60_000),
      `═══════════════════════════════════════════════════`,
    )
  }

  return lines.join('\n')
}

function sanitizeCode(s: string): string {
  // Strip a single leading/trailing fenced code wrapper if the model included it.
  return s
    .replace(/^```(?:[a-zA-Z]+)?\s*\n?/, '')
    .replace(/\n?\s*```\s*$/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\s+$/g, '')
}

function coerceExample(v: unknown): LessonExample {
  if (!isObject(v)) return { title: '', body: '' }
  return {
    title: asString(v.title).trim(),
    body: sanitizeProse(asString(v.body)),
    code: typeof v.code === 'string' ? sanitizeCode(v.code) : undefined,
    language: typeof v.language === 'string' ? v.language.trim().toLowerCase() : undefined,
  }
}

function coerceVisuals(v: unknown): Visual[] {
  if (!Array.isArray(v)) return []
  const out: Visual[] = []
  for (const item of v) {
    if (!isObject(item)) continue
    // Mermaid visuals get aggressively sanitized so renderer doesn't fail.
    if (item.type === 'mermaid' && typeof item.syntax === 'string') {
      out.push({ ...item, syntax: sanitizeMermaid(item.syntax) } as unknown as Visual)
      continue
    }
    out.push(item as unknown as Visual)
  }
  return out
}

/**
 * Clean prose-content artifacts produced by inconsistent model output:
 *   - leading / trailing markdown fences (``` or ```json)
 *   - escaped newlines that come from JSON-parsing models that double-escape
 *   - runs of more than 2 newlines (collapse to 2 — paragraph break)
 *   - trailing/leading whitespace
 */
function sanitizeProse(s: string): string {
  if (!s) return ''
  let out = s
  // Convert literal "\n" sequences (some models double-escape) into real newlines.
  // Only do this if the string has no real newlines but DOES have \n sequences
  // in pairs that suggest it came from JSON-as-string.
  if (!/\n/.test(out) && /\\n/.test(out)) {
    out = out.replace(/\\n/g, '\n')
  }
  // Normalize CRLF
  out = out.replace(/\r\n?/g, '\n')
  // Strip leading/trailing fenced code wrappers
  out = out.replace(/^```(?:[a-zA-Z]+)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '')
  // Collapse 3+ newlines
  out = out.replace(/\n{3,}/g, '\n\n')
  return out.trim()
}

function coerceSubtopic(v: unknown, plan: SubtopicPlan): Subtopic {
  if (!isObject(v)) {
    return {
      id: plan.id,
      title: plan.title,
      summary: plan.summary,
      content: '',
      formats: plan.formats,
      examples: [],
      commonMistakes: [],
      visuals: [],
    }
  }
  return {
    id: asString(v.id, plan.id),
    title: asString(v.title, plan.title).trim(),
    summary: asString(v.summary, plan.summary).trim(),
    content: sanitizeProse(asString(v.content)),
    formats: plan.formats,
    examples: Array.isArray(v.examples) ? v.examples.map(coerceExample) : [],
    commonMistakes: asStringArray(v.commonMistakes).map(s => s.trim()).filter(Boolean),
    visuals: coerceVisuals(v.visuals),
  }
}

function parseChapter(raw: string, chapter: ChapterPlan): LessonSection {
  const parsed = extractJson(raw)
  if (!isObject(parsed)) {
    // Synthesize a stub from the plan so the pipeline keeps moving.
    return {
      id: chapter.id,
      title: chapter.title,
      objective: chapter.objective,
      hook: chapter.hook,
      subtopics: chapter.subtopics.map(sp => coerceSubtopic(undefined, sp)),
      exercise: null,
      keyPoints: [],
      summary: chapter.summary,
      visuals: [],
    }
  }

  const subtopicsRaw = parsed.subtopics
  const subtopics: Subtopic[] = Array.isArray(subtopicsRaw)
    ? chapter.subtopics.map((sp, i) => coerceSubtopic(subtopicsRaw[i], sp))
    : chapter.subtopics.map(sp => coerceSubtopic(undefined, sp))

  const exerciseRaw = parsed.exercise
  const exercise = isObject(exerciseRaw)
    ? {
        prompt: asString(exerciseRaw.prompt),
        hint: asString(exerciseRaw.hint),
        solution: asString(exerciseRaw.solution),
      }
    : null

  return {
    id: asString(parsed.id, chapter.id),
    title: asString(parsed.title, chapter.title),
    objective: asString(parsed.objective, chapter.objective),
    hook: asString(parsed.hook, chapter.hook),
    subtopics,
    exercise,
    keyPoints: asStringArray(parsed.keyPoints),
    summary: asString(parsed.summary, chapter.summary),
    visuals: [],
  }
}

export async function runAuthor(args: AuthorArgs): Promise<LessonSection> {
  const system = buildAuthorSystem(args)
  const prompt = buildAuthorPrompt(args)
  const raw = await collectStream(runStream(system, prompt, 16000))
  return parseChapter(raw, args.chapter)
}

// ════════════════════════════════════════════════════════════════════════
// MODIFY — user-driven post-creation editing of a chapter or subtopic
// ════════════════════════════════════════════════════════════════════════

// ModifyIntent / ModifyScope come from pipeline-types.ts (imported above).

interface ModifyArgs {
  inputs: CourseInputs
  profile: LearnerProfile
  frame: TopicFrame
  atlas: Atlas
  syllabus: Syllabus
  chapter: ChapterPlan
  chapterIndex: number
  scope: ModifyScope
  /** Required when scope === 'subtopic'. */
  subtopicId?: string
  intent: ModifyIntent
  instruction: string
}

const INTENT_BRIEF: Record<ModifyIntent, string> = {
  edit:
    `INTENT — EDIT.
The learner wants a focused fix to existing content. Keep structure (subtopics, formats, examples, visuals) the same. Tighten wording, fix factual issues, replace weak examples, clarify confusing passages. Length stays roughly the same.
CRITICAL: Do NOT add code blocks, code examples, or new visuals unless the learner's request explicitly asks for them. Preserve the existing visual types exactly.`,
  expand:
    `INTENT — EXPAND.
The learner wants more depth. You may: add a new subtopic, deepen existing prose, add an additional example, add a worked walkthrough, surface a non-obvious mechanism. Aim to ADD substance — never pad. Length grows where the learner asked.`,
  simplify:
    `INTENT — SIMPLIFY.
The learner wants the material easier to follow. Shorten dense passages, replace jargon with plain words, break long paragraphs into bullets, drop tangential examples. Preserve correctness and the four-layer depth (WHAT / HOW / WHY / WRONG) but say it more directly. Length usually shrinks.`,
  restructure:
    `INTENT — RESTRUCTURE.
The learner wants the way the material is organized to change. You may: reorder subtopics, merge or split subtopics, change the teaching order, switch from definition-first to problem-first (or vice versa), introduce a different mental model. Preserve correctness; reshape the path.`,
}

/**
 * Apply a learner-driven modification to a chapter (or one of its subtopics).
 * Re-runs the chapter author with a strong directive at the top of the system
 * prompt. Returns the new chapter; the caller swaps the affected subtopic (or
 * the whole chapter) into the persisted lesson content.
 */
export async function runModifyChapter(args: ModifyArgs): Promise<LessonSection> {
  const { chapter, scope, subtopicId, intent, instruction } = args

  if (scope === 'subtopic') {
    const targetIndex = chapter.subtopics.findIndex(st => st.id === subtopicId)
    if (targetIndex < 0) {
      throw new Error(`Subtopic ${subtopicId} not found in chapter ${chapter.id}`)
    }
  }

  const baseSystem = buildAuthorSystem({
    inputs: args.inputs,
    profile: args.profile,
    frame: args.frame,
    atlas: args.atlas,
    syllabus: args.syllabus,
    chapter,
    chapterIndex: args.chapterIndex,
  })

  const target = scope === 'subtopic'
    ? chapter.subtopics.find(st => st.id === subtopicId)!
    : null

  const scopeDirective = scope === 'chapter'
    ? `SCOPE — WHOLE CHAPTER. You are reshaping this entire chapter. Re-output the full chapter JSON. Every subtopic may change.`
    : `SCOPE — ONE SUBTOPIC. You are reshaping subtopic id="${target!.id}" ("${target!.title}"). Re-output the full chapter JSON, but only this subtopic should differ from the original — every other subtopic must stay consistent in title, summary, and substance.`

  const directive = `═══════════════════════════════════════════════════
MODIFICATION REQUEST
═══════════════════════════════════════════════════
${scopeDirective}

${INTENT_BRIEF[intent]}

LEARNER'S REQUEST (verbatim):
"${instruction}"

Honor this request literally where it doesn't break correctness or the JSON contract. If the request contradicts the schema, follow the schema. If the request asks for a different language, ignore — output language is fixed by this lesson's persisted language.

═══════════════════════════════════════════════════
${baseSystem}`

  const prompt = buildAuthorPrompt({
    inputs: args.inputs,
    profile: args.profile,
    frame: args.frame,
    atlas: args.atlas,
    syllabus: args.syllabus,
    chapter,
    chapterIndex: args.chapterIndex,
  })

  const raw = await collectStream(runStream(directive, prompt, 16000))
  return parseChapter(raw, chapter)
}

// ─── ADD CHAPTER — two-stage: plan the new chapter, then author it ──────

/**
 * Stage A: produce a focused ChapterPlan for the new chapter.
 *
 * Asking the model for a small, well-defined JSON payload is far more reliable
 * than asking for plan + full authored content in one shot. The follow-up
 * Stage B reuses the existing Author stage which we already trust.
 */
const NEW_CHAPTER_PLAN_SYSTEM = `${INSTRUCTOR_PERSONA}

ROLE: Curriculum surgeon. The course already exists; the learner wants a NEW chapter inserted. Plan it.

OUTPUT: ONLY a single JSON object matching the schema below. No prose, no markdown fences, no commentary.

SCHEMA:
{
  "type": "concept" | "skill" | "comparison" | "debugging" | "project" | "prerequisite",
  "title": "Specific name of the new chapter",
  "objective": "After this chapter, the learner can: [specific, testable action]",
  "hook": "1-2 sentence concrete situation, problem, or surprise that makes the learner want this chapter",
  "summary": "1 sentence — what the learner will know after this chapter",
  "subtopics": [
    {
      "title": "Sub-idea name (specific, not vague)",
      "summary": "1 sentence — what the learner understands after this subtopic",
      "formats": ["mental_model", "definition", "code_example"],
      "codeExamples": [
        { "purpose": "basic" | "realworld" | "variation" | "wrong_way", "language": "python", "scenario": "1 sentence describing what the example shows" }
      ],
      "visualHint": "none" | "diagram" | "chart" | "comparison_table",
      "commonMistakes": ["only when there is a real, non-obvious misconception; otherwise empty array"]
    }
  ]
}

RULES:
  - 3-6 subtopics. Each subtopic teaches a specific sub-idea.
  - Format choice follows substance: a pure-concept subtopic doesn't need code_example; a syntax subtopic does.
  - codeExamples can be empty when the subtopic isn't syntax-driven.
  - The new chapter must NOT duplicate material already covered by neighboring chapters.
  - DO NOT include id fields — the API assigns them after parsing.

${RESTRAINT_MANIFESTO}

${KNOWLEDGE_COMPLETENESS_GUARD}`

interface NewChapterPlanShape {
  type?: unknown
  title?: unknown
  objective?: unknown
  hook?: unknown
  summary?: unknown
  subtopics?: unknown[]
}

export async function runAddChapter(args: {
  inputs: CourseInputs
  profile: LearnerProfile
  frame: TopicFrame
  atlas: Atlas
  syllabus: Syllabus
  /** Where to insert: 0-based index AFTER which the new chapter goes. -1 = prepend; sections.length-1 = append. */
  insertAfter: number
  instruction: string
}): Promise<{ plan: ChapterPlan; section: LessonSection }> {
  const { syllabus, insertAfter, instruction } = args
  const before = insertAfter >= 0 ? syllabus.chapters[insertAfter] : null
  const after = syllabus.chapters[insertAfter + 1] ?? null

  const courseOutline = syllabus.chapters
    .map((c, i) => `  ${i + 1}. "${c.title}" — ${c.summary}`)
    .join('\n')

  const planPrompt = [
    `Topic: ${args.inputs.topic}`,
    `Audience: ${args.profile.audience}`,
    '',
    `EXISTING COURSE OUTLINE (do NOT duplicate these chapters):`,
    courseOutline || '  (empty)',
    '',
    `INSERT POSITION: ${
      before ? `after "${before.title}"` : 'at the very beginning'
    }${after ? `, before "${after.title}"` : ''}`,
    '',
    `LEARNER REQUEST FOR THE NEW CHAPTER:`,
    `"${instruction}"`,
    '',
    `Plan the new chapter now. Make it specific and consistent with the surrounding chapters.`,
  ].join('\n')

  // Stage A: ChapterPlan
  const planRaw = await runComplete(langPreamble(args.profile) + NEW_CHAPTER_PLAN_SYSTEM, planPrompt, 6000)
  const planParsed = extractJson(planRaw)
  if (!isObject(planParsed)) {
    throw new Error('Could not plan the new chapter — try a more specific request.')
  }
  const shape = planParsed as NewChapterPlanShape

  // Coerce subtopics — assign deterministic ids so downstream stages have stable handles.
  const newId = `c-new-${Date.now().toString(36)}`
  const subtopicsRaw = Array.isArray(shape.subtopics) ? shape.subtopics : []
  const subtopicPlans: SubtopicPlan[] = subtopicsRaw.map((st, i) => {
    if (!isObject(st)) {
      return {
        id: `${newId}-${i + 1}`,
        title: `Subtopic ${i + 1}`,
        summary: '',
        teaches: [],
        formats: [],
        codeExamples: [],
        visualHint: 'none',
        commonMistakes: [],
      }
    }
    return {
      id: `${newId}-${i + 1}`,
      title: asString(st.title, `Subtopic ${i + 1}`),
      summary: asString(st.summary),
      teaches: [],   // new chapter; not pre-mapped to atlas
      formats: asFormatArray(st.formats),
      codeExamples: Array.isArray(st.codeExamples) ? st.codeExamples.map(coerceCodeExampleDecl) : [],
      visualHint: asEnum<VisualHint>(st.visualHint, ['none', 'diagram', 'chart', 'comparison_table'] as const, 'none'),
      commonMistakes: asStringArray(st.commonMistakes),
    }
  })

  if (subtopicPlans.length === 0) {
    throw new Error('The new chapter plan came back without any subtopics. Try a more specific request.')
  }

  const newPlan: ChapterPlan = {
    id: newId,
    type: asEnum<ChapterType>(shape.type, ['concept', 'skill', 'comparison', 'debugging', 'project', 'prerequisite'] as const, 'concept'),
    title: asString(shape.title, 'New Chapter'),
    objective: asString(shape.objective),
    hook: asString(shape.hook),
    summary: asString(shape.summary),
    teaches: [],
    subtopics: subtopicPlans,
  }

  // Stage B: author the new chapter using the existing Author stage. Insert
  // the new plan into a temporary syllabus so neighbor-context (prior/next
  // chapters) is correct from the author's perspective.
  const insertIndex = insertAfter + 1
  const tempSyllabus: Syllabus = {
    ...syllabus,
    chapters: [
      ...syllabus.chapters.slice(0, insertIndex),
      newPlan,
      ...syllabus.chapters.slice(insertIndex),
    ],
  }

  const section = await runAuthor({
    inputs: args.inputs,
    profile: args.profile,
    frame: args.frame,
    atlas: args.atlas,
    syllabus: tempSyllabus,
    chapter: newPlan,
    chapterIndex: insertIndex,
  })

  return { plan: newPlan, section }
}

// ════════════════════════════════════════════════════════════════════════
// STAGE 5a — PER-CHAPTER REVIEW
// ════════════════════════════════════════════════════════════════════════

const REVIEW_SYSTEM = `${INSTRUCTOR_PERSONA}

ROLE: Independent reviewer. You review a chapter that was JUST written against its planning contract. Find specific shallowness, missing pieces, broken format adherence, and weak examples — and FIX them.

OUTPUT: ONLY valid JSON. No prose, no markdown fences.

You will receive:
  1. The chapter's PLANNING CONTRACT (subtopics with declared formats, code examples, common mistakes, visual hints).
  2. The GENERATED CHAPTER JSON.

REVIEW CRITERIA — for each subtopic:
  A. FORMAT ADHERENCE: every declared format renders under its expected ## heading, in declared order.
  B. CODE EXAMPLE COUNT: ONE example per declared codeExamples entry, with matching purpose.
  C. CODE QUALITY: examples are complete, runnable, realistic (not toy "Hello World"), commented.
  D. DEPTH: each subtopic has ~150-400 words of genuine teaching content. No paragraphs that wave at the concept without explaining the mechanism.
  E. COMMON MISTAKES: planned mistakes are addressed in the proper "Mistake: ... Why: ... Fix: ..." form.
  F. ANTI-PATTERNS: no banned filler, no "In this section we will...", no key points that restate the title.
  G. VISUALS DISCIPLINE: visualHint="none" → empty visuals array. visualHint="diagram"/"chart" → a Visual object.

DECISION:
  - If EVERY subtopic passes ALL checks: return { "ok": true }
  - Else: produce a fixed version of the entire chapter:
      { "ok": false, "chapter": <full corrected LessonSection JSON> }
    Fix EVERY problem you identified. Preserve everything that was correct. Only rewrite what was wrong.`

interface ReviewArgs {
  inputs: CourseInputs
  profile: LearnerProfile
  syllabus: Syllabus
  chapter: ChapterPlan
  generated: LessonSection
}

function buildReviewPrompt(args: ReviewArgs): string {
  const planJson = JSON.stringify({
    id: args.chapter.id,
    title: args.chapter.title,
    objective: args.chapter.objective,
    hook: args.chapter.hook,
    subtopics: args.chapter.subtopics,
  }, null, 2)

  const sectionJson = JSON.stringify({
    id: args.generated.id,
    title: args.generated.title,
    objective: args.generated.objective,
    hook: args.generated.hook,
    subtopics: args.generated.subtopics,
    keyPoints: args.generated.keyPoints,
    summary: args.generated.summary,
    exercise: args.generated.exercise,
  }, null, 2)

  return `Review this chapter against its planning contract.

═══ PLANNING CONTRACT ═══
${planJson}

═══ GENERATED CHAPTER ═══
${sectionJson}

If every check passes, output { "ok": true }. Otherwise output { "ok": false, "chapter": <corrected chapter> }.`
}

export async function runReview(args: ReviewArgs): Promise<LessonSection | null> {
  const raw = await runComplete(langPreamble(args.profile) + REVIEW_SYSTEM, buildReviewPrompt(args), 16000)
  const parsed = extractJson(raw)
  if (!isObject(parsed)) return null
  if (parsed.ok === true) return null
  if (parsed.ok !== false) return null

  const chapterRaw = parsed.chapter
  if (!isObject(chapterRaw)) return null

  const subtopicsRaw = chapterRaw.subtopics
  const subtopics: Subtopic[] = Array.isArray(subtopicsRaw)
    ? args.chapter.subtopics.map((sp, i) => coerceSubtopic(subtopicsRaw[i], sp))
    : args.generated.subtopics ?? []

  const exerciseRaw = chapterRaw.exercise
  const exercise = isObject(exerciseRaw)
    ? {
        prompt: asString(exerciseRaw.prompt, args.generated.exercise?.prompt ?? ''),
        hint: asString(exerciseRaw.hint, args.generated.exercise?.hint ?? ''),
        solution: asString(exerciseRaw.solution, args.generated.exercise?.solution ?? ''),
      }
    : args.generated.exercise ?? null

  return {
    id: asString(chapterRaw.id, args.generated.id),
    title: asString(chapterRaw.title, args.generated.title),
    objective: asString(chapterRaw.objective, args.generated.objective),
    hook: asString(chapterRaw.hook, args.generated.hook),
    subtopics,
    exercise,
    keyPoints: asStringArray(chapterRaw.keyPoints).length > 0
      ? asStringArray(chapterRaw.keyPoints)
      : args.generated.keyPoints,
    summary: asString(chapterRaw.summary, args.generated.summary),
    visuals: [],
  }
}

// ════════════════════════════════════════════════════════════════════════
// STAGE 5b — GLOBAL VERIFY (atlas coverage + continuity)
// ════════════════════════════════════════════════════════════════════════

/**
 * Quick deterministic post-flight check. Doesn't call the model — uses the
 * atlas + chapter "teaches" assignments + final lesson sections to detect
 * coverage gaps. Returns a list of human-readable correction notes.
 *
 * (We could extend this with a model-based pass later; for now the deterministic
 * version catches the worst cases — silent drops, undefined references — without
 * burning another expensive call.)
 */
export function runGlobalVerify(atlas: Atlas, syllabus: Syllabus, sections: LessonSection[]): string[] {
  const corrections: string[] = []

  const taughtIds = new Set<string>()
  for (const ch of syllabus.chapters) {
    for (const st of ch.subtopics) {
      for (const id of st.teaches) taughtIds.add(id)
    }
  }

  // Concepts the syllabus dropped silently
  for (const node of atlas.nodes) {
    if (node.alreadyKnown) continue
    if (node.kind === 'optional') continue
    if (!taughtIds.has(node.id)) {
      corrections.push(`Atlas concept "${node.name}" (${node.kind}) was not assigned to any chapter`)
    }
  }

  // Sections that came back empty
  sections.forEach((s, i) => {
    const subtopicCount = s.subtopics?.length ?? 0
    const totalContent = (s.subtopics ?? []).reduce((acc, st) => acc + (st.content?.length ?? 0), 0)
    if (subtopicCount === 0) {
      corrections.push(`Chapter ${i + 1} ("${s.title}") produced zero subtopics`)
    } else if (totalContent < 200) {
      corrections.push(`Chapter ${i + 1} ("${s.title}") produced very little content (${totalContent} chars)`)
    }
  })

  // Reference concepts unmentioned
  const referenceNames = Array.from(new Set(atlas.nodes.flatMap(n => n.fromReference)))
  if (referenceNames.length > 0) {
    const allText = sections.map(s => [
      s.hook ?? '',
      s.summary ?? '',
      ...(s.subtopics ?? []).map(st => `${st.title} ${st.content ?? ''}`),
    ].join(' ')).join(' ').toLowerCase()
    for (const name of referenceNames) {
      const needle = name.toLowerCase().trim()
      if (needle && !allText.includes(needle)) {
        corrections.push(`Reference concept "${name}" was not mentioned anywhere in the final chapters`)
      }
    }
  }

  return corrections
}

// ════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR — yields PipelineEvents
// ════════════════════════════════════════════════════════════════════════

function chaptersToSnapshots(chapters: ChapterPlan[]): ChapterSnapshot[] {
  return chapters.map((c, i) => ({
    id: c.id,
    index: i,
    title: c.title,
    summary: c.summary,
    type: c.type,
    teaches: c.teaches,
  }))
}

/**
 * Runs the entire pipeline. Yields events for each milestone. The final
 * `complete` payload carries the assembled LessonContent plus the atlas
 * and syllabus that produced it — the caller persists all three and
 * emits a `lessonId` event of its own.
 */
export async function* generateCourse(inputs: CourseInputs): AsyncGenerator<
  | PipelineEvent
  | { type: 'complete'; content: LessonContent; atlas: Atlas; syllabus: Syllabus; profile: LearnerProfile; frame: TopicFrame }
> {
  // Stage 1 — Intake
  yield { type: 'stage', stage: 'intake', message: 'Understanding what you want to learn…' }
  const { profile, frame } = await runIntake(inputs)

  // Stage 2 — Atlas
  yield { type: 'stage', stage: 'atlas', message: 'Mapping the knowledge graph…' }
  const atlas = await runAtlas(inputs, profile, frame)
  yield { type: 'atlas', summary: atlas.summary }

  if (atlas.nodes.length === 0) {
    yield { type: 'error', message: 'Could not build a knowledge atlas for this topic. Try refining the topic or attaching reference material.' }
    return
  }

  // Stage 3 — Syllabus
  yield { type: 'stage', stage: 'syllabus', message: 'Designing the curriculum…' }
  const syllabus = await runSyllabus(inputs, profile, frame, atlas)

  if (syllabus.chapters.length === 0) {
    yield { type: 'error', message: 'Could not produce a syllabus from the atlas. Try a more focused topic.' }
    return
  }

  yield {
    type: 'syllabus',
    chapters: chaptersToSnapshots(syllabus.chapters),
    overview: syllabus.overview,
  }

  // Stage 4 — Author each chapter (with per-chapter review)
  yield { type: 'stage', stage: 'author', message: `Writing ${syllabus.chapters.length} chapters…` }
  const sections: LessonSection[] = []
  for (let i = 0; i < syllabus.chapters.length; i++) {
    const chapter = syllabus.chapters[i]
    yield { type: 'chapter', index: i, status: 'writing' }

    let section: LessonSection
    try {
      section = await runAuthor({ inputs, profile, frame, atlas, syllabus, chapter, chapterIndex: i })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      yield { type: 'chapter', index: i, status: 'failed', error: message }
      // Insert a stub so total count is preserved; the verify pass will flag it.
      sections.push({
        id: chapter.id, title: chapter.title, objective: chapter.objective, hook: chapter.hook,
        subtopics: chapter.subtopics.map(sp => coerceSubtopic(undefined, sp)),
        exercise: null, keyPoints: [], summary: chapter.summary, visuals: [],
      })
      continue
    }

    yield { type: 'chapter', index: i, status: 'reviewing' }
    try {
      const improved = await runReview({ inputs, profile, syllabus, chapter, generated: section })
      if (improved) section = improved
    } catch {
      // Review failure is non-fatal — keep the original.
    }

    sections.push(section)
    yield { type: 'chapter', index: i, status: 'done' }
  }

  // Stage 5 — Verify
  yield { type: 'stage', stage: 'verify', message: 'Checking course completeness…' }
  const corrections = runGlobalVerify(atlas, syllabus, sections)
  yield { type: 'verify', corrections }

  // Final assembled content
  const content: LessonContent = {
    overview: syllabus.overview,
    sections,
    summary: syllabus.summary,
  }

  yield { type: 'complete', content, atlas, syllabus, profile, frame }
}
