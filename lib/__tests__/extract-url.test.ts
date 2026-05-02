import { describe, it, expect } from 'vitest'
import { isYouTubeUrl, extractYouTubeVideoId } from '../ai/extract-url'

describe('isYouTubeUrl', () => {
  it('detects youtube.com/watch URLs', () => {
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=abc123')).toBe(true)
  })
  it('detects youtu.be short URLs', () => {
    expect(isYouTubeUrl('https://youtu.be/abc123')).toBe(true)
  })
  it('returns false for non-YouTube URLs', () => {
    expect(isYouTubeUrl('https://example.com/article')).toBe(false)
  })
})

describe('extractYouTubeVideoId', () => {
  it('extracts video ID from watch URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it('extracts video ID from short URL', () => {
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
})
