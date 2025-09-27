import type { ServiceId, TaskStatus, TimelineTask } from '../types/timeline'

interface TaskTemplate {
  slug: string
  title: string
  description: string
  timeframe: string
  defaultStatus?: TaskStatus
}

const templateLibrary: Record<ServiceId, TaskTemplate[]> = {
  housing: [
    {
      slug: 'discover-neighborhoods',
      title: 'Map out destination neighborhoods',
      description: 'Pin the areas that match commute, school, and lifestyle goals so we can focus the search.',
      timeframe: 'Kickoff',
    },
    {
      slug: 'schedule-viewings',
      title: 'Schedule housing tours',
      description: 'Coordinate virtual or in-person walkthroughs for the top properties.',
      timeframe: 'Week 1',
    },
    {
      slug: 'lease-checklist',
      title: 'Review lease essentials',
      description: 'Confirm move-in dates, deposits, and onboarding instructions with the landlord or agent.',
      timeframe: 'Week 2',
    },
  ],
  immigration: [
    {
      slug: 'document-audit',
      title: 'Collect visa documentation',
      description: 'Gather passports, contracts, and dependent records needed for the immigration filing.',
      timeframe: 'Kickoff',
      defaultStatus: 'in_progress',
    },
    {
      slug: 'biometrics-booking',
      title: 'Book biometrics appointment',
      description: 'Reserve the earliest slot that aligns with travel plans and processing timelines.',
      timeframe: 'Week 1',
    },
    {
      slug: 'arrival-notification',
      title: 'Plan arrival registration',
      description: 'Note the location and documents required for in-country registration or police check-in.',
      timeframe: 'Landing',
    },
  ],
  moving: [
    {
      slug: 'inventory',
      title: 'Create move inventory',
      description: 'List the key household items and note fragile shipment requirements.',
      timeframe: 'Kickoff',
    },
    {
      slug: 'shippers',
      title: 'Lock in international movers',
      description: 'Compare quotes, confirm insurance coverage, and secure pack-out dates.',
      timeframe: 'Week 2',
    },
    {
      slug: 'travel-plan',
      title: 'Align travel logistics',
      description: 'Sync flights, temporary housing check-in, and arrival coordination with the movers.',
      timeframe: 'Week 3',
    },
  ],
  finances: [
    {
      slug: 'bank-account',
      title: 'Open destination bank account',
      description: 'Prepare documentation and schedule a remote or in-branch appointment.',
      timeframe: 'Week 1',
    },
    {
      slug: 'budget',
      title: 'Publish relocation budget tracker',
      description: 'Share stipend usage, reimbursements, and upcoming expenses.',
      timeframe: 'Week 2',
    },
    {
      slug: 'tax-briefing',
      title: 'Plan tax briefing',
      description: 'Confirm payroll implications and schedule a session with the tax advisor.',
      timeframe: 'Week 3',
    },
  ],
  settling: [
    {
      slug: 'welcome-pack',
      title: 'Send newcomer welcome pack',
      description: 'Provide guides covering healthcare, transport, and key local registrations.',
      timeframe: 'Landing',
    },
    {
      slug: 'schools',
      title: 'Shortlist schools and childcare',
      description: 'Collect enrollment requirements and orientation dates for the family.',
      timeframe: 'Week 2',
    },
    {
      slug: 'utilities',
      title: 'Activate utilities concierge',
      description: 'Line up electricity, internet, and mobile services ahead of move-in.',
      timeframe: 'Week 3',
    },
  ],
}

export function getTemplatesForService(serviceId: ServiceId): TaskTemplate[] {
  return templateLibrary[serviceId] ?? []
}

export function instantiateTemplateTask(
  serviceId: ServiceId,
  template: TaskTemplate,
  sequence: number,
): TimelineTask {
  const generateId = () => {
    const baseId = `task-${serviceId}-${template.slug}`
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `${baseId}-${crypto.randomUUID().slice(0, 8)}`
    }
    return `${baseId}-${Math.random().toString(16).slice(2, 10)}`
  }

  return {
    id: generateId(),
    serviceId,
    title: template.title,
    description: template.description,
    timeframe: template.timeframe,
    status: template.defaultStatus ?? 'pending',
    sequence,
    lastUpdatedAt: new Date().toISOString(),
    templateSlug: template.slug,
  }
}
