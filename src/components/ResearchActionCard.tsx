import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Globe, Loader2, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import type { TaskAction, TimelineResearchState } from '../types/timeline'

type ResearchAction = Extract<TaskAction, { type: 'research' }>

interface ResearchActionCardProps {
  taskId: string
  action: ResearchAction
  initialState?: TimelineResearchState
}

interface ResearchResultItem {
  id: string
  title: string
  summary: string
  url: string
  source?: string
  score?: number | null
}

type QueryStatus = TimelineResearchState['status']

const ACTIVE_STATUSES: QueryStatus[] = ['pending', 'in_progress']

export function ResearchActionCard({ taskId, action, initialState }: ResearchActionCardProps) {
  const [queryText, setQueryText] = useState(action.defaultQuery ?? '')
  const [status, setStatus] = useState<QueryStatus>(initialState?.status ?? 'idle')
  const [latestQueryId, setLatestQueryId] = useState<string | undefined>(initialState?.lastQueryId)
  const [results, setResults] = useState<ResearchResultItem[]>([])
  const [error, setError] = useState<string | undefined>(undefined)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isLoading = ACTIVE_STATUSES.includes(status ?? 'idle')

  const effectivePlaceholder = useMemo(() => {
    if (action.placeholder) {
      return action.placeholder
    }
    return 'Ask a question for the web to research'
  }, [action.placeholder])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const loadQuery = useCallback(async () => {
    try {
      const response = await fetch(`/api/research/task/${encodeURIComponent(taskId)}`)
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }
      const payload = (await response.json()) as {
        latest: { id: string; query: string; status: QueryStatus } | null
        results: ResearchResultItem[]
      }
      if (payload.latest) {
        setQueryText((prev) => prev || payload.latest!.query)
        setLatestQueryId(payload.latest.id)
        setStatus(payload.latest.status ?? 'complete')
      }
      setResults(payload.results ?? [])
    } catch (err) {
      console.warn('Failed to load research state', err)
    }
  }, [taskId])

  const pollQueryUntilComplete = useCallback(
    (queryId: string) => {
      stopPolling()
      pollingRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/research/query/${encodeURIComponent(queryId)}`)
          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`)
          }
          const payload = (await response.json()) as {
            query: { status: QueryStatus; query: string; error?: string | null }
            results: ResearchResultItem[]
          }
          setResults(payload.results ?? [])
          setStatus(payload.query?.status ?? 'complete')
          if (payload.query?.query) {
            setQueryText(payload.query.query)
          }
          if (payload.query?.error) {
            setError(payload.query.error)
          }
          if (!ACTIVE_STATUSES.includes(payload.query?.status ?? 'idle')) {
            stopPolling()
          }
        } catch (err) {
          console.warn('Failed to poll research results', err)
          stopPolling()
          setStatus('failed')
          setError('Unable to fetch research updates. Please try again later.')
        }
      }, 2500)
    },
    [stopPolling],
  )

  useEffect(() => {
    void loadQuery()
    return () => {
      stopPolling()
    }
  }, [loadQuery, stopPolling])

  const handleSearch = useCallback(async () => {
    const trimmed = queryText.trim()
    if (!trimmed) {
      setError('Enter a question to run research.')
      return
    }
    setError(undefined)
    setStatus('in_progress')
    setResults([])
    try {
      const response = await fetch('/api/research/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId, query: trimmed }),
      })
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }
      const payload = (await response.json()) as { queryId: string }
      setLatestQueryId(payload.queryId)
      pollQueryUntilComplete(payload.queryId)
    } catch (err) {
      console.error('Failed to start research', err)
      setStatus('failed')
      setError('Unable to start research request. Please try again.')
    }
  }, [pollQueryUntilComplete, queryText, taskId])

  const handleRetry = useCallback(() => {
    void handleSearch()
  }, [handleSearch])

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'in_progress':
      case 'pending':
        return 'Searching the web…'
      case 'complete':
        return 'Latest web findings'
      case 'failed':
        return 'Search failed'
      default:
        return results.length ? 'Latest web findings' : 'Ready to research'
    }
  }, [status, results.length])

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-300/80">
          {action.label}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={queryText}
            placeholder={effectivePlaceholder}
            onChange={(event) => setQueryText(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={handleSearch}
            className={clsx(
              'inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow transition',
              isLoading ? 'opacity-70' : 'hover:bg-sky-400',
            )}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            {isLoading ? 'Searching' : 'Run search'}
          </button>
        </div>
        {action.hint ? (
          <p className="text-xs text-slate-400">{action.hint}</p>
        ) : null}
      </div>

      <div className="rounded-xl border border-white/5 bg-slate-900/50 p-3 text-sm text-slate-200">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-slate-100">{statusLabel}</p>
          {status === 'failed' ? (
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-300 hover:text-sky-200"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          ) : null}
        </div>
        {error ? <p className="mt-2 text-xs text-rose-400">{error}</p> : null}
        <div className="mt-3 space-y-3">
          {isLoading && results.length === 0 ? (
            <p className="text-xs text-slate-400">Gathering the latest articles…</p>
          ) : null}
          {results.length === 0 && !isLoading ? (
            <p className="text-xs text-slate-400">No results yet. Try describing what you want to learn.</p>
          ) : null}
          {results.length > 0 ? (
            <ul className="space-y-3">
              {results.map((item) => (
                <li key={item.id} className="space-y-1">
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-sky-300 hover:text-sky-200 hover:underline"
                    >
                      {item.title}
                    </a>
                  ) : (
                    <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                  )}
                  {item.summary ? (
                    <p className="text-xs leading-5 text-slate-300/90">{item.summary}</p>
                  ) : null}
                  <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    {item.source ? <span>{item.source}</span> : null}
                    {typeof item.score === 'number' ? <span>Score: {item.score.toFixed(2)}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {latestQueryId ? (
          <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Query ID: {latestQueryId.slice(0, 8)}
          </p>
        ) : null}
      </div>
    </div>
  )
}
