export type Provider = 'anthropic' | 'openai'
export type VisualType = 'mermaid' | 'chart' | 'code'

export type TeachingFormat =
  | 'mental_model'
  | 'definition'
  | 'analogy'
  | 'step_by_step'
  | 'real_world_scenario'
  | 'comparison_table'
  | 'code_example'
  | 'wrong_way'
  | 'common_mistakes'
  | 'recap'

export interface MermaidVisual {
  type: 'mermaid'
  title: string
  syntax: string
  diagramType: string
}

export interface ChartVisual {
  type: 'chart'
  title: string
  chartType: 'bar' | 'line' | 'pie'
  data: {
    labels: string[]
    datasets: { label: string; data: number[] }[]
  }
}

export interface CodeVisual {
  type: 'code'
  title: string
  language: string
  code: string
  explanation: string
}

export type Visual = MermaidVisual | ChartVisual | CodeVisual

export interface LessonExample {
  title: string
  body: string
  code?: string
  language?: string
}

export interface LessonExercise {
  prompt: string
  hint: string
  solution: string
}

export interface Subtopic {
  id: string
  title: string
  summary: string
  content: string
  formats: TeachingFormat[]
  examples: LessonExample[]
  commonMistakes: string[]
  visuals: Visual[]
}

export interface LessonSection {
  id: string
  title: string
  objective?: string
  hook?: string
  subtopics?: Subtopic[]
  content?: string
  examples?: LessonExample[]
  commonMistakes?: string[]
  visuals?: Visual[]
  exercise?: LessonExercise | null
  keyPoints: string[]
  summary: string
}

export interface LessonContent {
  overview: string
  sections: LessonSection[]
  summary: string
}

export interface LessonRecord {
  id: string
  userId: string
  title: string
  topic: string
  priorKnowledge: string | null
  goals: string | null
  provider: Provider
  content: LessonContent
  sourceUrls: string[]
  sourceFiles: string[]
  createdAt: string
  updatedAt: string
}
