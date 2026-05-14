import * as cheerio from 'cheerio'
import { YoutubeTranscript } from 'youtube-transcript'

export function isYouTubeUrl(url: string): boolean {
  return /youtube\.com\/watch|youtu\.be\//.test(url)
}

export function extractYouTubeVideoId(url: string): string | null {
  const watchMatch = url.match(/[?&]v=([^&]+)/)
  if (watchMatch) return watchMatch[1]
  const shortMatch = url.match(/youtu\.be\/([^?]+)/)
  if (shortMatch) return shortMatch[1]
  return null
}

export async function extractTextFromUrl(url: string): Promise<string> {
  if (isYouTubeUrl(url)) {
    const videoId = extractYouTubeVideoId(url)
    if (!videoId) throw new Error(`Could not extract video ID from: ${url}`)
    const transcript = await YoutubeTranscript.fetchTranscript(videoId)
    return `[YouTube Transcript from ${url}]\n${transcript.map((t: { text: string }) => t.text).join(' ')}`
  }

  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const html = await res.text()
  const $ = cheerio.load(html)
  $('script, style, nav, footer, header, aside').remove()
  const text = $('main, article, .content, body').first().text()
  return `[Web content from ${url}]\n${text.replace(/\s+/g, ' ').trim().slice(0, 40000)}`
}
