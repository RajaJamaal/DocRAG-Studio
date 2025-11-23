import { OpenAIEmbeddings } from "@langchain/openai";

function localEmbedding(text: string, dimension = 1536): number[] {
    const vector = new Array(dimension).fill(0);
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        const idx = (code + i) % dimension;
        vector[idx] = (vector[idx] + code) % 1000;
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => value / norm);
}

export async function embedQuery(text: string): Promise<number[]> {
    if (process.env.OPENAI_API_KEY) {
        const embeddings = new OpenAIEmbeddings();
        return embeddings.embedQuery(text);
    }
    return localEmbedding(text);
}
