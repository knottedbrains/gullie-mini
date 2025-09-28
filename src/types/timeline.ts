import type { LucideIcon } from 'lucide-react'

export type ServiceId =
  | 'immigration'
  | 'temp_accommodation'
  | 'housing'
  | 'moving'
  | 'finances'
  | 'healthcare'
  | 'transportation'
  | 'lifestyle'
  | 'pets'
  | 'children'
  | 'education'
  | 'identification'
  | 'tax'
  | 'spouse_job'
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
  templateSlug?: string
  extraInfo?: Array<{
    label: string
    value: string
    href?: string
  }>
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

export interface RelocationProfile {
  fromCity?: string
  toCity?: string
  moveDate?: string
  lastUpdatedAt?: string
}
