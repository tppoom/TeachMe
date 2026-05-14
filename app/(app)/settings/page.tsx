'use client'
import { useEffect, useState } from 'react'

interface Provider {
  id: string
  label: string
  note: string
  badge?: string
  keyKind?: 'anthropic' | 'openai' | 'gemini'
  cliCmd?: string
  setupSteps?: string[]
  docsUrl?: string
}

const CLI_PROVIDERS: Provider[] = [
  {
    id: 'claude-code',
    label: 'Claude Code CLI',
    note: 'Runs the `claude` command locally — no API key needed.',
    cliCmd: 'claude',
    setupSteps: [
      'Install Node.js 18+ if not already installed.',
      'Run: npm install -g @anthropic-ai/claude-code',
      'Authenticate: claude (follow the login prompt on first run)',
      'Verify: claude --version',
    ],
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-code',
  },
  {
    id: 'gemini-cli',
    label: 'Gemini CLI',
    note: 'Runs the `gemini` command locally — no API key needed.',
    badge: 'Recommended',
    cliCmd: 'gemini',
    setupSteps: [
      'Install Node.js 18+ if not already installed.',
      'Run: npm install -g @google/gemini-cli',
      'Authenticate: gemini (follow the Google login on first run)',
      'Verify: gemini --version',
    ],
    docsUrl: 'https://github.com/google-gemini/gemini-cli',
  },
  {
    id: 'codex-cli',
    label: 'Codex CLI',
    note: 'Runs the `codex` command locally — no API key needed.',
    cliCmd: 'codex',
    setupSteps: [
      'Install Node.js 18+ if not already installed.',
      'Run: npm install -g @openai/codex',
      'Authenticate: codex (follow the OpenAI login on first run)',
      'Verify: codex --version',
    ],
    docsUrl: 'https://github.com/openai/codex',
  },
]

const API_PROVIDERS: Provider[] = [
  { id: 'anthropic', label: 'Claude (Anthropic API)', note: 'Uses your Anthropic API key.', keyKind: 'anthropic' },
  { id: 'openai',    label: 'ChatGPT (OpenAI API)',   note: 'Uses your OpenAI API key.',     keyKind: 'openai'    },
  { id: 'gemini',    label: 'Gemini (Google API)',    note: 'Uses your Google API key.',     keyKind: 'gemini'    },
]

const CLI_IDS = CLI_PROVIDERS.map(p => p.id)

interface Status {
  activeProvider: string
  hasAnthropicKey: boolean
  hasOpenaiKey: boolean
  hasGeminiKey: boolean
  cliAvailable: Record<string, boolean>
}

function ChevronDown() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  )
}

