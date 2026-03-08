// api/verify-proof.js — Vercel Serverless Function
// Uses Groq vision model to check if uploaded proof image is genuine study work

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    // Don't block user if key missing — just accept proof
    return res.status(200).json({ valid: true, reason: "" });
  }

  const { imageDataUrl, taskName } = req.body;
  if (!imageDataUrl) {
    return res.status(400).json({ error: "imageDataUrl required" });
  }

  // Validate base64 format
  const matches = imageDataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    return res.status(400).json({ error: "Invalid image format" });
  }

  const mimeType   = matches[1];
  const base64Data = matches[2];

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model:       "meta-llama/llama-4-scout-17b-16e-instruct",
        max_tokens:  150,
        temperature: 0.1,
        messages: [{
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`
              }
            },
            {
              type: "text",
              text: `Student ne ye image proof ke taur pe bheja hai task ke liye: ${taskName || "study task"}

Decide karo — ye valid study proof hai ya nahi?

VALID: notes, textbook page, screen with study content, handwritten work, solved problems
INVALID: blank/dark image, haath ya chehra, random photo, selfie, food, unrelated content

Respond with ONLY: VALID ya INVALID
Fir ek line mein reason (Hinglish mein)`
            }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      // Groq error — accept proof, don't block user
      return res.status(200).json({ valid: true, reason: "" });
    }

    const text    = data.choices[0].message.content.trim();
    const isValid = text.toUpperCase().startsWith("VALID");
    const lines   = text.split("\n");
    const reason  = !isValid && lines.length > 1
      ? lines.slice(1).join(" ").trim()
      : "Ye proof nahi hai. Actual kaam dikha — notes, screen, ya jo bhi kiya.";

    return res.status(200).json({ valid: isValid, reason: isValid ? "" : reason });

  } catch (err) {
    // Network error — accept proof silently
    return res.status(200).json({ valid: true, reason: "" });
  }
}
