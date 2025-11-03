import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
// Do not use static imports for Pinecone/Chroma to avoid runtime/type errors in environments where not installed

export type DocumentLike = {
  id?: string;
  pageContent: string;
  metadata?: Record<string, any>;
};

export type RetrieverLike = {
  similaritySearch: (query: string, k?: number) => Promise<DocumentLike[]>;
};

type StoredVector = {
  id: string;
  embedding: number[];
  text: string;
  metadata?: Record<string, any>;
};

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function embedTextDeterministic(text: string, dim = 32) {
  const hash = crypto.createHash("sha256").update(text).digest();
  const vec = Array.from({ length: dim }, (_, i) => hash[i % hash.length] / 255);
  return vec;
}

// Local Vector Store Implementation
export async function loadVectorStore(): Promise<RetrieverLike> {
  console.log('[vectorStoreLoader] loadLocalVectorStore() entry');
  const fileJson = path.resolve(process.cwd(), "data/vectorstore.json");
  const dirStore = path.resolve(process.cwd(), "data/vectorstore");

  let vectors: StoredVector[] | null = null;

  // 1) try JSON file (our ingestion writes this)
  try {
    console.log('[vectorStoreLoader] attempting to read', fileJson);
    const content = await fs.readFile(fileJson, "utf-8");
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      vectors = parsed as StoredVector[];
    }
  } catch (err) {
    console.log('[vectorStoreLoader] read fileJson failed:', (err as Error).message);
  }

  // 2) fallback: try directory (adapter-style)
  if (!vectors) {
    try {
      console.log('[vectorStoreLoader] checking dir store', dirStore);
      const stat = await fs.stat(dirStore).catch(() => null);
      if (stat) {
        // attempt to read docs.json inside
        const docsFile = path.join(dirStore, "docs.json");
        console.log('[vectorStoreLoader] reading docs file', docsFile);
        const docsContent = await fs.readFile(docsFile, "utf-8").catch(() => "");
        if (docsContent) {
          const raw = JSON.parse(docsContent);
          // try to convert to StoredVector shape if present
          if (Array.isArray(raw)) {
            vectors = raw.map((r: any) => ({
              id: r.id ?? r.metadata?.id ?? `${Math.random()}`,
              embedding: r.embedding ?? r.vector ?? [],
              text: r.pageContent ?? r.text ?? "",
              metadata: r.metadata ?? {},
            }));
          }
        }
      }
    } catch (err) {
      console.log('[vectorStoreLoader] error while reading dir store:', (err as Error).message);
    }
  }

  if (!vectors) {
    throw new Error(
      "No local vectorstore found (looked for data/vectorstore.json or data/vectorstore). Run ingestion first."
    );
  }
  console.log('[vectorStoreLoader] loaded vectors count=', vectors.length);
  return {
    similaritySearch: async (query: string, k = 3) => {
      console.log('[vectorStoreLoader] similaritySearch entry', { query, k });
      const qVec = embedTextDeterministic(query, vectors![0]?.embedding.length ?? 32);
      console.log('[vectorStoreLoader] query embedding len=', qVec.length);

      const scores = vectors!.map((v) => ({
        score: cosineSimilarity(qVec, v.embedding),
        doc: { pageContent: v.text, metadata: v.metadata },
      }));

      scores.sort((a, b) => b.score - a.score);
      const results = scores.slice(0, k).map((s) => s.doc);
      console.log('[vectorStoreLoader] returning top', k, 'results');
      return results;
    },
  };
}