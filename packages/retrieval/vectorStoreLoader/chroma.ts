import { ChromaClient, Collection, EmbeddingFunction } from "chromadb";
import type { VectorStoreLike, DocumentLike } from "./types.js";
import type { Document } from "@langchain/core/documents";
import { embedQuery } from "./embeddings.js";

class CustomEmbeddingFunction implements EmbeddingFunction {
    async generate(texts: string[]): Promise<number[][]> {
        return Promise.all(texts.map(t => embedQuery(t)));
    }
}

export class ChromaVectorStore implements VectorStoreLike {
    private client: ChromaClient;
    private collectionName: string;
    private collection: Collection | null = null;

    constructor() {
        const apiKey = process.env.CHROMA_API_KEY;
        const tenant = process.env.CHROMA_TENANT || "default_tenant";
        const database = process.env.CHROMA_DATABASE || "default_database";

        const options: any = {
            tenant,
            database,
        };

        this.client = new ChromaClient(options);
        this.collectionName = process.env.CHROMA_COLLECTION || "docrag-studio-collection";
    }

    private async getCollection() {
        if (this.collection) return this.collection;

        this.collection = await this.client.getOrCreateCollection({
            name: this.collectionName,
            embeddingFunction: new CustomEmbeddingFunction(),
        });
        return this.collection;
    }

    async similaritySearch(query: string, k = 3): Promise<DocumentLike[]> {
        const collection = await this.getCollection();
        // We can rely on the collection's embedding function now, or pass embeddings explicitly.
        // Passing explicitly is often safer if we want full control, but using the EF is cleaner.
        // Let's use the EF we configured.

        const results = await collection.query({
            queryTexts: [query], // Chroma will use our CustomEmbeddingFunction
            nResults: k,
        });

        const ids = results.ids[0];
        const documents = results.documents[0];
        const metadatas = results.metadatas[0];

        return ids.map((id, i) => ({
            id,
            pageContent: documents?.[i] || "",
            metadata: metadatas?.[i] || {},
        }));
    }

    async addDocuments(documents: Document[]): Promise<void> {
        const collection = await this.getCollection();

        const ids = documents.map(d => (d.metadata?.id as string) || crypto.randomUUID());
        const texts = documents.map(d => d.pageContent);
        const metadatas = documents.map(d => d.metadata || {});

        // If we have pre-calculated embeddings, we can pass them.
        // But mixing pre-calculated and auto-calculated (via EF) in the same add call might be tricky depending on API.
        // Chroma add() takes optional embeddings.

        // Let's check if we have embeddings for ALL documents.
        const hasAllEmbeddings = documents.every(d => d.metadata?.embedding);

        if (hasAllEmbeddings) {
            const embeddings = documents.map(d => d.metadata!.embedding as number[]);
            await collection.add({
                ids,
                embeddings,
                documents: texts,
                metadatas,
            });
        } else {
            // If some are missing, let Chroma's EF handle it (which uses our embedQuery)
            // Or we can polyfill the missing ones.
            // Let's just let Chroma handle it by passing texts.
            // BUT wait, our optimization was to use existing embeddings.
            // So we should probably calculate missing ones and pass all embeddings.

            const embeddings = await Promise.all(documents.map(async d => {
                if (d.metadata?.embedding) return d.metadata.embedding as number[];
                return embedQuery(d.pageContent);
            }));

            await collection.add({
                ids,
                embeddings,
                documents: texts,
                metadatas,
            });
        }
    }
}
