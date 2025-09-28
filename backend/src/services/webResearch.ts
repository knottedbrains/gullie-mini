import OpenAI from 'openai'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { appendResearchResults, updateResearchQuery, type ResearchQuery } from '../storage/researchStore'

const backendEnvPath = path.resolve(__dirname, '../../.env')
const projectRootEnvPath = path.resolve(__dirname, '../../../.env')

if (fs.existsSync(projectRootEnvPath)) {
  dotenv.config({ path: projectRootEnvPath })
}
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath })
}

const DEFAULT_MODEL = process.env.OPENAI_RESEARCH_MODEL ?? 'gpt-5'

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set. Add it to your environment variables before running web search.')
  }
  return new OpenAI({ apiKey })
}

interface StructuredResult {
  summary?: string
  results?: Array<{
    title: string
    url: string
    summary?: string
    source?: string
    score?: number
  }>
}

async function callOpenAIForResearch(query: ResearchQuery): Promise<StructuredResult | null> {
  const client = getOpenAIClient()

  const response = await client.responses.create({
    model: DEFAULT_MODEL,
    tools: [{ type: 'web_search' }],
    tool_choice: 'auto',
    temperature: 0.2,
    input: `Provide a short summary and three source links for the following relocation question:
- Question: ${query.query}
- Format exactly:
Summary: <one or two sentences>
Sources:
- <Title> — <short takeaway> (<https://...>)
- <Title> — <short takeaway> (<https://...>)
- <Title> — <short takeaway> (<https://...>)
Ensure each URL is clickable (starts with https://).
Prioritise official government, municipal, consulate, or major institutional sources; avoid community forums or unverified blogs.`,
  })

  let fullText = typeof response.output_text === 'string' ? response.output_text.trim() : ''

  const citations = new Map<string, { title?: string; url: string }>()

  const outputItems = Array.isArray(response.output) ? response.output : []
  for (const item of outputItems) {
    if (!item || typeof item !== 'object') continue
    if (item.type === 'message') {
      const messageContents = Array.isArray((item as any).content) ? (item as any).content : []
      for (const part of messageContents) {
        if (typeof part?.text === 'string') {
          fullText = fullText || part.text.trim()
        }
        const annotations = Array.isArray(part?.annotations) ? part.annotations : []
        for (const annotation of annotations) {
          if (annotation?.type === 'url_citation' && typeof annotation.url === 'string') {
            citations.set(annotation.url, {
              url: annotation.url,
              title: annotation.title ?? undefined,
            })
          }
        }
      }
    }
    if (item.type === 'web_search_call') {
      const action = (item as any).action
      const sources = Array.isArray(action?.sources) ? action.sources : []
      for (const source of sources) {
        if (source?.url) {
          citations.set(source.url, {
            url: source.url,
            title: source.title ?? undefined,
          })
        }
      }
    }
  }

  const results = Array.from(citations.values()).map((entry) => ({
    title: entry.title ?? entry.url,
    url: entry.url,
    summary: '',
    source: entry.title,
  }))

  const { summary: cleanedSummary, bullets } = extractBulletPoints(fullText)
  if (process.env.NODE_ENV !== 'production') {
    console.log('[research] raw output:', fullText)
    console.log('[research] parsed summary:', cleanedSummary)
    console.log('[research] parsed bullets:', bullets)
    console.log('[research] citations:', Array.from(citations.values()))
  }

  const combinedResults = bullets.length
    ? bullets
    : results.length
      ? results
      : []

  const summaryOutput = cleanedSummary || fullText || undefined

  if (summaryOutput || combinedResults.length) {
    return {
      summary: summaryOutput,
      results: combinedResults,
    }
  }

  if (fullText) {
    return {
      summary: fullText,
      results: [],
    }
  }

  return null
}

function extractBulletPoints(text: string): { summary: string; bullets: Array<{ title: string; url: string; summary?: string; source?: string }> } {
  if (!text) {
    return { summary: '', bullets: [] }
  }

  const lines = text.split(/\r?\n/)
  const bulletRegex = /^\s*[-•]\s*(.+?)\s+—\s+(.+?)\s*\((https?:\/\/[^\s)]+)\)\s*$/
  const bullets: Array<{ title: string; url: string; summary?: string; source?: string }> = []
  const nonBulletLines: string[] = []

  for (const line of lines) {
    const match = line.match(bulletRegex)
    if (match) {
      bullets.push({
        title: match[1].trim(),
        summary: match[2].trim(),
        url: match[3].trim(),
      })
    } else {
      nonBulletLines.push(line)
    }
  }

  return {
    summary: nonBulletLines.join('\n').trim(),
    bullets,
  }
}

export async function runWebResearch(query: ResearchQuery) {
  await updateResearchQuery(query.id, { status: 'in_progress', error: null })

  try {
    const structured = await callOpenAIForResearch(query)
    if (structured) {
      const normalizedResults = (structured.results ?? []).filter((item) => item && typeof item.title === 'string')
      const fallbackSummary = structured.summary?.trim()
      const resultsToPersist = normalizedResults.length
        ? normalizedResults.map((result) => ({
            title: result.title,
            summary: result.summary ?? fallbackSummary ?? 'No summary provided',
            url: result.url ?? '',
            source: result.source,
            score: result.score,
          }))
        : fallbackSummary
          ? [
              {
                title: 'Summary',
                summary: fallbackSummary,
                url: '',
                source: 'model-summary',
                score: null,
              },
            ]
          : []

      if (resultsToPersist.length) {
        await appendResearchResults(query.id, resultsToPersist)
        await updateResearchQuery(query.id, {
          status: 'complete',
          error: null,
        })
        return
      }

      await updateResearchQuery(query.id, {
        status: 'failed',
        error: 'No content returned from web search.',
      })
      return
    }

    // fallback if no structured response at all
    await appendResearchResults(query.id, [
      {
        title: 'No structured results returned',
        summary:
          'The model did not return structured findings. Try rephrasing your query or run again later.',
        url: 'https://platform.openai.com/docs/guides/reasoning/about',
      },
    ])
    await updateResearchQuery(query.id, {
      status: 'failed',
      error: 'No results were returned from the research request.',
    })
  } catch (error) {
    console.error('Web research failed', error)
    await appendResearchResults(query.id, [
      {
        title: 'Research request failed',
        summary:
          error instanceof Error ? error.message : 'Unknown error while calling OpenAI research.',
        url: 'https://status.openai.com',
      },
    ])
    await updateResearchQuery(query.id, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
