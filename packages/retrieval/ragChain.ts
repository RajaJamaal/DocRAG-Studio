import type { RetrieverLike } from "./vectorStoreLoader";

export type RAGResult = {
  answer: string;
  sources: Array<{ title?: string; id?: string; snippet?: string }>;
  raw?: any;
};

function buildPrompt(query: string, contexts: Array<{ pageContent: string; metadata?: any }>) {
  const contextText = contexts
    .map((c, i) => `[[source:${i}]]\n${c.pageContent}\n`)
    .join("\n---\n");

  const prompt = `You are a helpful assistant. Use the provided context to answer the question below.\nCite each fact by referencing the source id, like [source:0], [source:1].\nIf the answer is not contained in the provided context, say \"I don't know\".\n\nContext:\n${contextText}\nQuestion:\n${query}\n\nAnswer (include citations inline):`;

  return prompt;
}

async function callOpenAIChat(prompt: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set in env");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${text}`);
  }

  const payload = await res.json();
  const content = payload?.choices?.[0]?.message?.content ?? JSON.stringify(payload, null, 2);
  return { content, raw: payload };
}

export async function answerQuery(
  retriever: RetrieverLike,
  query: string,
  opts?: { topK?: number }
): Promise<RAGResult> {
  const topK = opts?.topK ?? 3;
  const contexts = await retriever.similaritySearch(query, topK);

  const prompt = buildPrompt(query, contexts as any);

  const llmResp = await callOpenAIChat(prompt);

  const citationRegex = /\[source:(\d+)\]/g;
  const sources: Array<{ title?: string; id?: string; snippet?: string }> = [];
  const seen = new Set<number>();
  let m;
  while ((m = citationRegex.exec(llmResp.content)) !== null) {
    const idx = parseInt(m[1], 10);
    if (!seen.has(idx) && contexts[idx]) {
      seen.add(idx);
      sources.push({ id: contexts[idx].metadata?.id ?? `${idx}`, title: contexts[idx].metadata?.title, snippet: contexts[idx].pageContent.slice(0, 400) });
    }
  }

  if (sources.length === 0) {
    for (let i = 0; i < Math.min(contexts.length, 3); i++) {
      sources.push({ id: contexts[i].metadata?.id ?? `${i}`, title: contexts[i].metadata?.title, snippet: contexts[i].pageContent.slice(0, 400) });
    }
  }

  return { answer: llmResp.content, sources, raw: llmResp.raw };
}
export function createRAGChain() {
  // placeholder RAG chain stub
  return {
    async run(query: string) {
      return { answer: `Stub answer for: ${query}`, sources: [] };
    },
  };
}
