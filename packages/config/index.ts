import path from "path";

export const DATA_DIR = path.resolve(process.cwd(), "data");
export const VECTOR_STORE_DIR = path.join(DATA_DIR, "vectorstore");
export const VECTOR_STORE_FILE = path.join(DATA_DIR, "vectorstore.json");
export const SAMPLE_FILE = path.join(DATA_DIR, "sample.txt");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

export const CONFIG = {
    VECTOR_STORE_PROVIDER: process.env.VECTOR_STORE_PROVIDER || "local",
};
