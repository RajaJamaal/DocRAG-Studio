import type { VectorStoreLike } from "./types.js";
import { LocalVectorStore } from "./local.js";
import { PineconeVectorStore } from "./pinecone.js";
import { ChromaVectorStore } from "./chroma.js";

export * from "./types.js";

export async function loadVectorStore(): Promise<VectorStoreLike> {
  const provider = process.env.VECTOR_STORE_PROVIDER || "local";
  console.log(`[vectorStoreLoader] Loading provider: ${provider}`);

  switch (provider) {
    case "pinecone":
      return new PineconeVectorStore();
    case "chroma":
      return new ChromaVectorStore();
    case "local":
    default:
      return new LocalVectorStore();
  }
}