import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'
import { services } from '../data/services'
import type { AssistantTaskHighlightDetail, RelocationProfile, ServiceId, TimelineTask } from '../types/timeline'
import { TaskCard } from './TaskCard'
import { RelocationSummaryCard } from './RelocationSummaryCard'

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
  relocationProfile: RelocationProfile
}

export function TimelineBoard({ tasks, selectedServices, highlightedTaskIds, relocationProfile }: TimelineBoardProps) {
  const [expandedServices, setExpandedServices] = useState<ServiceId[]>(selectedServices)
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
    setExpandedServices((prev) => {
      const set = new Set(prev)
      selectedServices.forEach((id) => set.add(id))
      return Array.from(set)
    })
  }, [selectedServices])

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

  const toggleServiceExpansion = (serviceId: ServiceId) => {
    setExpandedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId],
    )
  }

  const activeServices = services.filter((service) => selectedServices.includes(service.id))

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <RelocationSummaryCard profile={relocationProfile} activeServices={activeServices.map((service) => service.label)} />
      {activeServices.map((service) => {
        const serviceTasks = tasksByService.get(service.id) ?? []
        const isExpanded = expandedServices.includes(service.id)

        return (
          <section
            key={service.id}
            className="relative rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur"
          >
            <header className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                  style={{ backgroundImage: `linear-gradient(135deg, ${service.accentColor}, #1e293b)` }}
                >
                  <service.icon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {service.label}
                  </h2>
                  <p className="text-sm text-slate-500">{service.description}</p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                {serviceTasks.length} task{serviceTasks.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => toggleServiceExpansion(service.id)}
                className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                <ChevronDown className={clsx('h-4 w-4 transition-transform', isExpanded ? 'rotate-180' : '')} />
              </button>
            </header>
            <div
              className={clsx(
                'mt-6 grid gap-4 transition-all duration-500 ease-out',
                isExpanded ? 'opacity-100' : 'pointer-events-none opacity-0',
              )}
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(0, 1fr))' }}
            >
              {serviceTasks.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No tasks yet. Ask the voice assistant to add something for this service.
                </p>
              ) : (
                serviceTasks.map((task, index) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    accentColor={service.accentColor}
                    highlighted={highlightedTaskIds.has(task.id)}
                    animationHint={animationHints[task.id]?.type}
                    animationDelay={index * 70}
                  />
                ))
              )}
            </div>
            <div
              aria-hidden
              className={clsx(
                'pointer-events-none absolute inset-x-10 bottom-0 h-24 rounded-t-full opacity-20 blur-3xl transition-opacity',
                serviceTasks.length > 0 ? 'opacity-30' : 'opacity-5',
              )}
              style={{ backgroundColor: service.accentColor }}
            />
          </section>
        )
      })}
    </div>
  )
}
