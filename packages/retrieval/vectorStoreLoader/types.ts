import type { Document } from "@langchain/core/documents";

export type DocumentLike = {
    id?: string;
    pageContent: string;
    metadata?: Record<string, any>;
};

export type RetrieverLike = {
    similaritySearch: (query: string, k?: number) => Promise<DocumentLike[]>;
};

export type VectorStoreLike = RetrieverLike & {
    addDocuments: (documents: Document[]) => Promise<void>;
};
