import fs from "fs/promises";
import path from "path";

type StoredVector = {
  id: string;
  embedding: number[];
  text: string;
  metadata?: Record<string, unknown>;
};

export class LocalVectorStore {
  private vectors: StoredVector[] = [];
  private storePath: string;

  constructor(storePath: string) {
    this.storePath = storePath;
  }

  async load() {
    try {
      const data = await fs.readFile(this.storePath, "utf-8");
      this.vectors = JSON.parse(data);
      console.log(`Loaded ${this.vectors.length} vectors from ${this.storePath}`);
    } catch (err) {
      if ((err as any).code !== "ENOENT") throw err;
      this.vectors = [];
    }
  }

  async save() {
    await fs.mkdir(path.dirname(this.storePath), { recursive: true });
    await fs.writeFile(this.storePath, JSON.stringify(this.vectors, null, 2));
    console.log(`Saved ${this.vectors.length} vectors to ${this.storePath}`);
  }

  async addVectors(vectors: StoredVector[]) {
    this.vectors.push(...vectors);
    await this.save();
    return vectors.length;
  }

  async similaritySearch(query: number[], k = 4) {
    return this.vectors
      .map(vec => ({
        ...vec,
        score: cosineSimilarity(query, vec.embedding)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}

// Utility: compute cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}