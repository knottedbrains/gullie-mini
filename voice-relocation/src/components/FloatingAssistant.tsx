import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Headphones, Mic, MicOff, Pause, Play, Waves } from 'lucide-react'
import { clsx } from 'clsx'
import type { AssistantUiMessageDetail } from '../types/timeline'
import type { UseVoiceTimelineResult } from '../hooks/useVoiceTimeline'

interface FloatingAssistantProps {
  voice: UseVoiceTimelineResult
}

export function FloatingAssistant({ voice }: FloatingAssistantProps) {
  const [statusEvents, setStatusEvents] = useState<AssistantUiMessageDetail[]>([])
  const [userTranscripts, setUserTranscripts] = useState<string[]>([])
  const [draft, setDraft] = useState('')

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AssistantUiMessageDetail>).detail
      if (!detail) return
      setStatusEvents((prev) => [detail, ...prev].slice(0, 4))
    }
    window.addEventListener('assistantUiMessage', handler as EventListener)
    return () => window.removeEventListener('assistantUiMessage', handler as EventListener)
  }, [])

  const phaseLabel = useMemo(() => {
    switch (voice.phase) {
      case 'idle':
        return 'Idle'
      case 'connecting':
        return 'Connecting'
      case 'listening':
        return 'Listening'
      case 'thinking':
        return 'Thinking'
      case 'function':
        return 'Calling tools'
      case 'error':
        return 'Error'
      default:
        return 'Idle'
    }
  }, [voice.phase])

  const isActive = voice.phase !== 'idle' && voice.phase !== 'error'

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) return
    setUserTranscripts((prev) => [draft.trim(), ...prev].slice(0, 3))
    setDraft('')
  }

  const handleToggle = async () => {
    if (isActive) {
      voice.stop()
    } else {
      await voice.start()
    }
  }

  return (
    <aside className="pointer-events-none fixed bottom-6 right-6 z-50 w-full max-w-xs sm:max-w-sm">
      <div className="pointer-events-auto overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className={clsx(
                'flex h-10 w-10 items-center justify-center rounded-2xl text-white',
                voice.isConnected ? 'bg-sky-500' : 'bg-slate-500',
              )}
            >
              <Waves className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Voice assistant</p>
              <p className="text-xs text-slate-500">{phaseLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggle}
              className={clsx(
                'flex h-9 w-9 items-center justify-center rounded-full border text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300',
                isActive ? 'border-slate-300' : 'border-slate-200',
              )}
            >
              {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={voice.toggleMute}
              disabled={!voice.isConnected}
              className={clsx(
                'flex h-9 w-9 items-center justify-center rounded-full border text-slate-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300',
                voice.isConnected ? 'hover:bg-slate-50 border-slate-200' : 'border-slate-100 opacity-50',
              )}
            >
              {voice.isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          </div>
        </header>
        <div className="flex flex-col gap-4 px-5 py-4">
          {voice.error ? (
            <p className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {voice.error}
            </p>
          ) : null}

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recent updates</p>
            <ul className="space-y-2 text-sm text-slate-600">
              {statusEvents.length === 0 ? (
                <li className="text-slate-400">No system updates yet.</li>
              ) : (
                statusEvents.map((event) => (
                  <li key={event.timestamp} className="flex items-center gap-2">
                    <Headphones className="h-3.5 w-3.5 text-slate-400" />
                    <span>{event.message}</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assistant transcript</p>
            <ul className="space-y-2 text-sm text-slate-600">
              {voice.messages.length === 0 ? (
                <li className="text-slate-400">No responses yet.</li>
              ) : (
                voice.messages
                  .slice(-4)
                  .reverse()
                  .map((message) => (
                    <li key={message.id} className="rounded-2xl bg-slate-100 px-3 py-2">
                      {message.content}
                    </li>
                  ))
              )}
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="assistant-draft">
              Try a text prompt
            </label>
            <input
              id="assistant-draft"
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="e.g. Highlight immigration tasks"
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
            <div className="flex items-center justify-between">
              <button
                type="submit"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Queue prompt
              </button>
              <span className="text-xs text-slate-400">Sends as a note (demo only)</span>
            </div>
          </form>

          {userTranscripts.length ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Queued prompts</p>
              <ul className="space-y-1 text-sm text-slate-500">
                {userTranscripts.map((entry, index) => (
                  <li key={`${entry}-${index}`} className="rounded-xl border border-slate-200 px-3 py-2">
                    {entry}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