export default function SettingsPage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({})
  const [keyVisible, setKeyVisible] = useState<Record<string, boolean>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [openSetup, setOpenSetup] = useState<string | null>(null)

  async function refresh() {
    const d = await fetch('/api/settings').then(r => r.json())
    setStatus(d)
  }

  useEffect(() => { refresh() }, [])

  async function handleSetProvider(id: string, disabled: boolean) {
    if (disabled) return
    setStatus(s => s ? { ...s, activeProvider: id } : s)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeProvider: id }),
    })
  }

  async function saveKey(kind: 'anthropic' | 'openai' | 'gemini') {
    const value = (keyInputs[kind] ?? '').trim()
    if (!value) return
    setBusyKey(kind)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, value }),
    })
    setKeyInputs(k => ({ ...k, [kind]: '' }))
    await refresh()
    setBusyKey(null)
  }

  async function clearKey(kind: 'anthropic' | 'openai' | 'gemini') {
    setBusyKey(kind)
    await fetch(`/api/settings?kind=${kind}`, { method: 'DELETE' })
    await refresh()
    setBusyKey(null)
  }

  function hasKey(p: Provider): boolean {
    if (!status) return false
    if (p.keyKind === 'anthropic') return status.hasAnthropicKey
    if (p.keyKind === 'openai') return status.hasOpenaiKey
    if (p.keyKind === 'gemini') return status.hasGeminiKey
    return true
  }

  function isUsable(p: Provider): boolean {
    if (!status) return false
    if (CLI_IDS.includes(p.id)) return status.cliAvailable?.[p.id] ?? false
    return hasKey(p)
  }

  function ProviderRow({ p, disabled }: { p: Provider; disabled: boolean }) {
    const active = status?.activeProvider === p.id
    const isCli = CLI_IDS.includes(p.id)
    const installed = isCli ? (status?.cliAvailable?.[p.id] ?? false) : null
    const keyOk = hasKey(p)
    const kind = p.keyKind!
    const visible = !!keyVisible[kind]
    const busy = busyKey === kind
    const showSetup = openSetup === p.id

    return (
      <div className="space-y-2">
        <div
          onClick={() => handleSetProvider(p.id, disabled)}
          className="flex items-center gap-4 px-4 py-3.5 rounded-[10px] transition-all duration-150"
          style={{
            background: active ? 'var(--bg-sunken)' : 'transparent',
            border: '1px solid',
            borderColor: active ? 'var(--border-strong)' : 'transparent',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.45 : 1,
          }}
          onMouseEnter={e => { if (!active && !disabled) (e.currentTarget as HTMLElement).style.background = 'var(--bg-sunken)' }}
          onMouseLeave={e => { if (!active && !disabled) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          <div
            className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center transition-all"
            style={{
              border: active ? '5px solid var(--fg)' : '1.5px solid var(--border-strong)',
              background: active ? 'var(--fg)' : 'transparent',
            }}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{p.label}</span>
              {p.badge && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  {p.badge}
                </span>
              )}
              {isCli && installed === true && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                  Installed
                </span>
              )}
              {isCli && installed === false && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                  Not installed
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--fg-4)' }}>{p.note}</p>
          </div>

          {!isCli && (
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
              style={keyOk
                ? { background: 'var(--success-bg)', color: 'var(--success)' }
                : { background: 'var(--bg-sunken)', color: 'var(--fg-4)', border: '1px solid var(--border)' }
              }
            >
              {keyOk ? 'Key set' : 'Add key'}
            </span>
          )}
        </div>

        {/* CLI setup instructions */}
        {isCli && installed === false && (
          <div className="ml-9 mr-1">
            <button
              onClick={() => setOpenSetup(showSetup ? null : p.id)}
              className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-[7px] transition-all"
              style={{ color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid transparent' }}
            >
              <span>How to install</span>
              <span style={{ transform: showSetup ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <ChevronDown />
              </span>
            </button>
            {showSetup && p.setupSteps && (
              <div className="mt-2 px-4 py-3 rounded-[10px] space-y-1.5" style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border)' }}>
                {p.setupSteps.map((step, i) => (
                  <div key={i} className="flex gap-2.5 text-[12.5px]" style={{ color: 'var(--fg-2)' }}>
                    <span className="flex-shrink-0 font-mono text-[11px] w-4 mt-0.5" style={{ color: 'var(--fg-4)' }}>{i + 1}.</span>
                    <code className="leading-[1.6]" style={{ fontFamily: 'var(--font-jetbrains, ui-monospace, monospace)' }}>{step}</code>
                  </div>
                ))}
                {p.docsUrl && (
                  <a
                    href={p.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11.5px] mt-1"
                    style={{ color: 'var(--accent)' }}
                  >
                    Official docs <ExternalLinkIcon />
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* API key row */}
        {!isCli && (
          <div className="ml-9 mr-1" onClick={e => e.stopPropagation()}>
            {keyOk ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-[8px]" style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border)' }}>
                <span className="text-[12px]" style={{ color: 'var(--fg-3)' }}>Saved · stored encrypted on this machine</span>
                <button
                  onClick={() => clearKey(kind)}
                  disabled={busy}
                  className="text-[12px] px-2 py-1 rounded-[6px]"
                  style={{ color: 'var(--danger)', background: 'transparent' }}
                >
                  {busy ? '…' : 'Remove'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type={visible ? 'text' : 'password'}
                  value={keyInputs[kind] ?? ''}
                  onChange={e => setKeyInputs(k => ({ ...k, [kind]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') saveKey(kind) }}
                  placeholder={kind === 'openai' ? 'sk-…' : kind === 'anthropic' ? 'sk-ant-…' : 'AIza…'}
                  disabled={busy}
                  className="flex-1 text-[13px] px-3 py-2 rounded-[8px]"
                  style={{
                    background: 'var(--bg-elev)', color: 'var(--fg)',
                    border: '1px solid var(--border)', outline: 'none',
                    fontFamily: 'var(--font-jetbrains, ui-monospace, monospace)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setKeyVisible(v => ({ ...v, [kind]: !v[kind] }))}
                  className="text-[12px] px-2 py-1.5 rounded-[6px]"
                  style={{ color: 'var(--fg-3)', border: '1px solid var(--border)', background: 'var(--bg-elev)' }}
                >
                  {visible ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => saveKey(kind)}
                  disabled={busy || !(keyInputs[kind] ?? '').trim()}
                  className="text-[12px] px-3 py-1.5 rounded-[6px] font-medium"
                  style={{
                    background: !(keyInputs[kind] ?? '').trim() ? 'var(--bg-sunken)' : 'var(--accent)',
                    color: !(keyInputs[kind] ?? '').trim() ? 'var(--fg-4)' : 'var(--accent-fg)',
                    border: '1px solid',
                    borderColor: !(keyInputs[kind] ?? '').trim() ? 'var(--border)' : 'var(--accent)',
                  }}
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  function GroupHeader({ label, hint }: { label: string; hint: string }) {
    return (
      <div className="px-4 pt-1 pb-1.5 flex items-baseline gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--fg-3)' }}>{label}</p>
        <p className="text-[11px]" style={{ color: 'var(--fg-4)' }}>{hint}</p>
      </div>
    )
  }

  const activeProvider = status?.activeProvider ?? 'none'
  const noProviderSelected = !status || activeProvider === 'none'
  const activeIsUsable = status ? isUsable({ id: activeProvider } as Provider) : false

  return (
    <div className="px-8 py-10 mx-auto" style={{ maxWidth: 680 }}>
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--fg-4)' }}>Configuration</p>
        <h1 className="text-[32px] font-medium leading-[1.1] tracking-[-0.018em]" style={{ fontFamily: 'var(--font-general-sans, system-ui)', color: 'var(--fg)' }}>
          Settings
        </h1>
      </div>

      {/* Warning banner if no usable provider */}
      {status && (noProviderSelected || !activeIsUsable) && (
        <div
          className="mb-6 px-4 py-3.5 rounded-[12px] flex items-start gap-3"
          style={{ background: 'var(--warning-soft)', border: '1px solid var(--warning)', color: 'var(--warning)' }}
        >
          <span className="text-[16px] flex-shrink-0 mt-0.5">⚠</span>
          <div>
            <p className="text-[13px] font-semibold">No AI provider ready</p>
            <p className="text-[12.5px] mt-0.5 leading-[1.5]" style={{ opacity: 0.85 }}>
              {noProviderSelected
                ? 'Select an AI provider below before generating courses.'
                : 'The selected provider is not available. Install the CLI or add an API key.'}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-[14px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-elev)' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>AI Provider</p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--fg-3)' }}>
            Choose which AI generates your courses and answers tutor questions.
          </p>
        </div>

        {/* None option */}
        <div className="px-3 pt-3">
          <div
            onClick={() => handleSetProvider('none', false)}
            className="flex items-center gap-4 px-4 py-3 rounded-[10px] cursor-pointer transition-all duration-150"
            style={{
              background: activeProvider === 'none' ? 'var(--bg-sunken)' : 'transparent',
              border: '1px solid',
              borderColor: activeProvider === 'none' ? 'var(--border-strong)' : 'transparent',
            }}
            onMouseEnter={e => { if (activeProvider !== 'none') (e.currentTarget as HTMLElement).style.background = 'var(--bg-sunken)' }}
            onMouseLeave={e => { if (activeProvider !== 'none') (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ border: activeProvider === 'none' ? '5px solid var(--fg)' : '1.5px solid var(--border-strong)' }}
            />
            <div>
              <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>None</span>
              <p className="text-xs mt-0.5" style={{ color: 'var(--fg-4)' }}>No provider selected — course generation will be disabled.</p>
            </div>
          </div>
        </div>

        <div className="px-3 pt-3">
          <GroupHeader label="Local CLI" hint="No API key — runs the command on this machine" />
          <div className="space-y-1">
            {CLI_PROVIDERS.map(p => {
              const installed = status?.cliAvailable?.[p.id] ?? false
              return <ProviderRow key={p.id} p={p} disabled={!installed} />
            })}
          </div>
        </div>

        <div className="px-6 py-3">
          <div style={{ height: 1, background: 'var(--border)' }} />
        </div>

        <div className="px-3 pb-3">
          <GroupHeader label="Remote API" hint="Add your API key — stored encrypted on this machine" />
          <div className="space-y-3">
            {API_PROVIDERS.map(p => {
              const keyOk = hasKey(p)
              return <ProviderRow key={p.id} p={p} disabled={!keyOk} />
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
