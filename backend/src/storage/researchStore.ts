import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const DATA_DIR = path.resolve(__dirname, '../../data')
const DATA_FILE = path.join(DATA_DIR, 'research.json')

export type ResearchStatus = 'pending' | 'in_progress' | 'complete' | 'failed'

export interface ResearchQuery {
  id: string
  taskId: string
  query: string
  status: ResearchStatus
  createdAt: string
  updatedAt: string
  error?: string | null
}

export interface ResearchResult {
  id: string
  queryId: string
  title: string
  summary: string
  url: string
  source?: string
  score?: number | null
  createdAt: string
}

interface ResearchStoreState {
  queries: ResearchQuery[]
  results: ResearchResult[]
}

async function ensureStoreFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  try {
    await fs.access(DATA_FILE)
  } catch {
    const initial: ResearchStoreState = { queries: [], results: [] }
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8')
  }
}

async function readStore(): Promise<ResearchStoreState> {
  await ensureStoreFile()
  const raw = await fs.readFile(DATA_FILE, 'utf8')
  try {
    const parsed = JSON.parse(raw) as ResearchStoreState
    return {
      queries: Array.isArray(parsed.queries) ? parsed.queries : [],
      results: Array.isArray(parsed.results) ? parsed.results : [],
    }
  } catch (error) {
    console.warn('Failed to parse research store, resetting.', error)
    const fallback: ResearchStoreState = { queries: [], results: [] }
    await fs.writeFile(DATA_FILE, JSON.stringify(fallback, null, 2), 'utf8')
    return fallback
  }
}

async function writeStore(state: ResearchStoreState): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2), 'utf8')
}

export async function createResearchQuery(taskId: string, query: string): Promise<ResearchQuery> {
  const state = await readStore()
  const now = new Date().toISOString()
  const newQuery: ResearchQuery = {
    id: randomUUID(),
    taskId,
    query,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  }
  state.queries.push(newQuery)
  await writeStore(state)
  return newQuery
}

export async function updateResearchQuery(
  id: string,
  updates: Partial<Omit<ResearchQuery, 'id' | 'taskId' | 'createdAt'>>,
): Promise<ResearchQuery | null> {
  const state = await readStore()
  const index = state.queries.findIndex((item) => item.id === id)
  if (index === -1) {
    return null
  }
  const current = state.queries[index]
  const next: ResearchQuery = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  state.queries[index] = next
  await writeStore(state)
  return next
}

export interface CreateResearchResultInput {
  title: string
  summary: string
  url: string
  source?: string
  score?: number | null
}

export async function appendResearchResults(
  queryId: string,
  items: CreateResearchResultInput[],
): Promise<ResearchResult[]> {
  if (!items.length) {
    return []
  }
  const state = await readStore()
  const now = new Date().toISOString()
  const results: ResearchResult[] = items.map((item) => ({
    id: randomUUID(),
    queryId,
    title: item.title,
    summary: item.summary,
    url: item.url,
    source: item.source,
    score:
      typeof item.score === 'number' && Number.isFinite(item.score) ? item.score : item.score ?? null,
    createdAt: now,
  }))
  state.results.push(...results)
  await writeStore(state)
  return results
}

export async function getLatestQueryForTask(taskId: string): Promise<ResearchQuery | null> {
  const state = await readStore()
  const queries = state.queries
    .filter((query) => query.taskId === taskId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return queries[0] ?? null
}

export async function getResearchQuery(id: string): Promise<ResearchQuery | null> {
  const state = await readStore()
  return state.queries.find((query) => query.id === id) ?? null
}

export async function getResultsForQuery(queryId: string): Promise<ResearchResult[]> {
  const state = await readStore()
  return state.results
    .filter((result) => result.queryId === queryId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function getTaskResearch(taskId: string) {
  const latest = await getLatestQueryForTask(taskId)
  if (!latest) {
    return { latest: null, results: [] as ResearchResult[] }
  }
  const results = await getResultsForQuery(latest.id)
  return { latest, results }
}

export async function listQueriesForTask(taskId: string): Promise<ResearchQuery[]> {
  const state = await readStore()
  return state.queries
    .filter((query) => query.taskId === taskId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
