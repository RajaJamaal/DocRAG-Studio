import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import type { VectorStoreLike, DocumentLike } from "./types.js";
import type { Document } from "@langchain/core/documents";
import { VECTOR_STORE_FILE, VECTOR_STORE_DIR } from "../../config/index.js";

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

export class LocalVectorStore implements VectorStoreLike {
    private vectors: StoredVector[] = [];
    private initialized = false;

    async init() {
        if (this.initialized) return;
        console.log('[LocalVectorStore] init() entry');

        try {
            console.log('[LocalVectorStore] attempting to read', VECTOR_STORE_FILE);
            const content = await fs.readFile(VECTOR_STORE_FILE, "utf-8");
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                this.vectors = parsed as StoredVector[];
            }
        } catch (err) {
            console.log('[LocalVectorStore] read fileJson failed:', (err as Error).message);
        }

        if (this.vectors.length === 0) {
            try {
                console.log('[LocalVectorStore] checking dir store', VECTOR_STORE_DIR);
                const stat = await fs.stat(VECTOR_STORE_DIR).catch(() => null);
                if (stat) {
                    const docsFile = path.join(VECTOR_STORE_DIR, "docs.json");
                    console.log('[LocalVectorStore] reading docs file', docsFile);
                    const docsContent = await fs.readFile(docsFile, "utf-8").catch(() => "");
                    if (docsContent) {
                        const raw = JSON.parse(docsContent);
                        if (Array.isArray(raw)) {
                            this.vectors = raw.map((r: any) => ({
                                id: r.id ?? r.metadata?.id ?? `${Math.random()}`,
                                embedding: r.embedding ?? r.vector ?? [],
                                text: r.pageContent ?? r.text ?? "",
                                metadata: r.metadata ?? {},
                            }));
                        }
                    }
                }
            } catch (err) {
                console.log('[LocalVectorStore] error while reading dir store:', (err as Error).message);
            }
        }
        console.log('[LocalVectorStore] loaded vectors count=', this.vectors.length);
        this.initialized = true;
    }

    async similaritySearch(query: string, k = 3): Promise<DocumentLike[]> {
        await this.init();
        console.log('[LocalVectorStore] similaritySearch entry', { query, k });
        const qVec = embedTextDeterministic(query, this.vectors[0]?.embedding.length ?? 32);

        const scores = this.vectors.map((v) => ({
            score: cosineSimilarity(qVec, v.embedding),
            doc: { pageContent: v.text, metadata: v.metadata },
        }));

        scores.sort((a, b) => b.score - a.score);
        return scores.slice(0, k).map((s) => s.doc);
    }

    async addDocuments(documents: Document[]): Promise<void> {
        await this.init();
        console.log('[LocalVectorStore] addDocuments', documents.length);

        const newVectors = documents.map(doc => ({
            id: crypto.randomUUID(),
            embedding: (doc.metadata?.embedding as number[]) || embedTextDeterministic(doc.pageContent),
            text: doc.pageContent,
            metadata: doc.metadata
        }));

        this.vectors.push(...newVectors);

        // Persist to disk
        await fs.mkdir(path.dirname(VECTOR_STORE_FILE), { recursive: true });
        await fs.writeFile(VECTOR_STORE_FILE, JSON.stringify(this.vectors, null, 2));
    }
    async hasDocument(source: string, hash?: string): Promise<boolean> {
        await this.init();
        if (hash) {
            return this.vectors.some(v => v.metadata?.hash === hash);
        }
        return this.vectors.some(v => v.metadata?.source === source);
    }
}
