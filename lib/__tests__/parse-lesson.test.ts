import { describe, it, expect } from 'vitest'
import { parseLessonContent } from '../ai/parse-lesson'

const validLesson = {
  overview: 'An overview of Python functions.',
  sections: [
    {
      id: 's1',
      title: 'What is a function?',
      content: 'A function is a reusable block of code.',
      keyPoints: ['Functions avoid repetition', 'Defined with def'],
      summary: 'Functions are named, reusable code blocks.',
      visuals: [
        { type: 'mermaid', title: 'Function flow', syntax: 'flowchart TD\n  A-->B', diagramType: 'flowchart' },
        { type: 'code', title: 'Example', language: 'python', code: 'def hi(): pass', explanation: 'A minimal function.' },
      ],
    },
  ],
  summary: 'You now understand Python functions.',
}

describe('parseLessonContent', () => {
  it('parses a valid lesson JSON string', () => {
    const result = parseLessonContent(JSON.stringify(validLesson))
    expect(result.overview).toBe('An overview of Python functions.')
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].visuals).toHaveLength(2)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseLessonContent('not json')).toThrow()
  })

  it('throws if sections array is missing', () => {
    expect(() => parseLessonContent(JSON.stringify({ overview: 'x', summary: 'y' }))).toThrow('sections')
  })
})
