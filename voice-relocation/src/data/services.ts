import { Boxes, Home, Sparkles, Stamp, Wallet } from 'lucide-react'
import type { ServiceDefinition } from '../types/timeline'

export const services: ServiceDefinition[] = [
  {
    id: 'housing',
    label: 'Housing',
    description: 'Find and secure your new home or temporary stay.',
    icon: Home,
    accentColor: '#0ea5e9',
  },
  {
    id: 'immigration',
    label: 'Immigration',
    description: 'Handle visas, work permits, and compliance documents.',
    icon: Stamp,
    accentColor: '#8b5cf6',
  },
  {
    id: 'moving',
    label: 'Moving Logistics',
    description: 'Coordinate movers, inventory, and travel plans.',
    icon: Boxes,
    accentColor: '#f97316',
  },
  {
    id: 'finances',
    label: 'Finances',
    description: 'Set up banking, payroll, and relocation budgets.',
    icon: Wallet,
    accentColor: '#10b981',
  },
  {
    id: 'settling',
    label: 'Settling In',
    description: 'Help the family acclimate and handle final details.',
    icon: Sparkles,
    accentColor: '#f59e0b',
  },
]
