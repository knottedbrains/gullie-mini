import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

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
    res.json(data); // return full object with client_secret
  } catch (err) {
    console.error("Error creating ephemeral key:", err);
    res.status(500).json({ error: "Failed to create ephemeral key" });
  }
});

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`)
})

