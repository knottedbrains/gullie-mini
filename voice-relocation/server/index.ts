import 'dotenv/config'
import cors from 'cors'
import express from 'express'

const app = express()

app.use(cors({ origin: true }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/ephemeral-key', async (_req, res) => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'Missing OPENAI_API_KEY environment variable.' })
    return
  }

  try {
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        voice: 'verse',
        modalities: ['audio', 'text'],
      }),
    })

    const payload = await response.json()

    if (!response.ok) {
      res.status(response.status).json({ error: payload })
      return
    }

    res.json(payload)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown server error' })
  }
})

const port = Number.parseInt(process.env.PORT ?? '4000', 10)

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`)
})
