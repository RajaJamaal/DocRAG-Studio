import { loadDocuments } from "./loaders.js";
import { splitDocuments } from "./splitters.js";
import { embedDocuments } from "./embeddings.js";
import { LocalVectorStore } from "./store.js";

export async function ingestDocuments(filePaths: string[]) {
  console.log("Starting document ingestion...");
  
  // Load documents from files
  const docs = await loadDocuments(filePaths);
  
  // Split into chunks
  const chunks = await splitDocuments(docs);
  
  // Generate embeddings
  const vectors = await embedDocuments(chunks);
  
  // Save to vector store
  const store = new LocalVectorStore("./data/vectorstore.json");
  await store.load(); // Load existing vectors if any
  const added = await store.addVectors(vectors);
  
  return { chunksProcessed: chunks.length, vectorsAdded: added };
}
