import { CheckCheck, Clock } from 'lucide-react'
import { clsx } from 'clsx'
import type { TaskAction, TimelineTask } from '../types/timeline'
import { ResearchActionCard } from './ResearchActionCard'

type ResearchAction = Extract<TaskAction, { type: 'research' }>

interface TaskCardProps {
  task: TimelineTask
  accentColor: string
  serviceLabel: string
  highlighted: boolean
  animationHint?: 'created' | 'updated' | 'completed' | 'touched'
  animationDelay?: number
}

export function TaskCard({
  task,
  accentColor,
  serviceLabel,
  highlighted,
  animationHint,
  animationDelay = 0,
}: TaskCardProps) {
  const isComplete = task.status === 'completed'
  const researchActions: ResearchAction[] = (task.actions ?? []).filter(
    (action): action is ResearchAction => action.type === 'research',
  )

  return (
    <article
      className={clsx(
        'relative flex flex-col gap-3 rounded-xl border border-white/15 bg-white/5 p-4 text-left transition-transform duration-500 ease-out',
        animationHint === 'created' && 'animate-card-pop',
        animationHint === 'updated' && 'animate-card-pulse',
        animationHint === 'completed' && 'animate-card-complete',
        highlighted ? 'ring-2 ring-sky-400/60' : 'hover:border-white/30',
      )}
      style={{ transitionDelay: `${animationDelay}ms` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-300/70">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} aria-hidden />
          {serviceLabel}
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-white shadow"
          style={{ backgroundColor: accentColor }}
        >
          {task.timeframe}
        </span>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white">{task.title}</h3>
        <p className="mt-1 text-sm text-slate-300/90">{task.description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <span
          className={clsx(
            'inline-flex items-center gap-1 rounded-full border px-2 py-1 font-medium',
            isComplete
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-amber-400/30 bg-amber-400/10 text-amber-100',
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
          <span className="text-slate-500">Updated {new Date(task.lastUpdatedAt).toLocaleDateString()}</span>
        ) : null}
      </div>

      {task.extraInfo && task.extraInfo.length ? (
        <dl className="space-y-2 text-xs text-slate-300/90">
          {task.extraInfo.map((item, index) => (
            <div key={`${task.id}-extra-${index}`} className="flex items-start justify-between gap-3">
              <dt className="font-medium text-slate-300/80">{item.label}</dt>
              {item.href ? (
                <dd>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-300 hover:text-sky-200 hover:underline"
                  >
                    {item.value}
                  </a>
                </dd>
              ) : (
                <dd className="text-slate-200">{item.value}</dd>
              )}
            </div>
          ))}
        </dl>
      ) : null}
      {researchActions.length ? (
        <div className="space-y-3">
          {researchActions.map((action, index) => (
            <ResearchActionCard
              key={`${task.id}-research-${index}`}
              taskId={task.id}
              action={action}
              initialState={task.researchState}
            />
          ))}
        </div>
      ) : null}
    </article>
  )
}
