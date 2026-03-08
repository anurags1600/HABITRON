// api/chat.js — Vercel Serverless Function
// Groq API key: Vercel Dashboard → Settings → Environment Variables → GROQ_API_KEY

export default async function handler(req, res) {

  // ── CORS headers (required for browser fetch) ──
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  // ── Read body safely ──
  let body = req.body;

  // Vercel sometimes passes body as string — parse manually if needed
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON body: " + e.message });
    }
  }

  // Still empty? Try reading raw stream
  if (!body || typeof body !== "object") {
    try {
      const raw = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", chunk => { data += chunk; });
        req.on("end", () => resolve(data));
        req.on("error", reject);
      });
      body = JSON.parse(raw);
    } catch (e) {
      return res.status(400).json({ error: "Could not parse request body" });
    }
  }

  const { messages, max_tokens, temperature, model } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required and must not be empty" });
  }

  // ── API Key ──
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return res.status(500).json({
      error: "GROQ_API_KEY not set. Vercel Dashboard → Settings → Environment Variables mein daalo, phir Redeploy karo."
    });
  }

  // ── Call Groq ──
  let groqRes;
  try {
    groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
  } catch (networkErr) {
    return res.status(502).json({ error: "Groq se connect nahi hua: " + networkErr.message });
  }

  // ── Parse Groq response safely ──
  let data;
  try {
    const text = await groqRes.text();
    data = JSON.parse(text);
  } catch (parseErr) {
    return res.status(502).json({ error: "Groq response parse error: " + parseErr.message });
  }

  if (!groqRes.ok) {
    return res.status(groqRes.status).json({
      error: data?.error?.message || `Groq API error ${groqRes.status}`
    });
  }

  // ── Success ──
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    return res.status(502).json({ error: "Groq ne empty response diya" });
  }

  return res.status(200).json({ content });
}
