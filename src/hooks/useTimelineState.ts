import { useCallback, useEffect, useMemo, useState } from 'react'
import { services } from '../data/services'
import type {
  CategoriesConfirmedDetail,
  ServiceId,
  TimelineTask,
  TimelineTasksUpdatedDetail,
  TaskStatus,
} from '../types/timeline'

const SERVICE_STORAGE_KEY = 'voice-relocation:selected-services'
const TASK_STORAGE_KEY = 'voice-relocation:timeline-tasks'

const serviceIds = services.map((service) => service.id)

function dedupeServices(ids: ServiceId[]) {
  return Array.from(new Set(ids.filter((id) => serviceIds.includes(id))))
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const serialized = window.localStorage.getItem(key)
    if (!serialized) {
      return fallback
    }
    return JSON.parse(serialized) as T
  } catch (error) {
    console.warn(`Failed to read ${key} from localStorage`, error)
    return fallback
  }
}

function persistToStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`Failed to write ${key} to localStorage`, error)
  }
}

export interface UseTimelineStateResult {
  tasks: TimelineTask[]
  selectedServices: ServiceId[]
  visibleTasks: TimelineTask[]
  toggleService: (serviceId: ServiceId) => void
  setSelectedServices: (next: ServiceId[]) => void
  upsertTask: (task: TimelineTask) => void
  updateTaskStatus: (taskId: string, status: TaskStatus) => void
  replaceTasks: (next: TimelineTask[]) => void
}

export function useTimelineState(): UseTimelineStateResult {
  const [selectedServices, setSelectedServicesState] = useState<ServiceId[]>(() =>
    dedupeServices(loadFromStorage<ServiceId[]>(SERVICE_STORAGE_KEY, [])),
  )
  const [tasks, setTasks] = useState<TimelineTask[]>(() =>
    loadFromStorage<TimelineTask[]>(TASK_STORAGE_KEY, []).filter((task) =>
      serviceIds.includes(task.serviceId),
    ),
  )

  useEffect(() => {
    persistToStorage(SERVICE_STORAGE_KEY, selectedServices)
  }, [selectedServices])

  useEffect(() => {
    persistToStorage(TASK_STORAGE_KEY, tasks)
  }, [tasks])

  useEffect(() => {
    const handleCategoriesConfirmed = (event: Event) => {
      const detail = (event as CustomEvent<CategoriesConfirmedDetail>).detail
      if (!detail?.activeCategories) {
        return
      }
      setSelectedServicesState((prev) => {
        const next = detail.activeCategories.filter((id): id is ServiceId =>
          serviceIds.includes(id),
        )
        return next.length > 0 ? next : prev
      })
    }

    const handleTasksUpdated = (event: Event) => {
      const detail = (event as CustomEvent<TimelineTasksUpdatedDetail>).detail
      if (!detail?.tasks) {
        return
      }
      setTasks(detail.tasks)
    }

    window.addEventListener('categoriesConfirmed', handleCategoriesConfirmed as EventListener)
    window.addEventListener('timelineTasksUpdated', handleTasksUpdated as EventListener)

    return () => {
      window.removeEventListener(
        'categoriesConfirmed',
        handleCategoriesConfirmed as EventListener,
      )
      window.removeEventListener('timelineTasksUpdated', handleTasksUpdated as EventListener)
    }
  }, [])

  const toggleService = useCallback((serviceId: ServiceId) => {
    setSelectedServicesState((prev) => {
      const next = prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
      return dedupeServices(next)
    })
  }, [])

  const setSelectedServices = useCallback((next: ServiceId[]) => {
    setSelectedServicesState(dedupeServices(next))
  }, [])

  const upsertTask = useCallback((task: TimelineTask) => {
    setTasks((prev) => {
      const exists = prev.some((item) => item.id === task.id)
      const next = exists
        ? prev.map((item) => (item.id === task.id ? { ...task } : item))
        : [...prev, task]
      dispatchTimelineUpdate(next)
      return next
    })
  }, [])

  const updateTaskStatus = useCallback((taskId: string, status: TaskStatus) => {
    setTasks((prev) => {
      const next = prev.map((task) =>
        task.id === taskId ? { ...task, status, lastUpdatedAt: new Date().toISOString() } : task,
      )
      dispatchTimelineUpdate(next)
      return next
    })
  }, [])

  const replaceTasks = useCallback((next: TimelineTask[]) => {
    setTasks(next)
    dispatchTimelineUpdate(next)
  }, [])

  const visibleTasks = useMemo(() => {
    const active = new Set(selectedServices)
    return tasks.filter((task) => active.has(task.serviceId))
  }, [selectedServices, tasks])

  return {
    tasks,
    selectedServices,
    visibleTasks,
    toggleService,
    setSelectedServices,
    upsertTask,
    updateTaskStatus,
    replaceTasks,
  }
}

function dispatchTimelineUpdate(tasks: TimelineTask[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent<TimelineTasksUpdatedDetail>('timelineTasksUpdated', {
      detail: { tasks },
    }),
  )
}
