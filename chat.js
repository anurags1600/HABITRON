// api/chat.js — Vercel Serverless Function
// Groq API key is stored in Vercel Environment Variables (never in frontend)

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return res.status(500).json({
      error: "GROQ_API_KEY not set. Vercel Dashboard → Settings → Environment Variables mein daalo."
    });
  }

  const { messages, max_tokens, temperature, model } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model:       model       || "llama-3.3-70b-versatile",
        max_tokens:  max_tokens  || 1500,
        temperature: temperature ?? 0.75,
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Groq API error"
      });
    }

    return res.status(200).json({
      content: data.choices[0].message.content
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
