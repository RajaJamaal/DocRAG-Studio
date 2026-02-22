import fs from "fs/promises";
import path from "path";

async function read(filePath: string): Promise<string> {
  return fs.readFile(path.resolve(process.cwd(), filePath), "utf-8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function includes(text: string, pattern: RegExp | string): boolean {
  if (typeof pattern === "string") return text.includes(pattern);
  return pattern.test(text);
}

async function main() {
  const queryRoute = await read("apps/api/routes/query.ts");
  const queryStreamRoute = await read("apps/api/routes/query-stream.ts");
  const ragChain = await read("packages/retrieval/ragChain.ts");
  const loaders = await read("packages/ingestion/loaders.ts");
  const uploadRoute = await read("apps/api/routes/upload.ts");
  const server = await read("apps/api/server.ts");
  const webPage = await read("apps/web/app/page.tsx");
  const chromaStore = await read("packages/retrieval/vectorStoreLoader/chroma.ts");
  const envExample = await read(".env.example");
  const readme = await read("README.md");
  const sampleDoc = await read("data/sample.txt");
  const runIngest = await read("packages/ingestion/runIngest.ts");

  // 1) Both API routes use the same RAG chain entrypoint.
  assert(
    includes(queryRoute, `from "../../../packages/retrieval/ragChain.js"`),
    "query route is not using unified ragChain.ts"
  );
  assert(
    includes(queryStreamRoute, `from "../../../packages/retrieval/ragChain.js"`),
    "query-stream route is not using unified ragChain.ts"
  );

  // 2) Streaming route must emit citation/source metadata.
  assert(
    includes(queryStreamRoute, "event: sources"),
    "query-stream route does not emit `sources` SSE event"
  );
  assert(
    includes(ragChain, `type: "sources"`),
    "RAG streaming chain does not produce source events"
  );

  // 3) File support contract: UI, loader, README stay aligned.
  assert(
    includes(webPage, `accept=".pdf,.docx,.txt,.md"`),
    "web upload accept list is not .pdf,.docx,.txt,.md"
  );
  assert(
    includes(loaders, /ext === "\.txt" \|\| ext === "\.md"/),
    "loader does not support both txt and md"
  );
  assert(includes(loaders, `ext === ".pdf"`), "loader does not support pdf");
  assert(includes(loaders, `ext === ".docx"`), "loader does not support docx");
  assert(
    includes(readme, /PDF,\s*DOCX,\s*TXT,\s*and\s*MD/i),
    "README file support claim is not aligned"
  );

  // 4) Runtime defaults/env should match quickstart.
  assert(
    includes(server, "const port = process.env.PORT ? Number(process.env.PORT) : 3001;"),
    "API default port is not 3001"
  );
  assert(
    includes(webPage, `NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001"`),
    "web default API base URL is not http://localhost:3001"
  );
  assert(includes(envExample, "PORT=3001"), ".env.example missing PORT=3001");
  assert(
    includes(envExample, "NEXT_PUBLIC_API_BASE_URL=http://localhost:3001"),
    ".env.example missing NEXT_PUBLIC_API_BASE_URL"
  );

  // 5) Duplicate hash propagation must pass upload hash through ingestion.
  assert(
    includes(uploadRoute, "fileHashes: { [filePath]: fileHash }"),
    "upload route does not pass canonical file hash into ingestion graph"
  );
  assert(
    includes(loaders, "opts?.fileHashes?.[filePath]"),
    "loader does not consume provided file hash mapping"
  );

  // 6) Chroma env names should support both current and legacy keys.
  assert(includes(chromaStore, "process.env.CHROMA_COLLECTION_NAME"), "chroma store lacks CHROMA_COLLECTION_NAME fallback");
  assert(includes(chromaStore, "process.env.CHROMA_API_URL"), "chroma store does not use CHROMA_API_URL");
  assert(includes(envExample, "CHROMA_COLLECTION="), ".env.example missing CHROMA_COLLECTION");

  // 7) Sample documentation should not claim resumable ingestion when unsupported.
  assert(!includes(sampleDoc, "can resume if interrupted"), "data/sample.txt still claims resumable workflow");
  assert(!includes(runIngest, "can resume if interrupted"), "runIngest sample text still claims resumable workflow");

  console.log("✅ Contract checks passed");
}

main().catch((error) => {
  console.error(`❌ Contract checks failed: ${(error as Error).message}`);
  process.exit(1);
});
