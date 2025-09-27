import type { LucideIcon } from 'lucide-react'

export type ServiceId =
  | 'housing'
  | 'immigration'
  | 'moving'
  | 'finances'
  | 'settling'

export type TaskStatus = 'pending' | 'in_progress' | 'completed'

export interface ServiceDefinition {
  id: ServiceId
  label: string
  description: string
  icon: LucideIcon
  accentColor: string
}

export interface TimelineTask {
  id: string
  serviceId: ServiceId
  title: string
  description: string
  timeframe: string
  status: TaskStatus
  sequence: number
  lastUpdatedAt?: string
}

export interface CategoriesConfirmedDetail {
  activeCategories: ServiceId[]
}

export interface TimelineTasksUpdatedDetail {
  tasks: TimelineTask[]
}

export interface AssistantTaskHighlightDetail {
  ids: string[]
  action: 'updated' | 'completed' | 'created' | 'touched'
}

export interface AssistantUiMessageDetail {
  message: string
  timestamp: number
}
