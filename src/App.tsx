import { useEffect, useMemo, useState } from 'react'
import { FloatingAssistant } from './components/FloatingAssistant'
import { TimelineBoard } from './components/TimelineBoard'
import { useTimelineState } from './hooks/useTimelineState'
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
  const originLabel = relocationProfile.fromCity ?? 'Your origin'
  const destinationLabel = relocationProfile.toCity ?? 'Your destination'

  const handleStartVoice = async () => {
    if (voice.phase === 'idle') {
      await voice.start()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-6 pb-32 pt-20">
        <section className="relative overflow-hidden rounded-4xl border border-white/5 bg-white/5 px-10 py-14 shadow-[0_30px_60px_-30px_rgba(15,23,42,0.45)] backdrop-blur-lg">
          <div className="relative z-10 flex flex-col gap-10 text-center">
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.25em] text-sky-300/80">Gullie Move OS</p>
              <h1 className="text-4xl font-semibold text-white sm:text-5xl">
                Your relocation copilot
              </h1>
              <p className="mx-auto max-w-2xl text-base text-slate-200/90">
                Summon the voice assistant and describe your move. Gullie listens, builds a personal timeline, and keeps your tasks on track as you speak.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={handleStartVoice}
                className="inline-flex items-center gap-3 rounded-full bg-sky-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                <span className="inline-flex h-3 w-3 animate-pulse rounded-full bg-white" />
                Speak to the voice assistant
              </button>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-300/80">
                Starts from an empty timeline — adds services and steps as you narrate your journey
              </p>
            </div>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-10 bottom-0 h-40 rounded-t-full bg-sky-500/30 blur-3xl"
          />
        </section>

        {showTimeline ? (
          <section className="space-y-6">
            <header className="flex flex-col gap-4 rounded-4xl border border-white/10 bg-white/5 px-8 py-6 text-slate-100 shadow-inner shadow-black/20 backdrop-blur">
              <div className="flex flex-col items-center gap-4 text-center">
                <span className="text-xs uppercase tracking-[0.35em] text-sky-300/80">Relocation Route</span>
                <div className="flex items-center gap-3 text-2xl font-semibold text-white">
                  <span>{originLabel}</span>
                  <span className="text-sky-300">→</span>
                  <span>{destinationLabel}</span>
                </div>
                {relocationProfile.moveDate ? (
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
                    Target move date · {new Date(relocationProfile.moveDate).toLocaleDateString()}
                  </p>
                ) : null}
              </div>
            </header>

            <TimelineBoard
              tasks={visibleTasks}
              selectedServices={selectedServices}
              highlightedTaskIds={highlightedTaskIds}
              relocationProfile={relocationProfile}
            />
          </section>
        ) : (
          <section className="rounded-4xl border border-dashed border-white/10 bg-white/5 px-10 py-16 text-center text-slate-200 shadow-inner shadow-black/20 backdrop-blur">
            <div className="mx-auto max-w-2xl space-y-6">
              <h2 className="text-2xl font-semibold text-white">Ready when you are</h2>
              <p className="text-base text-slate-300/90">
                Tell Gullie what you are working on — immigration, housing, schools, or shipping. The assistant will select the right services, generate the next steps, and check things off as you confirm progress.
              </p>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400/80">
                Tap “Speak to the voice assistant” to begin
              </p>
            </div>
          </section>
        )}
      </main>
      <FloatingAssistant voice={voice} />
    </div>
  )
}

export default App
