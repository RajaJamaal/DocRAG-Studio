import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

async function debug() {
    const apiKey = process.env.PINECONE_API_KEY;
    const indexName = process.env.PINECONE_INDEX || "docrag-studio-index";

    if (!apiKey) {
        console.error("PINECONE_API_KEY not set");
        return;
    }

    const client = new Pinecone({ apiKey });
    const index = client.index(indexName);

    const filename = "Strategic AI Portfolio Development for UK Market Penetration.pdf";
    console.log(`Checking for filename: "${filename}"`);

    // 1. Try to find by exact source match (basename)
    const resultsBasename = await index.query({
        vector: new Array(1024).fill(0),
        topK: 10,
        filter: {
            source: { $eq: filename }
        },
        includeMetadata: true
    });

    console.log("\n--- Results for source = filename ---");
    console.log(`Found: ${resultsBasename.matches.length}`);
    resultsBasename.matches.forEach(m => {
        console.log(`ID: ${m.id}`);
        console.log(`Metadata:`, m.metadata);
    });

    // 2. Try to find by full path (heuristic)
    // We can't easily query "contains", but let's try to list some vectors if possible or just rely on the above.
    // Since we can't do partial match in Pinecone metadata filters easily without knowing the prefix,
    // we will rely on the user's report that "3rd copy" was created.

    // Let's try to fetch a vector by ID if we can guess it, but we can't.
    // Instead, let's try to query with a generic text from the document to see what we get back.

    console.log("\n--- Querying by content 'UK Market Penetration' ---");
    // We need an embedding for this. Since we can't easily generate one here without the whole setup,
    // we'll skip the content query for now and trust the metadata filter check.

    // Wait, if the previous uploads used the FULL PATH, we can try to construct what that path might have been.
    // /home/raaja_jamaal/Desktop/DocRAG-Studio/data/uploads/...
    const fullPath = path.join(process.cwd(), "data/uploads", filename);
    console.log(`\nChecking for full path: "${fullPath}"`);

    const resultsFullPath = await index.query({
        vector: new Array(1024).fill(0),
        topK: 10,
        filter: {
            source: { $eq: fullPath }
        },
        includeMetadata: true
    });

    // 3. Try to fetch by ID
    const expectedId = `${filename}-chunk-0`;
    console.log(`\nChecking for ID: "${expectedId}"`);

    const fetchResult = await index.fetch([expectedId]);
    const record = fetchResult.records[expectedId];

    if (record) {
        console.log("Found record by ID!");
        console.log("Metadata:", record.metadata);
    } else {
        console.log("Record not found by ID.");
    }
}

debug().catch(console.error);
