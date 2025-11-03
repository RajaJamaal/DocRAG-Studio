# DocRAG Studio

A modular Retrieval-Augmented Generation (RAG) web app for document Q&A with streaming answers and citations.

## Features
- Upload documents (PDF, DOCX, TXT)
- Ingestion pipeline: load → split → embed → store
- Vector store: local JSON (FAISS-like), easy swap for Pinecone/Chroma
- Query pipeline: retrieve → prompt → LLM → answer with citations
- Streaming UI: token-by-token updates via SSE
- Structured output parsing for reliable citations
- Modular, extensible TypeScript/Next.js codebase

## Architecture
```
docrag-studio/
├── apps/
│   ├── web/                  # Next.js UI (React, SSE client)
│   └── api/                  # Next.js API routes (query, query-stream)
├── packages/
│   ├── ingestion/            # loaders, splitters, embeddings, store
│   ├── retrieval/            # vectorStoreLoader, ragChain
│   └── graph/                # LangGraph workflow definitions
├── data/                     # persisted vectorstore, checkpoints
├── .env.example              # environment variable template
├── package.json              # root scripts/deps
└── README.md
```

## Quickstart

### 1. Install dependencies
```bash
npm install
cd apps/web
npm install
```

### 2. Configure environment
Copy `.env.example` to `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

### 3. Ingest a sample document
```bash
npm run ingest
```
This creates `data/vectorstore.json`.

### 4. Start the Next.js app
```bash
cd apps/web
npm run dev
```
Visit [http://localhost:3000](http://localhost:3000) and ask questions about your docs.

## Streaming Answers
- The `/api/query-stream` endpoint streams OpenAI tokens as SSE.
- The UI updates token-by-token for fast feedback.

## Customization
- **Vector store:**
  - Default: local JSON (FAISS-like)
  - To use Pinecone/Chroma: swap logic in `packages/retrieval/vectorStoreLoader.ts` and add provider keys to `.env`
- **LLM:**
  - Uses OpenAI Chat Completion API (GPT-4o-mini by default)
  - Change model in `.env` as needed
- **Output parsing:**
  - Structured citations via OutputParser (JSON)
  - Fallback to regex if model output is not valid JSON

## Extending
- Add new document loaders in `packages/ingestion/loaders.ts`
- Add new vector store adapters in `packages/retrieval/vectorStoreLoader.ts`
- Add new workflow nodes in `packages/graph/ingestionGraph.ts`
- Add authentication, progress UI, or deploy to Vercel/Railway for production

## Troubleshooting
- If you see `OPENAI_API_KEY=missing`, check your `.env` file
- If `data/vectorstore.json` is missing, run ingestion again
- For Pinecone/Chroma, install provider SDK and update loader logic

## License
MIT

---
For questions or contributions, open an issue or PR!
