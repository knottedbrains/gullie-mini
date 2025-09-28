import { useEffect, useMemo, useState } from 'react'
import { services } from '../data/services'
import type { AssistantTaskHighlightDetail, ServiceDefinition, ServiceId, TimelineTask } from '../types/timeline'
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
  highlightedTaskIds: Set<string>
}

interface ChronologicalEntry {
  task: TimelineTask
  service: ServiceDefinition
  index: number
}

function parseNumericPortion(value: string) {
  const match = value.match(/\d+/)
  return match ? parseInt(match[0], 10) : 0
}

function getTimeframeRank(timeframe: string) {
  const normalized = timeframe.trim().toLowerCase()
  if (normalized === 'kickoff') return 0
  if (normalized.startsWith('day')) return 100 + parseNumericPortion(normalized)
  if (normalized.startsWith('week')) return 200 + parseNumericPortion(normalized)
  if (normalized === 'arrival') return 300
  if (normalized === 'transit') return 350
  if (normalized === 'landing') return 400
  if (normalized === 'decision') return 500
  return 600
}

function compareTimeframes(a: string, b: string) {
  const diff = getTimeframeRank(a) - getTimeframeRank(b)
  if (diff !== 0) {
    return diff
  }
  return a.localeCompare(b)
}

export function TimelineBoard({ tasks, highlightedTaskIds }: TimelineBoardProps) {
  const [animationHints, setAnimationHints] = useState<AnimationMap>({})

  const serviceLookup = useMemo(() => {
    const map = new Map<ServiceId, ServiceDefinition>()
    services.forEach((service) => {
      map.set(service.id, service)
    })
    return map
  }, [])

  const chronologicalTasks = useMemo(() => {
    const mapped: ChronologicalEntry[] = tasks
      .map((task, index) => {
        const service = serviceLookup.get(task.serviceId)
        if (!service) {
          return null
        }
        return { task, service, index }
      })
      .filter((entry): entry is ChronologicalEntry => entry !== null)

    mapped.sort((a, b) => {
      const timeframeDiff = compareTimeframes(a.task.timeframe, b.task.timeframe)
      if (timeframeDiff !== 0) {
        return timeframeDiff
      }
      if (a.task.sequence !== b.task.sequence) {
        return a.task.sequence - b.task.sequence
      }
      if (a.service.label !== b.service.label) {
        return a.service.label.localeCompare(b.service.label)
      }
      return a.index - b.index
    })

    return mapped
  }, [tasks, serviceLookup])

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

  if (!chronologicalTasks.length) {
    return (
      <p className="text-sm text-slate-400">
        No timeline cards yet. Ask the voice assistant to add tasks to your relocation plan.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {chronologicalTasks.map(({ task, service }, index) => (
        <TaskCard
          key={task.id}
          task={task}
          accentColor={service.accentColor}
          serviceLabel={service.label}
          highlighted={highlightedTaskIds.has(task.id)}
          animationHint={animationHints[task.id]?.type}
          animationDelay={index * 70}
        />
      ))}
    </div>
  )
}
