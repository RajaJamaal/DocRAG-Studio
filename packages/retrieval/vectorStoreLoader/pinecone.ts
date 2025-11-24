import { Pinecone } from "@pinecone-database/pinecone";
import type { VectorStoreLike, DocumentLike } from "./types.js";
import type { Document } from "@langchain/core/documents";
import { embedQuery } from "./embeddings.js";

export class PineconeVectorStore implements VectorStoreLike {
    private client: Pinecone;
    private indexName: string;

    constructor() {
        const apiKey = process.env.PINECONE_API_KEY;
        if (!apiKey) throw new Error("PINECONE_API_KEY is not set");
        this.client = new Pinecone({ apiKey });
        this.indexName = process.env.PINECONE_INDEX || "docrag-studio-index";
    }

    async similaritySearch(query: string, k = 3): Promise<DocumentLike[]> {
        const vector = await embedQuery(query);
        const index = this.client.index(this.indexName);

        const results = await index.query({
            vector,
            topK: k,
            includeMetadata: true,
        });

        return results.matches.map((match) => ({
            id: match.id,
            pageContent: (match.metadata?.text as string) || "",
            metadata: match.metadata,
        }));
    }

    async addDocuments(documents: Document[]): Promise<void> {
        const index = this.client.index(this.indexName);

        // We need to embed the documents first
        // Since we don't have a batch embed function exposed in embeddings.ts yet, we loop
        // In a real app, we'd want batching.
        const vectors = await Promise.all(documents.map(async (doc) => {
            let values = doc.metadata?.embedding as number[];
            if (!values) {
                values = await embedQuery(doc.pageContent);
            }
            // Extract embedding from metadata to avoid sending it as metadata to Pinecone
            const { embedding, ...restMetadata } = doc.metadata || {};

            return {
                id: (doc.metadata?.id as string) || crypto.randomUUID(),
                values,
                metadata: {
                    ...restMetadata,
                    text: doc.pageContent, // Store text in metadata for retrieval
                },
            };
        }));

        // Pinecone upsert in batches of 100
        const batchSize = 100;
        for (let i = 0; i < vectors.length; i += batchSize) {
            const batch = vectors.slice(i, i + batchSize);
            await index.upsert(batch);
        }
    }
}
