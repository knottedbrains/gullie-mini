import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock, Info } from 'lucide-react'
import clsx from 'clsx'
import type { TaskAction } from '../types/timeline'

type BookingAction = Extract<TaskAction, { type: 'booking' }>

interface BookingActionCardProps {
  taskId: string
  action: BookingAction
}

interface BookingRecord {
  date: string
  time: string
  note?: string
  savedAt: string
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function storageKey(taskId: string, action: BookingAction) {
  return `gullie-mini:booking:${taskId}:${action.id ?? slugify(action.label)}`
}

export function BookingActionCard({ taskId, action }: BookingActionCardProps) {
  const key = useMemo(() => storageKey(taskId, action), [taskId, action])
  const [record, setRecord] = useState<BookingRecord | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as BookingRecord
      if (parsed?.date && parsed?.time) {
        return parsed
      }
      return null
    } catch (error) {
      console.warn('Failed to read booking state', error)
      return null
    }
  })
  const [date, setDate] = useState(record?.date ?? '')
  const [time, setTime] = useState(record?.time ?? '')
  const [note, setNote] = useState(record?.note ?? '')
  const [status, setStatus] = useState<'idle' | 'scheduled'>(record ? 'scheduled' : 'idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'scheduled' && record) {
      try {
        window.localStorage.setItem(key, JSON.stringify(record))
      } catch (storageError) {
        console.warn('Failed to persist booking state', storageError)
      }
    }
  }, [key, status, record])

  const handleSubmit = useCallback(() => {
    if (!date || !time) {
      setError('Select both a date and a start time to confirm the booking.')
      return
    }
    setError(null)
    const saved: BookingRecord = {
      date,
      time,
      note: note?.trim() ? note.trim() : undefined,
      savedAt: new Date().toISOString(),
    }
    setRecord(saved)
    setStatus('scheduled')
  }, [date, time, note])

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-200">
          <CalendarDays className="h-5 w-5" />
        </span>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold text-white">{action.label}</p>
          {action.instructions ? (
            <p className="text-xs text-slate-300/90">{action.instructions}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-300">
          Date
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-300">
          Start time
          <input
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-300">
        Notes (optional)
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
          placeholder="Share context for the consultant"
        />
      </label>

      {action.calendarHint ? (
        <p className="flex items-start gap-2 text-xs text-slate-400">
          <Info className="mt-0.5 h-3.5 w-3.5 text-slate-500" />
          {action.calendarHint}
        </p>
      ) : null}

      {error ? <p className="text-xs text-rose-400">{error}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          className={clsx(
            'inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow transition',
            status === 'scheduled' ? 'opacity-90 hover:bg-sky-400' : 'hover:bg-sky-400',
          )}
        >
          <Clock className="h-4 w-4" />
          {action.ctaLabel ?? 'Save booking'}
        </button>
        {status === 'scheduled' && record ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Scheduled for {record.date} at {record.time}
          </span>
        ) : null}
      </div>
    </div>
  )
}
