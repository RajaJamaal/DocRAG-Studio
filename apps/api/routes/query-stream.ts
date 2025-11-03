// Local type fallbacks to avoid requiring 'next' types in environments where Next.js isn't installed
type NextApiRequest = import("http").IncomingMessage & {
  query?: Record<string, any> | string;
  body?: any;
};

type NextApiResponse<T = any> = import("http").ServerResponse & {
  json?: (body: T) => void;
  setHeader: (name: string, value: number | string | string[]) => void;
  write: (chunk: any) => boolean;
  end: (data?: any) => void;
};

import { loadVectorStore } from "../../../packages/retrieval/vectorStoreLoader";
import { buildPrompt } from "../../../packages/retrieval/ragChain";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const q =
    req.query && typeof req.query === "object" && typeof (req.query as Record<string, any>).q === "string"
      ? (req.query as Record<string, any>).q
      : req.body?.q;
  if (!q) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: "Query 'q' required" })}\n\n`);
    res.end();
    return;
  }

  try {
    const retriever = await loadVectorStore();
    const contexts = await retriever.similaritySearch(q, 3);
    const prompt = buildPrompt(q, contexts);

    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY not set in env");

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.0,
        max_tokens: 800,
        stream: true,
      }),
    });

    if (!resp.body) throw new Error("No response body from OpenAI");

    const reader = resp.body.getReader();
    let buffer = "";
    let done = false;
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        buffer += new TextDecoder().decode(value);
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              res.write(`event: done\ndata: [DONE]\n\n`);
              res.end();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const token = parsed.choices?.[0]?.delta?.content;
              if (token) {
                res.write(`event: token\ndata: ${JSON.stringify({ token })}\n\n`);
              }
            } catch {}
          }
        }
      }
    }
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
    res.end();
  }
}
