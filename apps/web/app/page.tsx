"use client";
import "../tracing";
import "./page.css";
import { useMemo, useState, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// Icons
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
);
const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
);
const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
);
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><polyline points="20 6 9 17 4 12" /></svg>
);
const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
);

export default function Home() {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: any) {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setUploadStatus("uploading");
    setStatusMessage("Uploading...");

    try {
      const res = await fetch(`${API_BASE}/api/routes/upload`, {
        method: "POST",
        headers: {
          "X-File-Name": file.name,
        },
        body: file,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      setUploadStatus("success");
      setStatusMessage("Ingestion complete");
    } catch (err) {
      setUploadStatus("error");
      setStatusMessage((err as Error).message);
    }
  }

  const suggestions = useMemo(
    () => [
      "What is DocRAG Studio?",
      "How does ingestion work?",
      "Summarize the sample document",
      "What file types are supported?",
    ],
    []
  );

  async function handleQuery(e: any) {
    e.preventDefault();
    const q = e.target.query.value;
    if (!q.trim()) return;

    setAnswer("");
    setLoading(true);

    const es = new EventSource(`${API_BASE}/api/routes/query-stream?q=${encodeURIComponent(q)}`);

    es.onmessage = (event) => {
      setAnswer((prev) => prev + event.data);
    };

    es.addEventListener("token", (event: MessageEvent) => {
      const { token } = JSON.parse(event.data);
      setAnswer((prev) => prev + token);
    });

    es.addEventListener("done", () => {
      setLoading(false);
      es.close();
    });

    es.addEventListener("error", (event: MessageEvent) => {
      setLoading(false);
      es.close();
      setAnswer((prev) => prev + "\n[Error: " + (event.data || "Connection failed") + "]");
    });
  }

  return (
    <div className="page-shell">
      <div className="dashboard">
        {/* Left Panel: Upload */}
        <div className="panel upload-panel">
          <div className="panel-header">
            <div>
              <h2>Upload Documents</h2>
              <p className="eyebrow">Knowledge Base</p>
            </div>
            <div className={`status-pill ${loading ? "busy" : ""}`}>
              {loading ? "Processing Query..." : "System Ready"}
            </div>
          </div>

          <div
            className="dropzone"
            onClick={() => fileInputRef.current?.click()}
          >
            <div>
              <p style={{ fontWeight: 600, color: "#e2e8f0" }}>
                {fileName || "Choose a file"}
              </p>
              <p className="muted">PDF, TXT, MD supported</p>
            </div>
            <div className="dropzone-button">
              <UploadIcon />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleUpload}
              accept=".pdf,.txt,.md"
            />
          </div>

          {uploadStatus !== "idle" && (
            <ul className="file-list">
              <li>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <FileIcon />
                  <span>{fileName}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {uploadStatus === "uploading" && <span className="muted">...</span>}
                  {uploadStatus === "success" && <CheckIcon />}
                  {uploadStatus === "error" && <AlertIcon />}
                </div>
              </li>
              {statusMessage && (
                <p className={`hint ${uploadStatus === "error" ? "error" : ""}`}>
                  {statusMessage}
                </p>
              )}
            </ul>
          )}
        </div>

        {/* Right Panel: Query */}
        <div className="panel query-panel">
          <div className="panel-header">
            <div>
              <h2>Ask AI</h2>
              <p className="eyebrow">RAG Agent</p>
            </div>
          </div>

          <form onSubmit={handleQuery} className="query-form">
            <textarea
              name="query"
              rows={3}
              placeholder="Ask a question about your documents..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleQuery(e);
                }
              }}
            />

            <div className="form-footer">
              <div className="suggestions">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={(e) => {
                      const form = (e.target as HTMLElement).closest("form");
                      if (form) {
                        const textarea = form.querySelector("textarea");
                        if (textarea) {
                          textarea.value = s;
                          handleQuery({ preventDefault: () => { }, target: { query: { value: s } } });
                        }
                      }
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button type="submit" disabled={loading} className="primary">
                {loading ? "Thinking..." : <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>Send <SendIcon /></span>}
              </button>
            </div>
          </form>

          {answer && (
            <div className="answer-panel">
              <div className="answer-header">
                <span className="eyebrow">AI Response</span>
              </div>
              <pre>{answer}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
