import { CheckCheck, Clock } from 'lucide-react'
import { clsx } from 'clsx'
import type { TimelineTask } from '../types/timeline'

interface TaskCardProps {
  task: TimelineTask
  accentColor: string
  highlighted: boolean
  animationHint?: 'created' | 'updated' | 'completed' | 'touched'
  animationDelay?: number
}

export function TaskCard({ task, accentColor, highlighted, animationHint, animationDelay = 0 }: TaskCardProps) {
  const isComplete = task.status === 'completed'

  return (
    <article
      className={clsx(
        'relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition-transform duration-500 ease-out',
        animationHint === 'created' && 'animate-card-pop',
        animationHint === 'updated' && 'animate-card-pulse',
        animationHint === 'completed' && 'animate-card-complete',
        highlighted && 'ring-4 ring-offset-2 ring-sky-400/70',
        !highlighted && 'shadow-sm hover:shadow-md',
      )}
      style={{ transitionDelay: `${animationDelay}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{task.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{task.description}</p>
        </div>
        <span
          className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-white"
          style={{ backgroundColor: accentColor }}
        >
          {task.timeframe}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'inline-flex items-center gap-1 rounded-full border px-2 py-1 font-medium',
              isComplete
                ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                : 'border-amber-200 bg-amber-50 text-amber-600',
            )}
          >
            {isComplete ? (
              <>
                <CheckCheck className="h-3 w-3" />
                Completed
              </>
            ) : (
              <>
                <Clock className="h-3 w-3" />
                {task.status === 'in_progress' ? 'In progress' : 'Upcoming'}
              </>
            )}
          </span>
          {task.lastUpdatedAt ? (
            <span className="text-slate-400">
              Updated {new Date(task.lastUpdatedAt).toLocaleDateString()}
            </span>
          ) : null}
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-1/2 h-36 w-36 -translate-y-1/2 rounded-full opacity-10 blur-3xl"
        style={{ backgroundColor: accentColor }}
      />
    </article>
  )
}
