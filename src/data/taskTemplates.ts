import type { ServiceId, TaskStatus, TimelineTask } from '../types/timeline'

interface TaskTemplate {
  slug: string
  title: string
  description: string
  timeframe: string
  defaultStatus?: TaskStatus
}

const templateLibrary: Record<ServiceId, TaskTemplate[]> = {
  immigration: [
    {
      slug: 'visa-research',
      title: 'Research visa options',
      description: 'Clarify eligibility, required documents, and lead times for the destination.',
      timeframe: 'Kickoff',
    },
    {
      slug: 'visa-application',
      title: 'Submit visa application',
      description: 'Prepare forms, supporting evidence, and schedule filings.',
      timeframe: 'Week 1',
      defaultStatus: 'in_progress',
    },
    {
      slug: 'biometrics',
      title: 'Attend biometrics appointment',
      description: 'Book fingerprinting or interview slots and gather confirmations.',
      timeframe: 'Week 2',
    },
    {
      slug: 'residence-permit',
      title: 'Register for residence permit',
      description: 'Arrange in-country registration after landing to stay compliant.',
      timeframe: 'Landing',
    },
  ],
  temp_accommodation: [
    {
      slug: 'research-temp',
      title: 'Research temporary accommodation',
      description: 'Compare serviced apartments and short lets based on arrival date.',
      timeframe: 'Kickoff',
    },
    {
      slug: 'book-temp',
      title: 'Book short-term accommodation',
      description: 'Secure a reservation aligned with move-in and household needs.',
      timeframe: 'Week 1',
    },
    {
      slug: 'arrival-transfer',
      title: 'Arrange airport pickup to accommodation',
      description: 'Coordinate transport so arrival is smooth and key handoff is confirmed.',
      timeframe: 'Week 2',
    },
    {
      slug: 'temp-check-in',
      title: 'Check in to temporary accommodation',
      description: 'Verify access instructions, contacts, and stay extensions if needed.',
      timeframe: 'Landing',
    },
  ],
  housing: [
    {
      slug: 'neighborhood-research',
      title: 'Research destination neighborhoods',
      description: 'Match commute, schools, and amenities priorities to shortlist areas.',
      timeframe: 'Kickoff',
    },
    {
      slug: 'viewings',
      title: 'Schedule property tours',
      description: 'Coordinate in-person or virtual tours with local agents.',
      timeframe: 'Week 1',
    },
    {
      slug: 'lease-negotiation',
      title: 'Negotiate and confirm lease',
      description: 'Review contracts, deposits, and compliance before signing.',
      timeframe: 'Week 2',
    },
    {
      slug: 'utilities-setup',
      title: 'Set up utilities and internet',
      description: 'Order electricity, water, gas, and connectivity ahead of move-in.',
      timeframe: 'Week 3',
    },
  ],
  moving: [
    {
      slug: 'move-estimate',
      title: 'Estimate move size and inventory',
      description: 'Log key household items, fragile notes, and storage needs.',
      timeframe: 'Kickoff',
    },
    {
      slug: 'enter-move-details',
      title: 'Submit move details to movers',
      description: 'Share addresses, customs info, and preferred pack-out dates.',
      timeframe: 'Week 1',
    },
    {
      slug: 'confirm-request',
      title: 'Confirm move request',
      description: 'Lock in service level, insurance coverage, and budget approvals.',
      timeframe: 'Week 1',
    },
    {
      slug: 'virtual-inventory',
      title: 'Complete virtual inventory walkthrough',
      description: 'Record photos/videos and finalize packing instructions.',
      timeframe: 'Week 2',
    },
    {
      slug: 'quote-approval',
      title: 'Review and approve mover quote',
      description: 'Compare bids, negotiate extras, and sign service agreements.',
      timeframe: 'Week 2',
    },
    {
      slug: 'track-move',
      title: 'Track shipment progress',
      description: 'Monitor transport milestones and coordinate delivery dates.',
      timeframe: 'Transit',
    },
  ],
  finances: [
    {
      slug: 'notify-bank',
      title: 'Notify current bank of relocation',
      description: 'Inform institutions about travel dates and new contact details.',
      timeframe: 'Kickoff',
    },
    {
      slug: 'credit-history',
      title: 'Research credit history transfer',
      description: 'Collect credit reports and plan for local scoring equivalents.',
      timeframe: 'Week 1',
    },
    {
      slug: 'bank-research',
      title: 'Research banks in destination',
      description: 'Compare account options, fees, and multi-currency support.',
      timeframe: 'Week 1',
    },
    {
      slug: 'ssn-eligibility',
      title: 'Confirm Social Security eligibility',
      description: 'Check if the employee needs SSN, ITIN, or other local IDs.',
      timeframe: 'Week 2',
    },
    {
      slug: 'open-account',
      title: 'Open local bank account',
      description: 'Gather KYC documents and schedule remote or in-branch onboarding.',
      timeframe: 'Week 3',
    },
    {
      slug: 'tax-registration',
      title: 'Register for local taxation',
      description: 'Align payroll, withholding, and reimbursement processes.',
      timeframe: 'Landing',
    },
  ],
  healthcare: [
    {
      slug: 'insurance',
      title: 'Arrange health insurance',
      description: 'Confirm global coverage and enroll in employer or state plans.',
      timeframe: 'Kickoff',
    },
    {
      slug: 'doctor',
      title: 'Find a primary doctor',
      description: 'Shortlist clinics near home or office and gather registration forms.',
      timeframe: 'Week 2',
    },
    {
      slug: 'vaccinations',
      title: 'Review required vaccinations',
      description: 'Check local mandates and schedule appointments before travel.',
      timeframe: 'Week 2',
    },
  ],
  transportation: [
    {
      slug: 'public-transit',
      title: 'Research public transport options',
      description: 'Map commute routes and purchase regional transit passes.',
      timeframe: 'Week 1',
    },
    {
      slug: 'license-check',
      title: 'Check driving license requirements',
      description: 'Understand conversion timelines and testing steps if needed.',
      timeframe: 'Week 2',
    },
    {
      slug: 'transport-card',
      title: 'Order transport card or pass',
      description: 'Register and preload metro, bus, or rail passes for arrival.',
      timeframe: 'Week 3',
    },
  ],
  lifestyle: [
    {
      slug: 'language-classes',
      title: 'Research language classes',
      description: 'Curate online and in-person courses aligned with proficiency.',
      timeframe: 'Week 1',
    },
    {
      slug: 'community',
      title: 'Join local and expat communities',
      description: 'List clubs, forums, and meetups to build a new network.',
      timeframe: 'Week 2',
    },
    {
      slug: 'fitness',
      title: 'Explore fitness options',
      description: 'Compare gyms, studios, and outdoor activities that fit routines.',
      timeframe: 'Week 2',
    },
    {
      slug: 'coworking',
      title: 'Evaluate coworking spaces',
      description: 'Assess flexible work locations for productivity and community.',
      timeframe: 'Week 3',
    },
  ],
  pets: [
    {
      slug: 'pet-partner',
      title: 'Choose pet transport partner',
      description: 'Vet relocation vendors, comfort levels, and regulatory support.',
      timeframe: 'Kickoff',
    },
    {
      slug: 'pet-package',
      title: 'Customize transport package',
      description: 'Decide crate sizes, layovers, and home pick-up or drop-off services.',
      timeframe: 'Week 1',
    },
    {
      slug: 'pet-paperwork',
      title: 'Review pet paperwork requirements',
      description: 'Confirm microchip, vaccination, and veterinary certificates.',
      timeframe: 'Week 1',
    },
    {
      slug: 'pet-docs',
      title: 'Prepare travel documents',
      description: 'Gather government endorsements and export/import permits.',
      timeframe: 'Week 2',
    },
    {
      slug: 'pet-flights',
      title: 'Book pet flights',
      description: 'Select routing aligned with climate embargoes and airline policies.',
      timeframe: 'Week 2',
    },
    {
      slug: 'pet-itinerary',
      title: 'Receive travel itinerary',
      description: 'Share detailed schedules and emergency contacts with the family.',
      timeframe: 'Week 3',
    },
    {
      slug: 'pet-pickup',
      title: 'Coordinate pickup and handoff',
      description: 'Confirm airport collection and final welfare checks.',
      timeframe: 'Landing',
    },
    {
      slug: 'pet-transit-updates',
      title: 'Monitor transit updates',
      description: 'Track flights and customs clearance to reassure the family.',
      timeframe: 'Transit',
    },
    {
      slug: 'pet-delivery',
      title: 'Complete customs and delivery',
      description: 'Handle import processing and deliver the pet to the new home.',
      timeframe: 'Arrival',
    },
  ],
  children: [
    {
      slug: 'school-research',
      title: 'Research schools and childcare',
      description: 'Compile neighborhood, curriculum, and admissions data.',
      timeframe: 'Week 1',
    },
    {
      slug: 'school-enroll',
      title: 'Prepare enrollment documentation',
      description: 'Collect transcripts, vaccination records, and references.',
      timeframe: 'Week 2',
    },
  ],
  education: [
    {
      slug: 'education-intake',
      title: 'Book advisor intake call',
      description: 'Kick off with family profile, goals, and application timeline.',
      timeframe: 'Kickoff',
    },
    {
      slug: 'education-research',
      title: 'Research & match schools',
      description: 'Build a tailored shortlist with admissions criteria and deadlines.',
      timeframe: 'Week 1',
    },
    {
      slug: 'education-target',
      title: 'Select target schools',
      description: 'Align on priorities, backup options, and campus visit plans.',
      timeframe: 'Week 2',
    },
    {
      slug: 'education-registration',
      title: 'Organize registration requirements',
      description: 'Track forms, testing, and essay prompts for each school.',
      timeframe: 'Week 3',
    },
    {
      slug: 'education-review',
      title: 'Review written applications',
      description: 'Provide feedback on essays and supporting statements.',
      timeframe: 'Week 4',
    },
    {
      slug: 'education-submit',
      title: 'Submit school applications',
      description: 'Finalize documents, pay fees, and confirm submission receipts.',
      timeframe: 'Week 5',
    },
    {
      slug: 'education-decision',
      title: 'Finalize enrollment decisions',
      description: 'Compare offers, scholarships, and onboarding requirements.',
      timeframe: 'Decision',
    },
  ],
  identification: [
    {
      slug: 'ssn-check',
      title: 'Determine SSN eligibility',
      description: 'Confirm if the move requires Social Security enrollment.',
      timeframe: 'Kickoff',
    },
    {
      slug: 'ssn-apply',
      title: 'Apply for SSN',
      description: 'Prepare forms, evidence, and in-person appointment.',
      timeframe: 'Week 1',
    },
    {
      slug: 'ssn-receive',
      title: 'Receive SSN card',
      description: 'Track delivery and store the document in a safe place.',
      timeframe: 'Week 3',
    },
    {
      slug: 'itin-check',
      title: 'Determine ITIN eligibility',
      description: 'Assess dependent and spouse identification requirements.',
      timeframe: 'Week 3',
    },
    {
      slug: 'itin-apply',
      title: 'Apply for ITIN',
      description: 'Gather notarized documents and mail the IRS application.',
      timeframe: 'Week 4',
    },
    {
      slug: 'itin-receive',
      title: 'Receive ITIN notice',
      description: 'Confirm processing and update payroll and tax records.',
      timeframe: 'Week 6',
    },
    {
      slug: 'update-accounts',
      title: 'Update accounts with new IDs',
      description: 'Share identification numbers with HR, payroll, and finance.',
      timeframe: 'Landing',
    },
  ],
  tax: [
    {
      slug: 'tax-research',
      title: 'Research tax obligations',
      description: 'Clarify residency rules, double-taxation treaties, and filings.',
      timeframe: 'Kickoff',
    },
    {
      slug: 'tax-briefing',
      title: 'Schedule tax briefing',
      description: 'Book a consultation with the tax advisor to plan submissions.',
      timeframe: 'Week 2',
    },
  ],
  spouse_job: [
    {
      slug: 'spouse-intake',
      title: 'Plan career coaching intake',
      description: 'Document career goals, constraints, and preferred industries.',
      timeframe: 'Kickoff',
    },
    {
      slug: 'spouse-network',
      title: 'Activate spouse networking plan',
      description: 'Prepare resume updates, outreach lists, and interview prep.',
      timeframe: 'Week 2',
    },
  ],
  settling: [
    {
      slug: 'arrival-registrations',
      title: 'Complete local registrations',
      description: 'Finish town hall, bank, and healthcare registrations after arrival.',
      timeframe: 'Landing',
    },
    {
      slug: 'welcome-pack',
      title: 'Send newcomer welcome pack',
      description: 'Share guides on utilities, transport, and emergency numbers.',
      timeframe: 'Week 1',
    },
    {
      slug: 'community-hand-off',
      title: 'Introduce community resources',
      description: 'Connect the family with local clubs, language, and wellness support.',
      timeframe: 'Week 2',
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
