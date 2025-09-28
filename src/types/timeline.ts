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

export type TaskAction =
  | {
      type: 'upload'
      label: string
      accept?: string
      instructions?: string
      id?: string
    }
  | {
      type: 'booking'
      label: string
      ctaLabel?: string
      instructions?: string
      calendarHint?: string
      id?: string
    }
  | {
      type: 'link'
      label: string
      url: string
      instructions?: string
      id?: string
    }
  | {
      type: 'note'
      text: string
      id?: string
    }
  | {
      type: 'research'
      label: string
      defaultQuery?: string
      placeholder?: string
      hint?: string
      id?: string
    }

export interface TimelineResearchState {
  lastQueryId?: string
  lastQuery?: string
  status?: 'idle' | 'pending' | 'in_progress' | 'complete' | 'failed'
  updatedAt?: string
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
  actions?: TaskAction[]
  researchState?: TimelineResearchState
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
