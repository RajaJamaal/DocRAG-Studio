import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import path from "path";
import type { RetrieverLike } from "./vectorStoreLoader/index.js";

const NO_CONTEXT_FALLBACK = "I don't know, Please provide context!";

const sourceSchema = z.object({
  ref: z.number().optional(),
  id: z.string().optional(),
  title: z.string().optional(),
  snippet: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

const answerSchema = z.object({
  answer: z.string().describe("The final answer to the user's query."),
  sources: z.array(sourceSchema).describe("The source documents used to generate the answer."),
});

type RetrievedContext = {
  id?: string;
  pageContent: string;
  metadata?: Record<string, unknown>;
};

export type RAGSource = z.infer<typeof sourceSchema>;
export type RAGResult = z.infer<typeof answerSchema>;
export type RAGStreamEvent =
  | { type: "token"; token: string }
  | { type: "sources"; sources: RAGSource[] };

function normalizeModelContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part === "object" && part && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

function buildPrompt(query: string, contexts: RetrievedContext[]): string {
  const contextText = contexts
    .map((c, i) => `[[source:${i}]]\n${c.pageContent}`)
    .join("\n\n---\n\n");

  return `You are a helpful assistant who responds ONLY to the provided context.
Use ONLY the provided context to answer the question below.
Cite each grounded claim with [source:n] where n is the source index.
If there is no relevant context to answer the question, answer exactly: "${NO_CONTEXT_FALLBACK}".
Do not provide additional information beyond the provided context.

Context:
${contextText}

Question:
${query}

Answer (with inline citations):`;
}

function extractCitationIndexes(answer: string): number[] {
  const citationRegex = /\[source:(\d+)\]/gi;
  const seen = new Set<number>();
  const ordered: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = citationRegex.exec(answer)) !== null) {
    const idx = Number.parseInt(match[1], 10);
    if (Number.isNaN(idx) || seen.has(idx)) continue;
    seen.add(idx);
    ordered.push(idx);
  }

  return ordered;
}

function buildSources(contexts: RetrievedContext[], answer: string): RAGSource[] {
  const citationIndexes = extractCitationIndexes(answer);
  const indexesToUse =
    citationIndexes.length > 0
      ? citationIndexes
      : contexts.map((_, idx) => idx).slice(0, 3);
  const sources: RAGSource[] = [];
  for (const idx of indexesToUse) {
    const ctx = contexts[idx];
    if (!ctx) continue;
    const rawSourceName =
      typeof ctx.metadata?.source === "string" ? (ctx.metadata.source as string) : undefined;
    const sourceName = rawSourceName ? path.basename(rawSourceName) : undefined;
    const sourceTitle =
      typeof ctx.metadata?.title === "string" ? (ctx.metadata.title as string) : sourceName;
    const sourceId =
      sourceName ??
      (typeof ctx.metadata?.id === "string" ? (ctx.metadata.id as string) : `${idx}`);
    sources.push({
      ref: idx,
      id: sourceId,
      title: sourceTitle,
      snippet: ctx.pageContent.slice(0, 500),
      metadata: ctx.metadata,
    });
  }
  return sources;
}

async function retrieveContexts(
  retriever: RetrieverLike,
  query: string,
  topK: number
): Promise<RetrievedContext[]> {
  const contexts = await retriever.similaritySearch(query, topK);
  return contexts.map((ctx) => ({
    id: ctx.id,
    pageContent: ctx.pageContent,
    metadata: ctx.metadata,
  }));
}

function buildModel(streaming = false): ChatOpenAI {
  return new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || "gpt-5-nano",
    temperature: 1,
    streaming,
  });
}

export async function answerQuery(
  retriever: RetrieverLike,
  query: string,
  opts?: { topK?: number }
): Promise<RAGResult> {
  const topK = opts?.topK ?? 3;
  const contexts = await retrieveContexts(retriever, query, topK);

  if (contexts.length === 0) {
    return { answer: NO_CONTEXT_FALLBACK, sources: [] };
  }

  const model = buildModel(false);
  const prompt = buildPrompt(query, contexts);
  const response = await model.invoke(prompt);
  const answer = normalizeModelContent(response.content).trim() || NO_CONTEXT_FALLBACK;
  const sources = buildSources(contexts, answer);

  return answerSchema.parse({ answer, sources });
}

export async function* streamAnswerQuery(
  retriever: RetrieverLike,
  query: string,
  opts?: { topK?: number }
): AsyncGenerator<RAGStreamEvent> {
  const topK = opts?.topK ?? 3;
  const contexts = await retrieveContexts(retriever, query, topK);

  if (contexts.length === 0) {
    yield { type: "token", token: NO_CONTEXT_FALLBACK };
    yield { type: "sources", sources: [] };
    return;
  }

  const model = buildModel(true);
  const prompt = buildPrompt(query, contexts);
  const stream = await model.stream(prompt);

  let fullAnswer = "";

  for await (const chunk of stream) {
    const token = normalizeModelContent(chunk.content);
    if (!token) continue;
    fullAnswer += token;
    yield { type: "token", token };
  }

  const answerText = fullAnswer.trim() || NO_CONTEXT_FALLBACK;
  const sources = buildSources(contexts, answerText);
  yield { type: "sources", sources };
}
