import type { VercelRequest, VercelResponse } from '@vercel/node'

const MODEL = 'gpt-4o-realtime-preview-2024-12-17'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

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
        model: MODEL,
        voice: 'verse',
        modalities: ['audio', 'text'],
      }),
    })

    const payload = await response.json()

    if (!response.ok) {
      res.status(response.status).json({ error: payload })
      return
    }

    res.status(200).json(payload)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown server error' })
  }
}
