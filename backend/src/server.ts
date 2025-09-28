import express, { Request, Response } from "express"
import cors from "cors"
import dotenv from "dotenv"
import {
  createResearchQuery,
  getResearchQuery,
  getResultsForQuery,
  getTaskResearch,
  listQueriesForTask,
} from './storage/researchStore'
import { runWebResearch } from './services/webResearch'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// Realtime Ephemeral Key endpoint
app.post("/api/ephemeral-key", async (req: Request, res: Response) => {
  try {
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error:", errText);
      return res.status(500).json({ error: "Failed to create ephemeral key" });
    }

    const data = await response.json();
    res.json(data) // return full object with client_secret
  } catch (err) {
    console.error("Error creating ephemeral key:", err);
    res.status(500).json({ error: "Failed to create ephemeral key" });
  }
});

app.post('/api/research/search', async (req: Request, res: Response) => {
  const { taskId, query } = req.body ?? {}
  if (typeof taskId !== 'string' || !taskId.trim()) {
    return res.status(400).json({ error: 'taskId is required' })
  }
  if (typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'query is required' })
  }

  try {
    const researchQuery = await createResearchQuery(taskId.trim(), query.trim())
    // Kick off research asynchronously
    void runWebResearch(researchQuery)
    res.status(202).json({ queryId: researchQuery.id })
  } catch (error) {
    console.error('Failed to create research query', error)
    res.status(500).json({ error: 'Failed to start research query' })
  }
})

app.get('/api/research/task/:taskId', async (req: Request, res: Response) => {
  const { taskId } = req.params
  if (!taskId) {
    return res.status(400).json({ error: 'taskId is required' })
  }
  try {
    const { latest, results } = await getTaskResearch(taskId)
    const history = await listQueriesForTask(taskId)
    res.json({ taskId, latest, results, history })
  } catch (error) {
    console.error('Failed to load task research', error)
    res.status(500).json({ error: 'Failed to load research for task' })
  }
})

app.get('/api/research/query/:queryId', async (req: Request, res: Response) => {
  const { queryId } = req.params
  if (!queryId) {
    return res.status(400).json({ error: 'queryId is required' })
  }
  try {
    const queryRecord = await getResearchQuery(queryId)
    if (!queryRecord) {
      return res.status(404).json({ error: 'Query not found' })
    }
    const results = await getResultsForQuery(queryId)
    res.json({ query: queryRecord, results })
  } catch (error) {
    console.error('Failed to load research query', error)
    res.status(500).json({ error: 'Failed to load research query' })
  }
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`)
})
