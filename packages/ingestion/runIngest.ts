import { trace } from "@opentelemetry/api";
import { buildIngestionGraph } from "../graph/ingestionGraph.js";

const tracer = trace.getTracer("ingestion");


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
  return tracer.startActiveSpan("main", async (span) => {
    // Write sample text to data/sample.txt
    await tracer.startActiveSpan("createSampleFile", async (span) => {
      const fs = await import("fs/promises");
      await fs.mkdir("./data", { recursive: true });
      await fs.writeFile("./data/sample.txt", SAMPLE_TEXT);
      console.log("✓ Created sample.txt");
      span.end();
    });

    // Build and run ingestion graph
    const graph = buildIngestionGraph();
    const finalState = await tracer.startActiveSpan("ingestionGraph.invoke", async (span) => {
      const finalState = await graph.invoke({ filePaths: ["./data/sample.txt"] });
      console.log("✓ Ingestion complete:", finalState);
      span.end();
      return finalState;
    });
    span.end();
    return finalState;
  });
}

main().catch(console.error);