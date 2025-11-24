import { OpenAIEmbeddings } from "@langchain/openai";
import type { Document } from "@langchain/core/documents";

function localEmbedding(text: string, dimension = 1536): number[] {
  const vector = new Array(dimension).fill(0);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const idx = (code + i) % dimension;
    vector[idx] = (vector[idx] + code) % 1000;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

export async function generateEmbeddings(chunks: Document[]): Promise<Document[]> {
  const chunkContents = chunks.map((chunk) => chunk.pageContent);
  let vectors: number[][];

  if (!process.env.OPENAI_API_KEY) {
    vectors = chunkContents.map((content) => localEmbedding(content));
  } else {
    const embeddings = new OpenAIEmbeddings({
      modelName: "text-embedding-3-small",
      dimensions: 1024,
    });
    try {
      vectors = await embeddings.embedDocuments(chunkContents);
    } catch (error) {
      console.warn("OpenAI embeddings failed, falling back to local embeddings:", error);
      vectors = chunkContents.map((content) => localEmbedding(content));
    }
  }

  return chunks.map((chunk, i) => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      embedding: vectors[i],
    },
  }));
}
