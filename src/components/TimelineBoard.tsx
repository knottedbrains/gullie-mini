import { useEffect, useMemo, useState } from 'react'
import { services } from '../data/services'
import type { AssistantTaskHighlightDetail, ServiceId, TimelineTask } from '../types/timeline'
import { TaskCard } from './TaskCard'

type AnimationHint = 'created' | 'updated' | 'completed' | 'touched'

interface AnimationMap {
  [taskId: string]: {
    type: AnimationHint
    expires: number
  }
}

interface TimelineBoardProps {
  tasks: TimelineTask[]
  selectedServices: ServiceId[]
  highlightedTaskIds: Set<string>
}

export function TimelineBoard({ tasks, selectedServices, highlightedTaskIds }: TimelineBoardProps) {
  const [animationHints, setAnimationHints] = useState<AnimationMap>({})

  const tasksByService = useMemo(() => {
    const grouped = new Map<ServiceId, TimelineTask[]>()
    for (const task of tasks) {
      if (!grouped.has(task.serviceId)) {
        grouped.set(task.serviceId, [])
      }
      grouped.get(task.serviceId)?.push(task)
    }

    for (const list of grouped.values()) {
      list.sort((a, b) => a.sequence - b.sequence)
    }

    return grouped
  }, [tasks])

  useEffect(() => {
    const handleHighlight = (event: Event) => {
      const detail = (event as CustomEvent<AssistantTaskHighlightDetail>).detail
      if (!detail?.ids?.length) return
      const now = Date.now()
      setAnimationHints((prev) => {
        const next: AnimationMap = { ...prev }
        detail.ids.forEach((id) => {
          next[id] = {
            type: detail.action,
            expires: now + (detail.action === 'created' ? 1600 : 1200),
          }
        })
        return next
      })
    }

    window.addEventListener('assistantTaskHighlight', handleHighlight as EventListener)
    return () => window.removeEventListener('assistantTaskHighlight', handleHighlight as EventListener)
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setAnimationHints((prev) => {
        const now = Date.now()
        let changed = false
        const next: AnimationMap = {}
        for (const [taskId, hint] of Object.entries(prev)) {
          if (hint.expires > now) {
            next[taskId] = hint
          } else {
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 250)

    return () => window.clearInterval(interval)
  }, [])

  const activeServices = selectedServices
    .map((id) => services.find((service) => service.id === id))
    .filter((service): service is (typeof services)[number] => Boolean(service))

  if (!activeServices.length) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-6 text-center text-slate-500 shadow-sm">
        No active services yet. Ask the assistant about immigration, housing, or shipping to kick things off.
      </section>
    )
  }

  return (
    <div className="relative pl-6">
      <span className="pointer-events-none absolute left-[24px] top-0 bottom-0 w-[2px] bg-white/25" />
      <div className="space-y-12">
        {activeServices.map((service, serviceIndex) => {
          const serviceTasks = tasksByService.get(service.id) ?? []
          const isFirst = serviceIndex === 0
          const isLast = serviceIndex === activeServices.length - 1

          return (
            <section key={service.id} className="grid grid-cols-[48px,1fr] items-start gap-6">
              <div className="relative min-h-[16px] pt-2">
                {!isFirst && (
                  <span className="pointer-events-none absolute left-1/2 top-0 bottom-1/2 w-[2px] -translate-x-1/2 bg-white/80" />
                )}
                {!isLast && (
                  <span className="pointer-events-none absolute left-1/2 top-1/2 bottom-0 w-[2px] -translate-x-1/2 bg-white/80" />
                )}
                <span
                  className="pointer-events-none absolute left-1/2 top-2 z-10 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: service.accentColor }}
                />
              </div>

            <div className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm backdrop-blur">
              <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                    style={{ backgroundImage: `linear-gradient(135deg, ${service.accentColor}, #1e293b)` }}
                  >
                    <service.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{service.label}</h2>
                    <p className="text-sm text-slate-500">{service.description}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {serviceTasks.length} task{serviceTasks.length === 1 ? '' : 's'}
                </span>
              </header>

              <div className="mt-6 space-y-4">
                {serviceTasks.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No tasks yet. Ask the voice assistant for next steps around this service.
                  </p>
                ) : (
                  serviceTasks.map((task, index) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      accentColor={service.accentColor}
                      highlighted={highlightedTaskIds.has(task.id)}
                      animationHint={animationHints[task.id]?.type}
                      animationDelay={(serviceIndex * 4 + index) * 70}
                    />
                  ))
                )}
              </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
