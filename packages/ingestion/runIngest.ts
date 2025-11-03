import { buildIngestionGraph } from "../graph/ingestionGraph.js";

// Sample document for testing
const SAMPLE_TEXT = `
DocRAG Studio - Document Processing Demo

This is a sample document used to test the document ingestion pipeline. It demonstrates:

1. Loading text files
2. Splitting into chunks
3. Generating embeddings
4. Storing vectors for retrieval

The system supports PDF, DOCX, and plain text files. Each document is processed through
a LangGraph workflow that can resume if interrupted.

Future improvements:
- Add support for more file types
- Implement progress tracking
- Add batch processing
- Stream results to UI
`;

async function main() {
  // Write sample text to data/sample.txt
  const fs = await import("fs/promises");
  await fs.mkdir("./data", { recursive: true });
  await fs.writeFile("./data/sample.txt", SAMPLE_TEXT);
  console.log("✓ Created sample.txt");

  // Build and run ingestion graph
  const graph = buildIngestionGraph();
  const result = await graph.invoke({ filePaths: ["./data/sample.txt"] });
  console.log("✓ Ingestion complete:", result);
}

main().catch(console.error);