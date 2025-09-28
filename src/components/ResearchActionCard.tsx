import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Globe, Loader2, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import type {
  RelocationProfile,
  TaskAction,
  TimelineResearchState,
  TimelineTask,
} from '../types/timeline'

type ResearchAction = Extract<TaskAction, { type: 'research' }>

interface ResearchActionCardProps {
  taskId: string
  task: TimelineTask
  serviceLabel: string
  relocationProfile: RelocationProfile
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

const KNOWN_CITY_COUNTRIES: Record<string, string> = {
  paris: 'France',
  london: 'United Kingdom',
  berlin: 'Germany',
  munich: 'Germany',
  hamburg: 'Germany',
  frankfurt: 'Germany',
  madrid: 'Spain',
  barcelona: 'Spain',
  rome: 'Italy',
  milan: 'Italy',
  amsterdam: 'Netherlands',
  zurich: 'Switzerland',
  geneva: 'Switzerland',
  vienna: 'Austria',
  copenhagen: 'Denmark',
  stockholm: 'Sweden',
  oslo: 'Norway',
  helsinki: 'Finland',
  'new york': 'United States',
  'new york city': 'United States',
  'san francisco': 'United States',
  'los angeles': 'United States',
  chicago: 'United States',
  boston: 'United States',
  seattle: 'United States',
  toronto: 'Canada',
  vancouver: 'Canada',
  montreal: 'Canada',
  sydney: 'Australia',
  melbourne: 'Australia',
  brisbane: 'Australia',
  tokyo: 'Japan',
  singapore: 'Singapore',
  'hong kong': 'Hong Kong',
  dublin: 'Ireland',
  edinburgh: 'United Kingdom',
  lisbon: 'Portugal',
  brussels: 'Belgium',
  prague: 'Czech Republic',
  budapest: 'Hungary',
  warsaw: 'Poland',
  dubai: 'United Arab Emirates',
  mumbai: 'India',
  bangalore: 'India',
  bengaluru: 'India',
  delhi: 'India',
  'new delhi': 'India',
  beijing: 'China',
  shanghai: 'China',
  seoul: 'South Korea',
  bangkok: 'Thailand',
  'kuala lumpur': 'Malaysia',
  jakarta: 'Indonesia',
  manila: 'Philippines',
  'mexico city': 'Mexico',
  bogota: 'Colombia',
  'buenos aires': 'Argentina',
  'são paulo': 'Brazil',
  'sao paulo': 'Brazil',
  'rio de janeiro': 'Brazil',
  santiago: 'Chile',
  lima: 'Peru',
  'tel aviv': 'Israel',
  cairo: 'Egypt',
  johannesburg: 'South Africa',
  'cape town': 'South Africa',
  nairobi: 'Kenya',
  lagos: 'Nigeria',
}

function normalizePlaceholder(value?: string | null) {
  return value?.trim() ? value.trim() : undefined
}

function resolveCountryFromCity(city?: string | null) {
  if (!city) {
    return undefined
  }
  const normalized = city.trim()
  if (!normalized) {
    return undefined
  }
  const key = normalized.toLowerCase()
  return KNOWN_CITY_COUNTRIES[key] ?? normalized
}

function resolveTemplatePlaceholders(query: string, relocationProfile: RelocationProfile): string {
  const now = new Date()
  const replacements: Record<string, string | undefined> = {
    destination_city: normalizePlaceholder(relocationProfile.toCity),
    destination_country: resolveCountryFromCity(relocationProfile.toCity),
    origin_city: normalizePlaceholder(relocationProfile.fromCity),
    origin_country: resolveCountryFromCity(relocationProfile.fromCity),
    current_year: `${now.getFullYear()}`,
  }

  let output = query
  for (const [key, value] of Object.entries(replacements)) {
    const token = new RegExp(`\\{\\{\s*${key}\s*\\}\}`, 'gi')
    output = value ? output.replace(token, value) : output.replace(token, '')
  }
  return output.replace(/\s{2,}/g, ' ').trim()
}

function customizeQueryForLocation(query: string, relocationProfile: RelocationProfile): string {
  if (!query.trim()) {
    return query
  }
  let customizedQuery = resolveTemplatePlaceholders(query, relocationProfile)

  if (!relocationProfile.fromCity && !relocationProfile.toCity) {
    return customizedQuery
  }

  if (relocationProfile.toCity) {
    const destination = relocationProfile.toCity.trim()
    customizedQuery = customizedQuery.replace(/\bBerlin\b/gi, destination)
  }

  if (relocationProfile.toCity) {
    const destinationCountry = resolveCountryFromCity(relocationProfile.toCity)
    if (destinationCountry) {
      customizedQuery = customizedQuery.replace(/\bGermany\b/gi, destinationCountry)
      customizedQuery = customizedQuery.replace(/\bGerman\b/gi, destinationCountry)
    }
  }

  if (customizedQuery.toLowerCase().includes('visa') || customizedQuery.toLowerCase().includes('immigration')) {
    const fromCountry = resolveCountryFromCity(relocationProfile.fromCity) ?? 'origin country'
    const toCountry = resolveCountryFromCity(relocationProfile.toCity) ?? 'destination country'

    if (relocationProfile.fromCity && relocationProfile.toCity) {
      customizedQuery = customizedQuery.replace(
        /visa.*requirements.*for.*citizens/gi,
        `visa requirements for ${fromCountry} citizens`
      )

      if (customizedQuery.toLowerCase().includes('biometrics appointment')) {
        customizedQuery = customizedQuery.replace(
          /.*biometrics appointment.*/gi,
          `How to prepare for ${toCountry} visa biometrics appointment in ${relocationProfile.fromCity} ${new Date().getFullYear()}`
        )
      }
    }
  }

  return customizedQuery
}

function isLocationAlreadyInQuery(query: string, relocationProfile: RelocationProfile): boolean {
  const queryLower = query.toLowerCase()

  // Check if query contains country names (more reliable than city names for visa queries)
  if (relocationProfile.fromCity) {
    const fromCountry = resolveCountryFromCity(relocationProfile.fromCity)?.toLowerCase()
    if (fromCountry && queryLower.includes(fromCountry)) {
      return true
    }
  }

  if (relocationProfile.toCity) {
    const toCountry = resolveCountryFromCity(relocationProfile.toCity)?.toLowerCase()
    if (toCountry && queryLower.includes(toCountry)) {
      return true
    }
  }

  // Check if query contains city names
  if (relocationProfile.fromCity && queryLower.includes(relocationProfile.fromCity.toLowerCase())) {
    return true
  }

  if (relocationProfile.toCity && queryLower.includes(relocationProfile.toCity.toLowerCase())) {
    return true
  }

  // Check for visa-related patterns that indicate location context is already present
  if (queryLower.includes('visa') || queryLower.includes('biometrics')) {
    return true // Don't add extra location info to visa queries that are already customized
  }

  return false
}

function buildSuggestedQuery(
  action: ResearchAction,
  task: TimelineTask,
  serviceLabel: string,
  relocationProfile: RelocationProfile,
) {
  const pieces: string[] = []

  if (action.defaultQuery?.trim()) {
    // Customize the default query based on relocation profile
    const customizedQuery = customizeQueryForLocation(action.defaultQuery.trim(), relocationProfile)
    pieces.push(customizedQuery)

    // For customized queries, don't add extra location info
    if (isLocationAlreadyInQuery(customizedQuery, relocationProfile)) {
      // Only add timeframe if present
      if (task.timeframe?.trim()) {
        pieces.push(`timeline ${task.timeframe.trim()}`)
      }

      // Add move date if available and not a visa query
      if (relocationProfile.moveDate && !customizedQuery.toLowerCase().includes('visa')) {
        const formatted = new Date(relocationProfile.moveDate)
        if (!Number.isNaN(formatted.getTime())) {
          pieces.push(
            `for ${formatted.toLocaleDateString(undefined, {
              month: 'long',
              year: 'numeric',
            })}`,
          )
        }
      }

      return pieces.join(' ').replace(/\s+/g, ' ').trim()
    }
  } else {
    pieces.push(`${task.title} ${serviceLabel.toLowerCase()}`)
  }

  // For non-customized queries or queries without location context, add location info
  if (task.timeframe?.trim()) {
    pieces.push(`timeline ${task.timeframe.trim()}`)
  }

  if (relocationProfile.toCity) {
    pieces.push(`in ${relocationProfile.toCity}`)
  }
  if (relocationProfile.fromCity) {
    pieces.push(`from ${relocationProfile.fromCity}`)
  }

  if (relocationProfile.moveDate) {
    const formatted = new Date(relocationProfile.moveDate)
    if (!Number.isNaN(formatted.getTime())) {
      pieces.push(
        `for ${formatted.toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        })}`,
      )
    }
  }

  return pieces.join(' ').replace(/\s+/g, ' ').trim()
}

export function ResearchActionCard({
  taskId,
  task,
  serviceLabel,
  relocationProfile,
  action,
  initialState,
}: ResearchActionCardProps) {
  const suggestedQuery = useMemo(
    () => buildSuggestedQuery(action, task, serviceLabel, relocationProfile),
    [action, task, serviceLabel, relocationProfile],
  )
  const [queryText, setQueryText] = useState(initialState?.lastQuery ?? suggestedQuery)
  const [hasUserEdited, setHasUserEdited] = useState(Boolean(initialState?.lastQuery))
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
    if (suggestedQuery) {
      return `Suggested: ${suggestedQuery}`
    }
    return 'Ask a question for the web to research'
  }, [action.placeholder, suggestedQuery])

  useEffect(() => {
    if (!hasUserEdited) {
      setQueryText(suggestedQuery)
    }
  }, [suggestedQuery, hasUserEdited])

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
        setQueryText(payload.latest!.query)
        setHasUserEdited(true)
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
            setHasUserEdited(true)
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
            onChange={(event) => {
              setQueryText(event.target.value)
              setHasUserEdited(true)
            }}
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
