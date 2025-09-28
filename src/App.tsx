import { useEffect, useMemo, useState } from 'react'
import { FloatingAssistant } from './components/FloatingAssistant'
import { TimelineBoard } from './components/TimelineBoard'
import { RelocationSummaryCard } from './components/RelocationSummaryCard'
import { useTimelineState } from './hooks/useTimelineState'
import type { AssistantTaskHighlightDetail } from './types/timeline'
import { useVoiceTimeline } from './hooks/useVoiceTimeline'
import { services } from './data/services'

function useAssistantHighlights(duration = 2400) {
  const [highlights, setHighlights] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    const handleHighlight = (event: Event) => {
      const detail = (event as CustomEvent<AssistantTaskHighlightDetail>).detail
      if (!detail?.ids?.length) {
        return
      }
      setHighlights((prev) => {
        const next = new Map(prev)
        const expiry = Date.now() + duration
        detail.ids.forEach((id) => next.set(id, expiry))
        return next
      })
    }

    window.addEventListener('assistantTaskHighlight', handleHighlight as EventListener)
    return () => {
      window.removeEventListener('assistantTaskHighlight', handleHighlight as EventListener)
    }
  }, [duration])

  useEffect(() => {
    if (!highlights.size) {
      return
    }

    const interval = window.setInterval(() => {
      setHighlights((prev) => {
        const now = Date.now()
        let changed = false
        const next = new Map(prev)
        for (const [id, expiry] of next) {
          if (expiry <= now) {
            next.delete(id)
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 250)

    return () => window.clearInterval(interval)
  }, [highlights])

  return useMemo(() => new Set(Array.from(highlights.keys())), [highlights])
}

function App() {
  const {
    tasks,
    selectedServices,
    visibleTasks,
    setSelectedServices,
    replaceTasks,
    upsertTask,
    updateTaskStatus,
    buildServiceTasks,
    relocationProfile,
    setRelocationProfile,
  } = useTimelineState()
  const highlightedTaskIds = useAssistantHighlights()
  const voice = useVoiceTimeline({
    selectedServices,
    setSelectedServices,
    tasks,
    replaceTasks,
    upsertTask,
    updateTaskStatus,
    buildServiceTasks,
    relocationProfile,
    setRelocationProfile,
  })

  const showTimeline = selectedServices.length > 0 || tasks.length > 0

  const activeServiceLabels = useMemo(() => {
    if (!selectedServices.length) {
      return []
    }
    const active = new Set(selectedServices)
    return services.filter((service) => active.has(service.id)).map((service) => service.label)
  }, [selectedServices])

  const handleStartVoice = async () => {
    if (voice.phase === 'idle') {
      await voice.start()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-6 pb-32 pt-20">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/10 px-8 py-10 shadow-[0_20px_50px_-25px_rgba(15,23,42,0.45)] backdrop-blur-md">
          <div className="relative z-10 flex flex-col items-center gap-6 text-center">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-sky-300/80">Gullie Mini</p>
              <h1 className="text-3xl font-semibold text-white sm:text-4xl">Relocation copilot</h1>
              <p className="mx-auto max-w-xl text-sm text-slate-200/90">
                Describe your move and we’ll build the timeline, line up services, and keep everything on schedule.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartVoice}
              className="inline-flex items-center gap-3 rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
              Talk to us
            </button>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-8 bottom-0 h-28 rounded-t-full bg-sky-500/20 blur-3xl"
          />
        </section>

        <section className="space-y-6">
          <RelocationSummaryCard profile={relocationProfile} activeServices={activeServiceLabels} />
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-300/60">Timeline</p>
            {showTimeline ? (
              <div className="mt-4">
                <TimelineBoard tasks={visibleTasks} highlightedTaskIds={highlightedTaskIds} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                Ask the voice assistant about immigration, housing, shipping, or other relocation topics to activate your cards.
              </p>
            )}
          </div>
        </section>
      </main>
      <FloatingAssistant voice={voice} />
    </div>
  )
}

export default App
