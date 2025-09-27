import { clsx } from 'clsx'
import type { ServiceDefinition, ServiceId } from '../types/timeline'

interface ServiceSelectorProps {
  services: ServiceDefinition[]
  selected: ServiceId[]
  onToggle: (serviceId: ServiceId) => void
}

export function ServiceSelector({ services, selected, onToggle }: ServiceSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {services.map((service) => {
        const isActive = selected.includes(service.id)
        return (
          <button
            key={service.id}
            type="button"
            onClick={() => onToggle(service.id)}
            aria-pressed={isActive}
            className={clsx(
              'group flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300',
              isActive
                ? 'border-transparent bg-slate-950 text-white shadow-md'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            )}
            style={isActive ? { backgroundImage: `linear-gradient(135deg, ${service.accentColor}, #0f172a)` } : undefined}
          >
            <service.icon className={clsx('h-4 w-4 transition-transform', isActive && 'scale-110')} />
            <span className="font-medium">{service.label}</span>
          </button>
        )
      })}
    </div>
  )
}
