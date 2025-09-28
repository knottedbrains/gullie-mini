import { useCallback, useEffect, useMemo, useState } from 'react'
import { services } from '../data/services'
import { getTemplatesForService, instantiateTemplateTask } from '../data/taskTemplates'
import type {
  CategoriesConfirmedDetail,
  RelocationProfile,
  ServiceId,
  TimelineTask,
  TimelineTasksUpdatedDetail,
  TaskStatus,
} from '../types/timeline'
import { enrichTasks } from '../data/taskEnrichments'

const SERVICE_STORAGE_KEY = 'gullie-mini:selected-services'
const TASK_STORAGE_KEY = 'gullie-mini:timeline-tasks'
const PROFILE_STORAGE_KEY = 'gullie-mini:relocation-profile'

const serviceIds = services.map((service) => service.id)

function dedupeServices(ids: ServiceId[]) {
  return Array.from(new Set(ids.filter((id) => serviceIds.includes(id))))
}

function dedupeTasks(tasks: TimelineTask[]) {
  const seen = new Set<string>()
  const ordered: TimelineTask[] = []
  tasks.forEach((task) => {
    if (!task?.id) {
      return
    }
    if (!seen.has(task.id)) {
      seen.add(task.id)
      ordered.push(task)
    }
  })
  return ordered
}

function normalizeTasks(tasks: TimelineTask[]) {
  return enrichTasks(dedupeTasks(tasks))
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
  relocationProfile: RelocationProfile
  toggleService: (serviceId: ServiceId) => void
  setSelectedServices: (next: ServiceId[], allowReduction?: boolean) => void
  upsertTask: (task: TimelineTask) => void
  updateTaskStatus: (taskId: string, status: TaskStatus) => void
  replaceTasks: (next: TimelineTask[]) => void
  buildServiceTasks: (serviceId: ServiceId) => TimelineTask[]
  setRelocationProfile: (profile: RelocationProfile) => void
  resetAll: () => void
}

