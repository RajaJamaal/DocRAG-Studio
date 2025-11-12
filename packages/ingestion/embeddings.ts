import { OpenAIEmbeddings } from "@langchain/openai";
import type { Document } from "@langchain/core/documents";

export async function generateEmbeddings(chunks: Document[]): Promise<Document[]> {
  const embeddings = new OpenAIEmbeddings();
  const chunkContents = chunks.map((chunk) => chunk.pageContent);
  const vectors = await embeddings.embedDocuments(chunkContents);
  
  return chunks.map((chunk, i) => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      embedding: vectors[i],
    },
  }));
}