# DocRAG Studio

A modular Retrieval-Augmented Generation (RAG) web app for document Q&A with streaming answers and citations.

## Features
- **File Upload**: Drag & drop interface for PDF, DOCX, TXT, and MD files.
- **Robust Ingestion**:
    - **Duplicate Prevention**: SHA-256 content hashing prevents re-uploading the same file.
    - **Vector Store Adapters**: Seamlessly switch between Local JSON, Pinecone, and ChromaDB.
- **Advanced RAG**:
    - **Streaming Answers**: Token-by-token updates via SSE.
    - **Citations**: Source metadata is returned for both sync and streaming responses.
    - **Strict Grounding**: If context is insufficient, the assistant returns `I don't know, Please provide context!` and no sources are shown.
- **Modern UI**:
    - **Vertical Layout**: Upload panel on top, chat interface below.
    - **Chat History**: Full conversation history with user and AI messages.
    - **Readable AI Responses**: Markdown-like headings/lists are rendered as structured blocks.
    - **Inline Citations**: In-answer citations are formatted as `(source: [filename])`.
    - **Thinking Indicator**: Animated AI typing state is shown in the chat bubble until the first token streams.
    - **Glassmorphism Design**: Premium dark theme with blur effects.

## Architecture
```
docrag-studio/
├── apps/
│   ├── web/                  # Next.js UI (React, SSE client) - Port 3000
│   └── api/                  # Node.js API Server - Port 3001
│       └── routes/           # Upload, Query, Query-Stream endpoints
├── packages/
│   ├── ingestion/            # Loaders, splitters, embeddings, hashing
│   ├── retrieval/            # Vector store adapters (Local, Pinecone, Chroma)
│   └── config/               # Centralized configuration
├── data/                     # Persisted vectorstore, uploads
├── .env                      # Environment variables
└── README.md
```

## Quickstart

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Copy `.env.example` to `.env` and set your keys:
```bash
# Core
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-nano
PORT=3001
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001

# Vector Store (Choose one: local, pinecone, chroma)
VECTOR_STORE_PROVIDER=local

# Pinecone (Optional)
PINECONE_API_KEY=...
PINECONE_INDEX=...

# Chroma (Optional)
CHROMA_API_URL=http://localhost:8000
CHROMA_API_KEY=...
CHROMA_COLLECTION=docrag-studio-collection
# Optional legacy alias supported by code:
# CHROMA_COLLECTION_NAME=docrag-studio-collection
```

### 3. Start the Development Server
This will start both the backend API (port 3001) and the frontend UI (port 3000).
```bash
# Terminal 1: Start Backend
npm run dev:api

# Terminal 2: Start Frontend
cd apps/web
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to upload documents and chat!

## Customization
- **Vector Store**: Change `VECTOR_STORE_PROVIDER` in `.env` to switch providers instantly.
- **LLM**: Uses OpenAI Chat Completion. Adjust model/temperature in `packages/retrieval/ragChain.ts`.
- **UI**: Modify `apps/web/app/page.tsx` and `page.css` for frontend changes.

## Troubleshooting
- **Duplicate Uploads**: The system uses SHA-256 hashing on uploaded file bytes. If you try to upload the same file content (even with a different name), it will be rejected with a 409 Conflict.
- **Dimension Mismatch**: Ensure your embedding model dimensions match your vector store index (default: 1024 for `text-embedding-3-small`).
- **No Source Links on Fallback**: This is expected. If the answer is `I don't know, Please provide context!`, the response is intentionally treated as ungrounded and sources are omitted.

## License
MIT
