import { loadVectorStore } from "../packages/retrieval/vectorStoreLoader/index.js";
import { Document } from "@langchain/core/documents";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("--- Testing Vector Store Integration ---");
    const provider = process.env.VECTOR_STORE_PROVIDER || "local";
    console.log(`Provider: ${provider}`);

    const store = await loadVectorStore();

    const docId = `test-${Date.now()}`;
    const docs = [
        new Document({
            pageContent: "This is a test document for vector store verification.",
            metadata: { id: docId, source: "test-script" },
        }),
    ];

    console.log("Adding document...");
    await store.addDocuments(docs);
    console.log("Document added.");

    console.log("Querying document...");
    const results = await store.similaritySearch("verification", 1);

    console.log("Results:", results);

    if (results.length > 0 && results[0].pageContent.includes("verification")) {
        console.log("✅ Verification SUCCESS");
    } else {
        console.error("❌ Verification FAILED: Document not found");
        process.exit(1);
    }
}

main().catch((err) => {
    console.error("❌ Verification ERROR:", err);
    process.exit(1);
});
