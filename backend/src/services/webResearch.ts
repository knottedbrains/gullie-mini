import { appendResearchResults, updateResearchQuery, type ResearchQuery } from '../storage/researchStore'

const OPENAI_API_URL = 'https://api.openai.com/v1/responses'
const DEFAULT_MODEL = process.env.OPENAI_RESEARCH_MODEL ?? 'gpt-4.1-mini'

interface StructuredResult {
  summary?: string
  results: Array<{
    title: string
    url: string
    summary?: string
    source?: string
    score?: number
  }>
}

const webResultsSchema = {
  name: 'web_research_results',
  description: 'Structured web research output',
  schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'High level synthesis of the findings',
      },
      results: {
        type: 'array',
        minItems: 1,
        maxItems: 6,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            url: { type: 'string' },
            summary: { type: 'string' },
            source: { type: 'string' },
            score: { type: 'number' },
          },
          required: ['title', 'url'],
        },
      },
    },
    required: ['results'],
    additionalProperties: false,
  },
}

async function callOpenAIForResearch(query: ResearchQuery): Promise<StructuredResult | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return null
  }

  const payload = {
    model: DEFAULT_MODEL,
    input: [
      {
        role: 'system',
        content:
          'You are a relocation research assistant. Use live web knowledge to surface current, credible sources. Focus on actionable insights and provide links the user can follow.',
      },
      {
        role: 'user',
        content: `Research the following prompt and return concise findings: ${query.query}`,
      },
    ],
    response_format: { type: 'json_schema', json_schema: webResultsSchema },
    temperature: 0.2,
    web: { search: { enable: true } },
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI research error: ${text}`)
  }

  const data = (await response.json()) as any
  const output = Array.isArray(data.output) ? data.output : []
  for (const chunk of output) {
    if (!chunk || typeof chunk !== 'object') continue
    const content = Array.isArray(chunk.content) ? chunk.content : []
    for (const part of content) {
      if (part?.type === 'output_text' && typeof part.text === 'string') {
        try {
          const parsed = JSON.parse(part.text) as StructuredResult
          if (parsed && Array.isArray(parsed.results)) {
            return parsed
          }
        } catch (error) {
          console.warn('Failed to parse research JSON response.', error)
        }
      }
    }
  }

  return null
}

export async function runWebResearch(query: ResearchQuery) {
  await updateResearchQuery(query.id, { status: 'in_progress', error: null })

  try {
    const structured = await callOpenAIForResearch(query)
    if (structured && structured.results.length) {
      await appendResearchResults(
        query.id,
        structured.results.map((result) => ({
          title: result.title,
          summary: result.summary ?? structured.summary ?? 'No summary provided',
          url: result.url,
          source: result.source,
          score: result.score,
        })),
      )
      await updateResearchQuery(query.id, {
        status: 'complete',
        error: null,
      })
      return
    }

    // fallback if no structured response
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
