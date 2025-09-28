import type { ServiceId, TaskAction, TimelineResearchState, TimelineTask } from '../types/timeline'

interface TaskEnrichment {
  id?: string
  templateSlug?: string
  title?: string
  serviceId?: ServiceId
  actions?: TaskAction[]
  researchState?: TimelineResearchState
}

const ENRICHMENTS: TaskEnrichment[] = [
  {
    id: 'task-housing-lease',
    title: 'Review shortlist of apartments',
    actions: [
      {
        type: 'research',
        label: 'Research destination rental insights',
        defaultQuery: 'Current rental market insights for family-friendly neighborhoods in Berlin',
        hint: 'Pull recent articles or listings to compare pricing with the assigned budget.',
        id: 'lease-research-insights',
      },
    ],
  },
  {
    id: 'task-housing-tour',
    title: 'Schedule virtual tours',
    actions: [
      {
        type: 'research',
        label: 'Find recent virtual tour tips',
        defaultQuery: 'Best practices for virtual apartment tours in Berlin 2025',
        id: 'tour-research-tips',
      },
      {
        type: 'booking',
        label: 'Book tour slot',
        id: 'tour-booking-slot',
        ctaLabel: 'Confirm tour time',
        instructions: 'Choose a time that works for the relocating family and share it with the agent.',
        calendarHint: 'Tours are typically scheduled between 09:00 and 18:00 local time.',
      },
    ],
  },
  {
    id: 'task-immigration-packet',
    templateSlug: 'visa-application',
    title: 'Collect immigration packet',
    actions: [
      {
        type: 'research',
        label: 'Check latest visa guidance',
        defaultQuery: 'Latest Germany work visa documentation requirements for US citizens 2025',
        id: 'immigration-packet-research',
      },
      {
        type: 'upload',
        label: 'Upload visa documents',
        id: 'immigration-packet-upload',
        accept: '.pdf,.png,.jpg',
        instructions: 'Attach passport scans, employment letters, and dependent documentation.',
      },
    ],
  },
  {
    templateSlug: 'neighborhood-research',
    serviceId: 'housing',
    actions: [
      {
        type: 'research',
        label: 'Research neighborhood insights',
        defaultQuery: 'Family-friendly neighborhoods in Berlin with international schools and easy transit',
        id: 'neighborhood-research-insights',
      },
    ],
  },
  {
    templateSlug: 'viewings',
    serviceId: 'housing',
    actions: [
      {
        type: 'research',
        label: 'Compare viewing options',
        defaultQuery: 'Virtual apartment tour services reviews 2025 Germany',
        id: 'viewings-research-options',
      },
    ],
  },
  {
    templateSlug: 'biometrics',
    serviceId: 'immigration',
    actions: [
      {
        type: 'research',
        label: 'Biometrics appointment prep',
        defaultQuery: 'How to prepare for Germany visa biometrics appointment 2025',
        id: 'biometrics-research-prep',
      },
      {
        type: 'booking',
        label: 'Schedule biometrics appointment',
        id: 'biometrics-booking-slot',
        ctaLabel: 'Book appointment',
        instructions: 'Pick a slot that leaves time for document review and travel logistics.',
        calendarHint: 'Biometrics offices operate Monday to Friday, 08:00-16:00.',
      },
    ],
  },
  {
    templateSlug: 'move-estimate',
    serviceId: 'moving',
    actions: [
      {
        type: 'research',
        label: 'Moving company research',
        defaultQuery: 'Best international moving companies from San Francisco to Berlin 2025',
        id: 'moving-research-companies',
      },
      {
        type: 'upload',
        label: 'Upload inventory photos',
        id: 'moving-upload-inventory',
        accept: '.jpg,.png,.pdf',
        instructions: 'Share photos or files that document items for movers and insurance.',
      },
    ],
  },
  {
    id: 'task-immigration-appointment',
    actions: [
      {
        type: 'booking',
        label: 'Book immigration consultant call',
        id: 'immigration-consultant-calendar',
        ctaLabel: 'Schedule meeting',
        instructions: 'Select a meeting time that works for the employee and the consultant.',
        calendarHint: 'Consultations are typically 30 minutes and offered in the destination time zone.',
      },
    ],
  },
  {
    id: 'task-moving-packout',
    actions: [
      {
        type: 'booking',
        label: 'Schedule pack-out crew',
        id: 'packout-booking',
        ctaLabel: 'Confirm pack-out date',
        instructions: 'Coordinate the visit window with building access and elevator reservations.',
        calendarHint: 'Pack-out crews book quickly—hold at least a three-hour window.',
      },
    ],
  },
]

function matches(task: TimelineTask, enrichment: TaskEnrichment) {
  if (enrichment.id && enrichment.id === task.id) {
    return true
  }
  if (enrichment.templateSlug && enrichment.templateSlug === task.templateSlug) {
    return true
  }
  if (enrichment.title && enrichment.title === task.title) {
    return true
  }
  if (enrichment.serviceId && enrichment.serviceId === task.serviceId) {
    return true
  }
  return false
}

function actionKey(action: TaskAction) {
  switch (action.type) {
    case 'note':
      return `note:${action.id ?? action.text}`
    case 'link':
      return `link:${action.id ?? action.url}`
    case 'research':
    case 'upload':
    case 'booking':
      return `${action.type}:${action.id ?? action.label}`
    default:
      return `${(action as { type?: string }).type ?? 'action'}:generic`
  }
}

export function enrichTask(task: TimelineTask): TimelineTask {
  const applicable = ENRICHMENTS.filter((item) => matches(task, item))
  if (!applicable.length) {
    return task
  }

  let nextActions: TaskAction[] = task.actions ? [...task.actions] : []
  const existingKeys = new Set(nextActions.map(actionKey))
  for (const item of applicable) {
    const actions = item.actions
    if (!actions || actions.length === 0) continue
    for (const action of actions) {
      const key = actionKey(action)
      if (existingKeys.has(key)) {
        continue
      }
      existingKeys.add(key)
      nextActions = [...nextActions, action]
    }
  }

  const mergedResearchState = applicable.reduce<TimelineResearchState | undefined>((acc, item) => {
    if (!item.researchState) return acc
    return { ...item.researchState, ...(acc ?? {}), ...(task.researchState ?? {}) }
  }, task.researchState)

  if (nextActions === task.actions && mergedResearchState === task.researchState) {
    return task
  }

  return {
    ...task,
    actions: nextActions,
    researchState: mergedResearchState,
  }
}

export function enrichTasks(tasks: TimelineTask[]): TimelineTask[] {
  return tasks.map(enrichTask)
}
