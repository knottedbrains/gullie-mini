import { useMemo } from 'react'
import { clsx } from 'clsx'
import { services } from '../data/services'
import type { ServiceId, TimelineTask } from '../types/timeline'
import { TaskCard } from './TaskCard'

interface TimelineBoardProps {
  tasks: TimelineTask[]
  selectedServices: ServiceId[]
  highlightedTaskIds: Set<string>
}

export function TimelineBoard({ tasks, selectedServices, highlightedTaskIds }: TimelineBoardProps) {
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

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {services
        .filter((service) => selectedServices.includes(service.id))
        .map((service) => {
          const serviceTasks = tasksByService.get(service.id) ?? []

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
              </header>
              <div className="mt-6 flex flex-col gap-4">
                {serviceTasks.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No tasks yet. Ask the voice assistant to add something for this service.
                  </p>
                ) : (
                  serviceTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      accentColor={service.accentColor}
                      highlighted={highlightedTaskIds.has(task.id)}
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
