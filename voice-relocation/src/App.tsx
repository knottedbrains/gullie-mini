import { useEffect, useMemo, useState } from 'react'
import { ServiceSelector } from './components/ServiceSelector'
import { TimelineBoard } from './components/TimelineBoard'
import { FloatingAssistant } from './components/FloatingAssistant'
import { useTimelineState } from './hooks/useTimelineState'
import { services } from './data/services'
import type { AssistantTaskHighlightDetail } from './types/timeline'
import { useVoiceTimeline } from './hooks/useVoiceTimeline'

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
    toggleService,
    visibleTasks,
    setSelectedServices,
    replaceTasks,
    upsertTask,
    updateTaskStatus,
  } = useTimelineState()
  const highlightedTaskIds = useAssistantHighlights()
  const voice = useVoiceTimeline({
    selectedServices,
    setSelectedServices,
    tasks,
    replaceTasks,
    upsertTask,
    updateTaskStatus,
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-slate-100">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-6 pb-28 pt-16">
        <section className="rounded-3xl relative overflow-hidden bg-white p-10 shadow-lg">
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-semibold text-slate-950 sm:text-5xl">
                Relocation timeline, tuned for real-time voice guidance.
              </h1>
              <p className="mt-4 text-lg text-slate-600">
                Track every service milestone, hear instant status changes, and keep your family ready for move day.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white/60 px-5 py-4 text-sm text-slate-500 shadow-sm backdrop-blur">
              Voice agent is standing by. Say “Show me housing tasks” to see the filters update.
            </div>
          </div>
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-br from-sky-100/40 via-transparent to-transparent md:block"
          />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-3 pb-6">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Services
            </span>
            <h2 className="text-2xl font-semibold text-slate-900">Focus the timeline by service</h2>
            <p className="max-w-2xl text-sm text-slate-500">
              Toggle the services you want to review. The assistant automatically syncs these selections when it confirms changes.
            </p>
          </div>
          <ServiceSelector
            services={services}
            selected={selectedServices}
            onToggle={toggleService}
          />
        </section>

        <section className="relative">
          <div className="pointer-events-none absolute -top-12 left-1/2 h-32 w-full -translate-x-1/2 rounded-full bg-sky-100 blur-3xl" />
          <TimelineBoard
            tasks={visibleTasks}
            selectedServices={selectedServices}
            highlightedTaskIds={highlightedTaskIds}
          />
        </section>
      </main>
      <FloatingAssistant voice={voice} />
    </div>
  )
}

export default App
