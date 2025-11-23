import type { Document } from "@langchain/core/documents";
import { loadVectorStore } from "../retrieval/vectorStoreLoader/index.js";

export async function storeEmbeddings(chunks: Document[]) {
  console.log('[store] storeEmbeddings called with', chunks.length, 'chunks');
  const store = await loadVectorStore();
  await store.addDocuments(chunks);
  console.log('[store] storeEmbeddings complete');
}
