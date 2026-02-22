import { trace } from "@opentelemetry/api";
import { buildIngestionGraph } from "../graph/ingestionGraph.js";

const tracer = trace.getTracer("ingestion");


const SAMPLE_TEXT = `
DocRAG Studio - Document Processing Demo

This is a sample document used to test the document ingestion pipeline. It demonstrates:

1. Loading text files
2. Splitting into chunks
3. Generating embeddings
4. Storing vectors for retrieval

The system supports PDF, DOCX, Markdown, and plain text files. Each document is processed through
a LangGraph workflow.

Future improvements:
- Add support for more file types
- Implement progress tracking
- Add batch processing
- Stream results to UI
`;

async function main() {
  const cliPaths = process.argv.slice(2);
  const usingSample = cliPaths.length === 0;

  return tracer.startActiveSpan("main", async (span) => {
    // Write sample text to data/sample.txt
    await tracer.startActiveSpan("createSampleFile", async (span) => {
      const fs = await import("fs/promises");
      const { DATA_DIR, SAMPLE_FILE } = await import("../config/index.js");
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(SAMPLE_FILE, SAMPLE_TEXT);
      console.log("✓ Created sample.txt");
      span.end();
    });

    // Build and run ingestion graph
    const graph = buildIngestionGraph();
    const finalState = await tracer.startActiveSpan("ingestionGraph.invoke", async (span) => {
      const { SAMPLE_FILE } = await import("../config/index.js");
      const finalState = await graph.invoke({ filePaths: [SAMPLE_FILE] });
      console.log("✓ Ingestion complete:", finalState);
      span.end();
      return finalState;
    });
    span.end();
    return finalState;
  });
}

main().catch(console.error);
