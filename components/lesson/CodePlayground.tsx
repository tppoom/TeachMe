'use client'
import { useState } from 'react'
import type { CodeVisual } from '@/types/lesson'

const SANDPACK_LANGS = new Set(['javascript', 'typescript'])

function PistonRunner({ code, language }: { code: string; language: string }) {
  const [editedCode, setEditedCode] = useState(code)
  const [output, setOutput] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  async function run() {
    setRunning(true)
    try {
      const res = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          version: '*',
          files: [{ content: editedCode }],
        }),
      })
      const data = await res.json()
      setOutput(data.run?.output ?? data.message ?? 'No output')
    } catch {
      setOutput('Error: could not reach execution API')
    }
    setRunning(false)
  }

  return (
    <div>
      <textarea
        value={editedCode}
        onChange={e => setEditedCode(e.target.value)}
        className="w-full font-mono text-sm bg-[#0a0a0a] text-[#cdd6f4] p-4 resize-none focus:outline-none border-b border-border"
        rows={Math.min(editedCode.split('\n').length + 1, 15)}
        spellCheck={false}
      />
      <div className="flex items-center gap-2 px-4 py-2 bg-[#0d0d0d]">
        <button
          onClick={run}
          disabled={running}
          className="bg-green-900 text-green-300 border border-green-700 text-xs font-semibold px-3 py-1.5 rounded hover:bg-green-800 disabled:opacity-50 transition-colors"
        >
          {running ? 'Running...' : '▶ Run'}
        </button>
        <button
          onClick={() => { setEditedCode(code); setOutput(null) }}
          className="bg-muted text-muted-foreground text-xs px-3 py-1.5 rounded hover:bg-muted/80 transition-colors"
        >
          ↺ Reset
        </button>
      </div>
      {output !== null && (
        <div className="bg-black px-4 py-3 font-mono text-sm text-green-400 whitespace-pre-wrap border-t border-border">
          {output || '(no output)'}
        </div>
      )}
    </div>
  )
}

function SandpackRunner({ code, language }: { code: string; language: string }) {
  const [editedCode, setEditedCode] = useState(code)
  const [output, setOutput] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  // For JS/TS we use a simple eval approach in an iframe via Piston too,
  // since Sandpack SSR can be tricky. We'll use Piston for all languages.
  async function run() {
    setRunning(true)
    try {
      const res = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: language === 'typescript' ? 'typescript' : 'javascript',
          version: '*',
          files: [{ content: editedCode }],
        }),
      })
      const data = await res.json()
      setOutput(data.run?.output ?? data.message ?? 'No output')
    } catch {
      setOutput('Error: could not reach execution API')
    }
    setRunning(false)
  }

  return (
    <div>
      <textarea
        value={editedCode}
        onChange={e => setEditedCode(e.target.value)}
        className="w-full font-mono text-sm bg-[#0a0a0a] text-[#cdd6f4] p-4 resize-none focus:outline-none border-b border-border"
        rows={Math.min(editedCode.split('\n').length + 1, 15)}
        spellCheck={false}
      />
      <div className="flex items-center gap-2 px-4 py-2 bg-[#0d0d0d]">
        <button
          onClick={run}
          disabled={running}
          className="bg-green-900 text-green-300 border border-green-700 text-xs font-semibold px-3 py-1.5 rounded hover:bg-green-800 disabled:opacity-50 transition-colors"
        >
          {running ? 'Running...' : '▶ Run'}
        </button>
        <button
          onClick={() => { setEditedCode(code); setOutput(null) }}
          className="bg-muted text-muted-foreground text-xs px-3 py-1.5 rounded hover:bg-muted/80 transition-colors"
        >
          ↺ Reset
        </button>
      </div>
      {output !== null && (
        <div className="bg-black px-4 py-3 font-mono text-sm text-green-400 whitespace-pre-wrap border-t border-border">
          {output || '(no output)'}
        </div>
      )}
    </div>
  )
}

export function CodePlayground({ visual }: { visual: CodeVisual }) {
  const isSandpack = SANDPACK_LANGS.has(visual.language)

  return (
    <div className="rounded-lg border border-green-800/40 bg-green-950/10 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-green-950/30 border-b border-green-800/40">
        <span className="text-sm">▶</span>
        <span className="text-xs font-semibold text-green-300 uppercase tracking-widest">
          Code Playground — {visual.title}
        </span>
        <span className="text-xs bg-green-900/40 text-green-300 px-2 py-0.5 rounded-full border border-green-700/40 ml-auto">
          {visual.language}
        </span>
      </div>
      {isSandpack
        ? <SandpackRunner code={visual.code} language={visual.language} />
        : <PistonRunner code={visual.code} language={visual.language} />}
      {visual.explanation && (
        <p className="px-4 py-3 text-xs text-muted-foreground border-t border-border">
          {visual.explanation}
        </p>
      )}
    </div>
  )
}
