/**
 * Types shared by the 5-stage TeachMe pipeline:
 *   intake → atlas → syllabus → author → verify
 *
 * The renderer (LessonViewer / SectionBlock) consumes the legacy
 * `LessonContent` shape from `@/types/lesson`. Pipeline stages produce
 * richer intermediates that ultimately compile down to that shape.
 */

import type { LessonContent, LessonSection, TeachingFormat } from '@/types/lesson'
export type { LessonContent, LessonSection, TeachingFormat }

// ─── INPUTS ──────────────────────────────────────────────────────────────

export interface CourseInputs {
  topic: string
  priorKnowledge?: string
  goals?: string
  referenceTexts?: string[]
}

// ─── STAGE 1: INTAKE ─────────────────────────────────────────────────────

/**
 * Which input shape the learner gave us. Determines how much of the topic to
 * cover, how heavily to lean on uploaded materials, and how much to expand
 * beyond explicit goals.
 */
export type InputMode =
  | 'topic_only'              // just a topic, no goal, no materials
  | 'topic_with_goal'         // topic + explicit goal (no materials)
  | 'topic_with_files'        // topic + uploaded materials (no goal)
  | 'topic_with_goal_files'   // topic + goal + materials

/**
 * Topic shape — drives whether we lean on code examples, comparisons, etc.
 *   programming  : languages, frameworks, libraries, dev tools, databases
 *   technical    : non-programming engineering / science (math, ml theory, networking)
 *   conceptual   : humanities, business, soft skills
 *   mixed        : crosses multiple categories
 */
export type TopicCategory = 'programming' | 'technical' | 'conceptual' | 'mixed'

/**
 * What the learner is actually asking us to build. Inferred from the free-form
 * instructions text + any uploaded materials. Determines chapter count, depth,
 * and the teaching shape used in the syllabus + author stages.
 *
 *   summary               — distill what's there. Few chapters, short, no expansion.
 *   expanded_explanation  — go beyond the materials; fill in prerequisites and examples.
 *   exam_prep             — testable concepts, practice exercises, common-mistake drills.
 *   beginner_intro        — gentle on-ramp, lots of analogies, low prerequisite load.
 *   practical_application — "how to actually use this" — heavy on real-world scenarios.
 *   structured_course     — the default — full course from foundations to applied work.
 *   reference             — lookup-style, concise, organized for re-reading not first-read.
 */
export type RequestedStyle =
  | 'summary'
  | 'expanded_explanation'
  | 'exam_prep'
  | 'beginner_intro'
  | 'practical_application'
  | 'structured_course'
  | 'reference'

/**
 * How to treat uploaded materials relative to the wider topic.
 *
 *   primary_source   — the materials ARE the course; track them closely.
 *   supplementary    — use them as examples / quotes, but teach the wider topic.
 *   expand_beyond    — they're a starting point; fill in everything they assume.
 *   not_applicable   — no materials attached.
 */
export type MaterialsTreatment = 'primary_source' | 'supplementary' | 'expand_beyond' | 'not_applicable'

export type DepthPreference = 'shallow_overview' | 'standard' | 'deep_dive'

export interface LearnerProfile {
  /** What the learner brings — concepts they explicitly or implicitly already know. */
  priorKnowledge: string[]
  /** Their stated goal — what they want to be able to do after the course. */
  goal: string
  /** The level the course should target ("beginner", "working professional", etc.). */
  audience: string
  /** Which input shape the learner gave us — set deterministically by the orchestrator. */
  inputMode: InputMode
  /** Topic category — set deterministically based on Intake's analysis. */
  topicCategory: TopicCategory
  /** What kind of course the learner is actually asking for. Inferred at Intake. */
  requestedStyle: RequestedStyle
  /** How to treat uploaded materials (if any). Inferred at Intake. */
  materialsTreatment: MaterialsTreatment
  /** Preferred depth — drives chapter count and subtopic depth. Inferred at Intake. */
  depthPreference: DepthPreference
  /** Verbatim specific asks pulled out of the instructions ("in Python", "skip basics", "include diagrams"). */
  specialRequests: string[]
  /**
   * Output language for ALL human-readable strings (chapter titles, prose,
   * examples, summaries). Detected from the goal text + reference materials
   * in Stage 1; defaults to English. Use the language's native name where
   * possible ("Vietnamese", "Tiếng Việt", "Español", "日本語", etc.) so it
   * carries through prompts unambiguously. Code identifiers stay in their
   * natural language (English) regardless.
   */
  language: string
}

export interface TopicFrame {
  /** A precise restatement of the topic. */
  topic: string
  /** A 2–3 sentence framing — what this topic IS at a high level. */
  framing: string
  /** Where this topic sits in a wider knowledge map (parent / sibling fields). */
  context: string
  /** Major sub-areas the topic covers. */
  subAreas: string[]
  /** Reference materials parsed into structured nuggets. */
  referenceConcepts: ReferenceConcept[]
  /**
   * True when uploaded materials contain code samples (snippets, listings,
   * commands, config). Used to gate code-example generation: if files were
   * attached but contain no code AND the topic isn't inherently programming,
   * the syllabus and author stages will not invent code examples.
   */
  materialsHaveCode: boolean
}

