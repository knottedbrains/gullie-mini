import { useEffect, useMemo, useState } from 'react'
import { Headphones, Mic, MicOff, Pause, Play, Waves } from 'lucide-react'
import { clsx } from 'clsx'
import type { AssistantUiMessageDetail } from '../types/timeline'
import type { UseVoiceTimelineResult, VoiceConnectionPhase, VoiceEvent } from '../hooks/useVoiceTimeline'

type DerivedPhase = VoiceConnectionPhase | 'assistant_speaking'
type ConversationEntry = { id: string; role: string; content: string; live?: boolean }

function derivePhaseAndTranscript(events: VoiceEvent[]): { phase: DerivedPhase; transcript: string } {
  if (!events.length) {
    return { phase: 'idle', transcript: '' }
  }
  const reversed = [...events].reverse()
  const findText = (types: string[]) => {
    const match = reversed.find((event) => types.includes((event.payload?.type as string) ?? ''))
    if (!match) return ''
    const payload = match.payload
    return (
      (payload?.text as string | undefined) ??
      (payload?.transcript as string | undefined) ??
      (payload?.delta as string | undefined) ??
      ''
    )
  }

  let transcript =
    findText(['response.audio_transcript.done']) ||
    findText(['response.output_text.done']) ||
    findText(['response.audio_transcript.delta']) ||
    ''

  let phase: DerivedPhase = 'idle'
  for (const event of reversed) {
    const type = (event.payload?.type as string) ?? ''
    if (
      type === 'response.function_call' ||
      type === 'response.tool_call' ||
      type === 'response.function_call_arguments.delta' ||
      type === 'response.function_call_arguments.done' ||
      type === 'response.tool_call_arguments.delta' ||
      type === 'response.tool_call_arguments.done'
    ) {
      phase = 'function'
      break
    }
    if (type === 'response.output_audio_buffer.started') {
      phase = 'assistant_speaking'
      break
    }
    if (type === 'response.created') {
      phase = 'thinking'
      break
    }
    if (
      type === 'response.input_audio_transcription.delta' ||
      type === 'response.input_text.delta' ||
      type === 'input_audio_buffer.speech_started'
    ) {
      phase = 'listening'
      break
    }
  }

  return { phase, transcript: transcript.trim() }
}

interface FloatingAssistantProps {
  voice: UseVoiceTimelineResult
}

export function FloatingAssistant({ voice }: FloatingAssistantProps) {
  const [statusEvents, setStatusEvents] = useState<AssistantUiMessageDetail[]>([])
  const [isCollapsed, setCollapsed] = useState(true)

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AssistantUiMessageDetail>).detail
      if (!detail) return
      setStatusEvents((prev) => [detail, ...prev].slice(0, 1))
    }
    window.addEventListener('assistantUiMessage', handler as EventListener)
    return () => window.removeEventListener('assistantUiMessage', handler as EventListener)
  }, [])

  const { phase: derivedPhase, transcript: liveTranscript } = useMemo(
    () => derivePhaseAndTranscript(voice.events),
    [voice.events],
  )

  const phaseLabel = useMemo(() => {
    if (derivedPhase === 'assistant_speaking') {
      return 'Speaking'
    }
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
  }, [voice.phase, derivedPhase])

  const latestStoredMessage = useMemo<ConversationEntry | null>(() => {
    if (!voice.messages.length) {
      return null
    }
    const last = voice.messages[voice.messages.length - 1]
    const content = last.content.trim()
    if (!content) {
      return null
    }
    return {
      id: last.id,
      role: last.role === 'assistant' ? 'Assistant' : 'You',
      content,
    }
  }, [voice.messages])

  const latestConversationItem = useMemo<ConversationEntry | null>(() => {
    const trimmed = liveTranscript.trim()
    if (trimmed) {
      if (latestStoredMessage && latestStoredMessage.content === trimmed) {
        return latestStoredMessage
      }
      return {
        id: 'live-transcript',
        role: derivedPhase === 'assistant_speaking' ? 'Assistant (live)' : 'Assistant',
        content: trimmed,
        live: true,
      }
    }
    return latestStoredMessage
  }, [liveTranscript, derivedPhase, latestStoredMessage])

  const isActive = voice.phase !== 'idle' && voice.phase !== 'error'
  const latestStatus = statusEvents[0]

  useEffect(() => {
    if (isActive) {
      setCollapsed(false)
    }
  }, [isActive])

  const handleToggle = async () => {
    if (isActive) {
      voice.stop()
    } else {
      await voice.start()
    }
  }

  if (isCollapsed) {
    return (
      <aside className="pointer-events-none fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
        >
          <Mic className="h-6 w-6" />
        </button>
      </aside>
    )
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
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              aria-label="Collapse assistant"
            >
              <span className="text-lg leading-none">×</span>
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
              {latestStatus ? (
                <li key={latestStatus.timestamp} className="flex items-center gap-2 text-slate-600">
                  <Headphones className="h-3.5 w-3.5 text-slate-400" />
                  <span>{latestStatus.message}</span>
                </li>
              ) : (
                <li className="text-slate-400">No system updates yet.</li>
              )}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Conversation</p>
            <ul className="space-y-2 text-sm text-slate-600">
              {latestConversationItem ? (
                <li
                  key={latestConversationItem.id}
                  className={clsx(
                    'rounded-2xl px-3 py-2',
                    latestConversationItem.live
                      ? 'border border-sky-200 bg-sky-50'
                      : 'bg-slate-100',
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {latestConversationItem.role}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-slate-700">{latestConversationItem.content}</p>
                </li>
              ) : (
                <li className="text-slate-400">Say hello to start the transcript.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </aside>
  )
}
