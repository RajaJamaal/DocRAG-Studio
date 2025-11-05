import type { RetrieverLike } from "./vectorStoreLoader/index.js";

export type RAGResult = {
  answer: string;
  sources: Array<{ title?: string; id?: string; snippet?: string }>;
  raw?: any;
  parsed?: any;
};

export function buildPrompt(query: string, contexts: Array<{ pageContent: string; metadata?: any }>) {
  console.log('[ragChain] buildPrompt entry', { query, contextCount: contexts.length });
  const contextText = contexts
    .map((c, i) => `[[source:${i}]]\n${c.pageContent}\n`)
    .join("\n---\n");

  const prompt = `You are a helpful assistant. Use the provided context to answer the question below.\nCite each fact by referencing the source id, like [source:0], [source:1].\nIf the answer is not contained in the provided context, say \"I don't know\".\n\nContext:\n${contextText}\nQuestion:\n${query}\n\nAnswer (include citations inline):`;

  return prompt;
}

async function callOpenAIChat(prompt: string) {
  console.log('[ragChain] callOpenAIChat entry; prompt len=', prompt.length);
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set in env");

  console.log('[ragChain] sending request to OpenAI');
  const body = JSON.stringify({
    model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.0,
    max_tokens: 800,
  });
  console.log('[ragChain] request body:', body);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    console.log('[ragChain] OpenAI error response:', text);
    throw new Error(`OpenAI error: ${res.status} ${text}`);
  }

  console.log('[ragChain] OpenAI response status:', res.status);
  const text = await res.text();
  console.log('[ragChain] OpenAI response text:', text);
  const payload = JSON.parse(text);
  console.log('[ragChain] OpenAI response payload:', JSON.stringify(payload));
  const content = payload?.choices?.[0]?.message?.content ?? JSON.stringify(payload, null, 2);
  console.log('[ragChain] callOpenAIChat received content len=', content.length);
  return { content, raw: payload };
}

// OutputParser: expects model to return JSON with answer and citations
function parseStructuredOutput(text: string) {
  try {
    // Find first JSON block in output
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch {}
  return null;
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

  // Try to parse structured output
  const parsed = parseStructuredOutput(llmResp.content);
  let sources: Array<{ title?: string; id?: string; snippet?: string }> = [];
  let answer = llmResp.content;
  if (parsed && Array.isArray(parsed.citations)) {
    answer = parsed.answer;
    sources = parsed.citations.map((c: any) => {
      const idx = typeof c.source === "number" ? c.source : parseInt(c.source, 10);
      const ctx = contexts[idx];
      return {
        id: ctx?.metadata?.id ?? `${idx}`,
        title: ctx?.metadata?.title,
        snippet: c.snippet ?? ctx?.pageContent?.slice(0, 400),
      };
    });
  } else {
    // fallback: regex citations
    const citationRegex = /\[source:(\d+)\]/g;
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
  }

  return { answer, sources, raw: llmResp.raw, parsed };
}
export function createRAGChain() {
  // placeholder RAG chain stub
  return {
    async run(query: string) {
      return { answer: `Stub answer for: ${query}`, sources: [] };
    },
  };
}
