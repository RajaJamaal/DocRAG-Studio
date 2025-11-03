import crypto from "crypto";
import type { LoadedDocument } from "./loaders.js";

// Minimal deterministic embedding generator (stub)
export async function embedDocuments(docs: LoadedDocument[]) {
  // For demo/testing we create a fixed-size vector from the sha256 hash of the text.
  return docs.map((d, i) => {
    const hash = crypto.createHash("sha256").update(d.pageContent || "").digest();
    // generate 32-d vector of numbers in [0,1)
    const vector = Array.from({ length: 32 }, (_, j) => hash[j % hash.length] / 255);
    return { id: `${d.id}-chunk-${i}`, embedding: vector, text: d.pageContent, metadata: d.metadata };
  });
}
