import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import {
  RunnableSequence,
} from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import type { Document } from "@langchain/core/documents";
import type { RetrieverLike } from "./vectorStoreLoader/index.js";

// Zod schema for a single source
const sourceSchema = z.object({
  pageContent: z.string(),
  metadata: z.record(z.unknown()),
});

// Zod schema for the final answer
const answerSchema = z.object({
  answer: z.string().describe("The final answer to the user's query."),
  sources: z.array(sourceSchema).describe("The source documents used to generate the answer."),
});

export type RAGResult = z.infer<typeof answerSchema>;

// Function to format documents
function formatDocuments(docs: Document[]) {
  return docs.map((doc) => doc.pageContent).join("\n\n");
}

const PROMPT_TEMPLATE = `You are a helpful assistant. Use the provided context to answer the question below.

Context:
{context}

Question:
{question}
`;
const prompt = PromptTemplate.fromTemplate(PROMPT_TEMPLATE);

export async function answerQuery(
  retriever: RetrieverLike,
  query: string,
  opts?: { topK?: number }
): Promise<RAGResult> {
  const topK = opts?.topK ?? 3;

  const model = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
    temperature: 0,
  });

  const retrieverChain = RunnableSequence.from([
    (input: { question: string }) => input.question,
    (query) => retriever.similaritySearch(query, topK),
  ]);

  const answerGenerationChain = RunnableSequence.from([
    (input: { sources: Document[]; question: string }) => ({
      context: formatDocuments(input.sources),
      question: input.question,
    }),
    prompt.pipe(model).pipe(new StringOutputParser()),
  ]);

  const chain = RunnableSequence.from([
    {
      sources: retrieverChain,
      question: (input: { question: string }) => input.question,
    },
    {
      answer: answerGenerationChain,
      sources: (input) => input.sources,
    },
  ]);

  const result = await chain.invoke({ question: query });

  // Validate the final result with Zod
  return answerSchema.parse(result);
}

export async function* streamAnswerQuery(
  retriever: RetrieverLike,
  query: string,
  opts?: { topK?: number } 
): AsyncGenerator<string> {
  const topK = opts?.topK ?? 3;

  const model = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
    temperature: 0,
    streaming: true, // Enable streaming
  });

  const retrieverChain = RunnableSequence.from([
    (input: { question: string }) => input.question,
    (query) => retriever.similaritySearch(query, topK),
  ]);

  const streamAnswerGenerationChain = RunnableSequence.from([
    (input: { sources: Document[]; question: string }) => ({
      context: formatDocuments(input.sources),
      question: input.question,
    }),
    prompt.pipe(model).pipe(new StringOutputParser()),
  ]);

  const chain = RunnableSequence.from([
    {
      sources: retrieverChain,
      question: (input: { question: string }) => input.question,
    },
    streamAnswerGenerationChain,
  ]);

  const stream = await chain.stream({ question: query });

  for await (const chunk of stream) {
    yield chunk;
  }
}
