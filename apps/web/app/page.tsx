"use client";
import "../tracing";
import "./page.css";
import { useMemo, useState } from "react";

type UploadPreview = {
  id: string;
  name: string;
  size: string;
  status: "pending" | "ready";
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export default function Home() {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [files, setFiles] = useState<UploadPreview[]>([]);
  const [status, setStatus] = useState("Drop your documents to prepare an ingest run.");

  const suggestions = useMemo(
    () => [
      "What is DocRAG Studio?",
      "How does ingestion work?",
      "Summarize the sample document",
      "What file types are supported?",
    ],
    []
  );

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleFileSelection(list: FileList | null) {
    if (!list || list.length === 0) return;
    const previews: UploadPreview[] = Array.from(list).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      size: formatSize(file.size),
      status: "pending",
    }));
    setFiles(previews);
    setStatus("Docs staged. Run ingestion to embed them, then ask a question below.");
  }

  async function handleQuery(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!question.trim()) return;
    setAnswer("");
    setError(null);
    setLoading(true);
    setStatus("Querying vector store...");

    const url = `${API_BASE}/api/routes/query-stream?q=${encodeURIComponent(question.trim())}`;
    const es = new EventSource(url);

    es.addEventListener("token", (event: MessageEvent) => {
      const { token } = JSON.parse(event.data);
      setAnswer((prev) => prev + token);
    });

    es.addEventListener("done", () => {
      setLoading(false);
      setStatus("Ready for the next question.");
      es.close();
    });

    es.addEventListener("error", (event: MessageEvent) => {
      setLoading(false);
      setStatus("Something went wrong.");
      setError(event.data || "Unknown streaming error");
      es.close();
    });
  }

  return (
    <div className="page-shell">
      <main className="dashboard">
        <section className="panel upload-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Step 1 · Prep</p>
              <h2>Upload documents</h2>
            </div>
            <span className="status-pill">{files.length ? "Staged" : "Idle"}</span>
          </div>

          <label className="dropzone">
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.docx"
              onChange={(event) => handleFileSelection(event.target.files)}
            />
            <div>
              <p>Drop PDF, DOCX, or TXT files</p>
              <p className="muted">They will be ingested into the local vector store.</p>
            </div>
            <span className="dropzone-button">Select files</span>
          </label>

          {files.length > 0 && (
            <ul className="file-list">
              {files.map((file) => (
                <li key={file.id}>
                  <div>
                    <p>{file.name}</p>
                    <p className="muted">{file.size}</p>
                  </div>
                  <span className={`file-badge ${file.status}`}>{file.status === "pending" ? "pending ingest" : "ready"}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="hint">
            After staging files, run <code>npm run ingest</code> in the repo root to chunk, embed, and store them.
          </p>
        </section>

        <section className="panel query-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Step 2 · Ask</p>
              <h2>Query your knowledge base</h2>
            </div>
            <span className={`status-pill ${loading ? "busy" : ""}`}>{loading ? "Streaming…" : "Ready"}</span>
          </div>

          <form className="query-form" onSubmit={handleQuery}>
            <textarea
              rows={3}
              placeholder="Ask about your docs..."
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <div className="form-footer">
              <div className="suggestions">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setQuestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <button type="submit" className="primary" disabled={loading}>
                {loading ? "Generating…" : "Ask GPT-5 Nano"}
              </button>
            </div>
          </form>

          <div className="answer-panel">
            <div className="answer-header">
              <p className="eyebrow">Answer</p>
              <span>{status}</span>
            </div>
            <pre>{answer || "Your response will stream here..."}</pre>
            {error && <p className="error">Error: {error}</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