export interface ReferenceConcept {
  /** Concept name as it appeared in the source. */
  name: string
  /** Verbatim or near-verbatim short quote / line that introduced it. */
  excerpt: string
  /** How deeply the source covered it. */
  depth: 'shallow_mention' | 'covered' | 'in_depth' | 'implied'
}

// ─── STAGE 2: ATLAS ──────────────────────────────────────────────────────

export type AtlasNodeKind =
  | 'prerequisite'  // must be known before the topic; may need teaching
  | 'core'          // a central concept the course must teach in depth
  | 'advanced'      // an elaboration / edge case beyond the core
  | 'optional'      // useful context, can be cut if time-constrained

export interface AtlasNode {
  id: string
  /** Concept name. */
  name: string
  /** A 1-sentence description of the concept. */
  description: string
  kind: AtlasNodeKind
  /** Other node ids this concept depends on (must be taught first). */
  dependsOn: string[]
  /** Whether the learner already knows this (skip / compress in syllabus). */
  alreadyKnown: boolean
  /** Reference excerpts that mention this concept (for material expansion). */
  fromReference: string[]
  /** Suggested teaching shape: "syntax-heavy" / "conceptual" / "comparison" / "process" / "skill" */
  suggestedShape: 'syntax' | 'conceptual' | 'comparison' | 'process' | 'skill'
}

export interface Atlas {
  nodes: AtlasNode[]
  /** Concepts the learner *must* know but doesn't — these become prereq chapters. */
  prerequisiteGaps: string[]
  /** Quick summary for live UX. */
  summary: {
    nodeCount: number
    prerequisites: number
    core: number
    advanced: number
    referenceCovered: number
  }
}

// ─── STAGE 3: SYLLABUS ───────────────────────────────────────────────────

export type ChapterType = 'concept' | 'skill' | 'comparison' | 'debugging' | 'project' | 'prerequisite'
export type CodeExamplePurpose = 'basic' | 'realworld' | 'variation' | 'wrong_way'
export type VisualHint = 'none' | 'diagram' | 'chart' | 'comparison_table'

export interface CodeExampleDecl {
  purpose: CodeExamplePurpose
  language: string
  scenario: string
}

export interface SubtopicPlan {
  id: string
  title: string
  summary: string
  /** Atlas node ids this subtopic teaches. */
  teaches: string[]
  formats: TeachingFormat[]
  codeExamples: CodeExampleDecl[]
  visualHint: VisualHint
  commonMistakes: string[]
}

export interface ChapterPlan {
  id: string
  type: ChapterType
  title: string
  objective: string
  hook: string
  /** A 1-sentence summary used in the syllabus theatre and by adjacent chapters. */
  summary: string
  /** Atlas node ids this chapter teaches (union of subtopic.teaches). */
  teaches: string[]
  subtopics: SubtopicPlan[]
}

export interface Syllabus {
  overview: string
  summary: string
  prerequisiteTopics: string[]
  learningObjectives: string[]
  knowledgeGaps: string[]
  /** Reference concept names that should appear somewhere in the chapters. */
  referenceCoverage: string[]
  chapters: ChapterPlan[]
}

// ─── STAGE 4-5: AUTHOR + VERIFY (output is a LessonSection per chapter) ──

// LessonSection / LessonContent are imported from @/types/lesson and re-exported above.

// ─── Modification feature ────────────────────────────────────────────────

export type ModifyIntent = 'edit' | 'expand' | 'simplify' | 'restructure'
export type ModifyScope =
  | 'chapter'         // rewrite one chapter
  | 'subtopic'        // rewrite one subtopic inside a chapter
  | 'all_chapters'    // apply the instruction to every chapter in turn
  | 'add_chapter'     // create a new chapter and append (or insert after `chapterIndex`)
  | 'direction'       // adjust the course direction; rewrites every chapter with the new framing

// ─── PIPELINE EVENTS (streamed to the client) ────────────────────────────

export type PipelineStage = 'intake' | 'atlas' | 'syllabus' | 'author' | 'verify' | 'persist'

export interface ChapterSnapshot {
  id: string
  index: number
  title: string
  summary: string
  type: ChapterType
  teaches: string[]
}

export type ChapterStatus = 'pending' | 'writing' | 'reviewing' | 'done' | 'failed'

export type PipelineEvent =
  /** Top-level stage transitions. */
  | { type: 'stage'; stage: PipelineStage; message?: string }
  /** Atlas summary once the graph is built. */
  | { type: 'atlas'; summary: Atlas['summary'] }
  /** Full syllabus snapshot — emitted once after Stage 3. UI renders chapter cards from this. */
  | { type: 'syllabus'; chapters: ChapterSnapshot[]; overview: string }
  /** Per-chapter authoring progress. */
  | { type: 'chapter'; index: number; status: ChapterStatus; error?: string }
  /** Global verify result. */
  | { type: 'verify'; corrections: string[] }
  /** Final lesson id on success. */
  | { type: 'lessonId'; id: string }
  /** Fatal error. */
  | { type: 'error'; message: string }
