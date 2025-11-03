import type { LoadedDocument } from "./loaders.js";

// Simple recursive chunker-ish implementation to avoid external textsplitters
export async function splitDocuments(
  docs: LoadedDocument[],
  chunkSize = 1000,
  chunkOverlap = 200
) {
  const out: LoadedDocument[] = [];

  for (const doc of docs) {
    const text = doc.pageContent || "";
    let start = 0;
    let chunkNum = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(Math.max(0, start), end).trim();
      if (chunk) {
        out.push({ 
          id: `${doc.id}-chunk-${chunkNum++}`,
          pageContent: chunk, 
          metadata: { ...doc.metadata, chunk: chunkNum } 
        });
      }
      if (end === text.length) break;
      start = end - chunkOverlap;
      if (start < 0) start = 0;
    }
  }

  console.log(`Split into ${out.length} chunks`);
  return out;
}