export function useTimelineState(): UseTimelineStateResult {
  const [selectedServices, setSelectedServicesState] = useState<ServiceId[]>(() =>
    dedupeServices(loadFromStorage<ServiceId[]>(SERVICE_STORAGE_KEY, [])),
  )
  const [tasks, setTasks] = useState<TimelineTask[]>(() =>
    normalizeTasks(
      loadFromStorage<TimelineTask[]>(TASK_STORAGE_KEY, [])
        .filter((task) => serviceIds.includes(task.serviceId))
        .map((task) => ({ ...task, templateSlug: task.templateSlug ?? undefined })),
    ),
  )
  const [relocationProfile, setRelocationProfileState] = useState<RelocationProfile>(() =>
    loadFromStorage<RelocationProfile>(PROFILE_STORAGE_KEY, {}),
  )

  useEffect(() => {
    persistToStorage(SERVICE_STORAGE_KEY, selectedServices)
  }, [selectedServices])

  useEffect(() => {
    persistToStorage(TASK_STORAGE_KEY, tasks)
  }, [tasks])

  useEffect(() => {
    persistToStorage(PROFILE_STORAGE_KEY, relocationProfile)
  }, [relocationProfile])

  useEffect(() => {
    const handleCategoriesConfirmed = (event: Event) => {
      const detail = (event as CustomEvent<CategoriesConfirmedDetail>).detail
      if (!detail?.activeCategories) {
        return
      }
      setSelectedServicesState((prev) => {
        const incoming = detail.activeCategories.filter((id): id is ServiceId =>
          serviceIds.includes(id),
        )

        console.log('[timeline] categoriesConfirmed:', { prev, incoming, activeCategories: detail.activeCategories })

        if (!incoming.length) {
          return prev
        }

        const merged = Array.from(new Set([...prev, ...incoming]))
        console.log('[timeline] merged services:', merged)

        if (merged.length === prev.length) {
          // Check if all services in merged are already in prev (regardless of order)
          const prevSet = new Set(prev)
          const hasNewServices = merged.some(id => !prevSet.has(id))
          if (!hasNewServices) {
            console.log('[timeline] no new services, keeping prev')
            return prev
          }
        }
        console.log('[timeline] updating to merged services')
        return merged
      })
    }

    const handleTasksUpdated = (event: Event) => {
      const detail = (event as CustomEvent<TimelineTasksUpdatedDetail>).detail
      if (!detail?.tasks) {
        return
      }
      setTasks(dedupeTasks(detail.tasks))
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

  const setSelectedServices = useCallback((next: ServiceId[], allowReduction = false) => {
    console.log('[timeline] setSelectedServices called with:', { next, allowReduction })
    const deduped = dedupeServices(next)
    console.log('[timeline] after deduping:', deduped)

    setSelectedServicesState((prev) => {
      // Protection: If trying to set fewer services than before, make sure it's intentional
      if (!allowReduction && deduped.length < prev.length && prev.length > 0) {
        console.warn('[timeline] ⚠️ POTENTIAL SERVICE LOSS DETECTED!', {
          previous: prev,
          attempted: deduped,
          lost: prev.filter(id => !deduped.includes(id))
        })

        // PERMANENT FIX: Instead of replacing, merge with existing services
        // This ensures services are NEVER lost unless explicitly removed
        const merged = Array.from(new Set([...prev, ...deduped]))
        console.log('[timeline] 🛡️ PROTECTED: Merging instead of replacing:', merged)
        return merged
      }

      return deduped
    })
  }, [])

  const upsertTask = useCallback((task: TimelineTask) => {
    setTasks((prev) => {
      const exists = prev.some((item) => item.id === task.id)
      const next = exists
        ? prev.map((item) => (item.id === task.id ? { ...task } : item))
        : [...prev, task]
      const deduped = normalizeTasks(next)
      dispatchTimelineUpdate(deduped)
      return deduped
    })
  }, [])

  const updateTaskStatus = useCallback((taskId: string, status: TaskStatus) => {
    setTasks((prev) => {
      const next = prev.map((task) =>
        task.id === taskId ? { ...task, status, lastUpdatedAt: new Date().toISOString() } : task,
      )
      const deduped = normalizeTasks(next)
      dispatchTimelineUpdate(deduped)
      return deduped
    })
  }, [])

  const replaceTasks = useCallback((next: TimelineTask[]) => {
    const deduped = normalizeTasks(next)
    setTasks(deduped)
    dispatchTimelineUpdate(deduped)
  }, [])

  const buildServiceTasks = useCallback(
    (serviceId: ServiceId) => {
      const templates = getTemplatesForService(serviceId)
      if (!templates.length) {
        return []
      }
      const existing = tasks.filter((task) => task.serviceId === serviceId)
      const existingSlugs = new Set(
        existing
          .map((task) => task.templateSlug ?? task.title)
          .filter((value): value is string => Boolean(value)),
      )
      const baseSequence = existing.length
      const created: TimelineTask[] = []
      templates.forEach((template, index) => {
        if (existingSlugs.has(template.slug) || existingSlugs.has(template.title)) {
          return
        }
        const task = instantiateTemplateTask(serviceId, template, baseSequence + index + 1)
        created.push(task)
        existingSlugs.add(template.slug)
      })
      if (created.length) {
        const next = normalizeTasks([...tasks, ...created])
        setTasks(next)
        dispatchTimelineUpdate(next)
      }
      return normalizeTasks(created)
    },
    [tasks],
  )

  const visibleTasks = useMemo(() => {
    const active = new Set(selectedServices)
    const filtered = tasks.filter((task) => active.has(task.serviceId))
    console.log('[timeline] visibleTasks calculation:', {
      selectedServices,
      totalTasks: tasks.length,
      visibleTasks: filtered.length,
      visibleServiceIds: [...new Set(filtered.map(t => t.serviceId))]
    })
    return filtered
  }, [selectedServices, tasks])

  const setRelocationProfile = useCallback((profile: RelocationProfile) => {
    setRelocationProfileState((prev) => {
      const next = { ...prev, ...profile, lastUpdatedAt: new Date().toISOString() }
      return next
    })
  }, [])

  const resetAll = useCallback(() => {
    console.log('[timeline] 🔄 LEGITIMATE RESET: Clearing all services via resetAll')
    setSelectedServices([], true) // Use the protected function with allowReduction=true
    setTasks([])
    setRelocationProfileState({})
    dispatchTimelineUpdate([])
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent<CategoriesConfirmedDetail>('categoriesConfirmed', {
          detail: { activeCategories: [] },
        }),
      )
      window.dispatchEvent(
        new CustomEvent<TimelineTasksUpdatedDetail>('timelineTasksUpdated', {
          detail: { tasks: [] },
        }),
      )
    }
  }, [setSelectedServices])

  return {
    tasks,
    selectedServices,
    visibleTasks,
    relocationProfile,
    toggleService,
    setSelectedServices,
    upsertTask,
    updateTaskStatus,
    replaceTasks,
    buildServiceTasks,
    setRelocationProfile,
    resetAll,
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
