import { CheckCheck, Clock } from 'lucide-react'
import { clsx } from 'clsx'
import type { RelocationProfile, TaskAction, TimelineTask } from '../types/timeline'
import { ResearchActionCard } from './ResearchActionCard'
import { BookingActionCard } from './BookingActionCard'
import { UploadActionCard } from './UploadActionCard'

type ResearchAction = Extract<TaskAction, { type: 'research' }>
type BookingAction = Extract<TaskAction, { type: 'booking' }>
type UploadAction = Extract<TaskAction, { type: 'upload' }>
type LinkAction = Extract<TaskAction, { type: 'link' }>
type NoteAction = Extract<TaskAction, { type: 'note' }>

interface TaskCardProps {
  task: TimelineTask
  accentColor: string
  serviceLabel: string
  relocationProfile: RelocationProfile
  highlighted: boolean
  animationHint?: 'created' | 'updated' | 'completed' | 'touched'
  animationDelay?: number
  onToggleStatus?: (taskId: string, nextStatus: 'pending' | 'in_progress' | 'completed') => void
}

export function TaskCard({
  task,
  accentColor,
  serviceLabel,
  relocationProfile,
  highlighted,
  animationHint,
  animationDelay = 0,
  onToggleStatus,
}: TaskCardProps) {
  const isComplete = task.status === 'completed'
  const researchActions: ResearchAction[] = (task.actions ?? []).filter(
    (action): action is ResearchAction => action.type === 'research',
  )
  const bookingActions: BookingAction[] = (task.actions ?? []).filter(
    (action): action is BookingAction => action.type === 'booking',
  )
  const uploadActions: UploadAction[] = (task.actions ?? []).filter(
    (action): action is UploadAction => action.type === 'upload',
  )
  const linkActions: LinkAction[] = (task.actions ?? []).filter(
    (action): action is LinkAction => action.type === 'link',
  )
  const noteActions: NoteAction[] = (task.actions ?? []).filter(
    (action): action is NoteAction => action.type === 'note',
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
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-white shadow"
            style={{ backgroundColor: accentColor }}
          >
            {task.timeframe}
          </span>
          {onToggleStatus ? (
            <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              <input
                type="checkbox"
                checked={isComplete}
                onChange={() => onToggleStatus(task.id, isComplete ? 'pending' : 'completed')}
                className="h-3 w-3 rounded border border-slate-400 text-sky-400 focus:ring-sky-300"
              />
              Done
            </label>
          ) : null}
        </div>
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

      {uploadActions.length ? (
        <div className="space-y-3">
          {uploadActions.map((action, index) => (
            <UploadActionCard key={`${task.id}-upload-${index}`} taskId={task.id} action={action} />
          ))}
        </div>
      ) : null}

      {bookingActions.length ? (
        <div className="space-y-3">
          {bookingActions.map((action, index) => (
            <BookingActionCard key={`${task.id}-booking-${index}`} taskId={task.id} action={action} />
          ))}
        </div>
      ) : null}

      {researchActions.length ? (
        <div className="space-y-3">
          {researchActions.map((action, index) => (
            <ResearchActionCard
              key={`${task.id}-research-${index}`}
              taskId={task.id}
              task={task}
              serviceLabel={serviceLabel}
              relocationProfile={relocationProfile}
              action={action}
              initialState={task.researchState}
            />
          ))}
        </div>
      ) : null}

      {linkActions.length ? (
        <div className="space-y-2 text-xs">
          {linkActions.map((action, index) => (
            <a
              key={`${task.id}-link-${index}`}
              href={action.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sky-200 hover:bg-sky-500/20"
            >
              <span className="font-semibold uppercase tracking-[0.15em]">{action.label}</span>
              <span className="text-[11px] text-sky-200/80">Open</span>
            </a>
          ))}
        </div>
      ) : null}

      {noteActions.length ? (
        <div className="space-y-2 text-xs text-slate-300/90">
          {noteActions.map((action, index) => (
            <p key={`${task.id}-note-${index}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              {action.text}
            </p>
          ))}
        </div>
      ) : null}
    </article>
  )
}
