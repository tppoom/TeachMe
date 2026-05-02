'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface SettingsState {
  hasAnthropicKey: boolean
  hasOpenaiKey: boolean
  activeProvider: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState | null>(null)
  const [anthropicKey, setAnthropicKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function loadSettings() {
    const data = await fetch('/api/settings').then(r => r.json())
    setSettings(data)
  }

  useEffect(() => { loadSettings() }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anthropicKey: anthropicKey || undefined,
        openaiKey: openaiKey || undefined,
      }),
    })
    await loadSettings()
    setAnthropicKey('')
    setOpenaiKey('')
    setMessage('Keys saved.')
    setSaving(false)
  }

  async function handleSetProvider(provider: string) {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeProvider: provider }),
    })
    setSettings(s => s ? { ...s, activeProvider: provider } : s)
  }

  async function handleDelete(provider: string) {
    await fetch('/api/settings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    })
    await loadSettings()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>API Keys (BYOK)</CardTitle>
          <CardDescription>
            Your keys are encrypted with AES-256-GCM and never exposed after saving.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Anthropic (Claude)</Label>
                {settings?.hasAnthropicKey && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Saved</Badge>
                    <button type="button" onClick={() => handleDelete('anthropic')}
                      className="text-xs text-destructive hover:underline">Remove</button>
                  </div>
                )}
              </div>
              <Input type="password" placeholder="sk-ant-..." value={anthropicKey}
                onChange={e => setAnthropicKey(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>OpenAI</Label>
                {settings?.hasOpenaiKey && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Saved</Badge>
                    <button type="button" onClick={() => handleDelete('openai')}
                      className="text-xs text-destructive hover:underline">Remove</button>
                  </div>
                )}
              </div>
              <Input type="password" placeholder="sk-..." value={openaiKey}
                onChange={e => setOpenaiKey(e.target.value)} />
            </div>
            {message && <p className="text-sm text-green-500">{message}</p>}
            <Button type="submit" disabled={saving || (!anthropicKey && !openaiKey)}>
              {saving ? 'Saving...' : 'Save Keys'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Provider</CardTitle>
          <CardDescription>Choose which AI powers your lessons.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          {(['anthropic', 'openai'] as const).map(p => (
            <Button key={p} variant={settings?.activeProvider === p ? 'default' : 'outline'}
              onClick={() => handleSetProvider(p)}>
              {p === 'anthropic' ? 'Claude (Anthropic)' : 'OpenAI GPT-4o'}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
