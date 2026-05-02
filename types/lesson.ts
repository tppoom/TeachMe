export type Depth = 'beginner' | 'intermediate' | 'advanced'
export type Provider = 'anthropic' | 'openai'
export type VisualType = 'mermaid' | 'chart' | 'code'

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

export interface LessonSection {
  id: string
  title: string
  content: string
  keyPoints: string[]
  summary: string
  visuals: Visual[]
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
  depth: Depth
  provider: Provider
  content: LessonContent
  sourceUrls: string[]
  sourceFiles: string[]
  createdAt: string
  updatedAt: string
}
