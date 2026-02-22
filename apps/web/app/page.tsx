"use client";
import "../tracing";
import "./page.css";
import { useMemo, useState, useRef, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

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

type Message = {
  role: "user" | "ai";
  content: string;
  sources?: Array<{
    id?: string;
    title?: string;
    snippet?: string;
  }>;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages]);

  async function uploadFile(file: File) {
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

  async function handleUpload(e: any) {
    const file = e.target.files[0];
    if (!file) return;
    await uploadFile(file);
  }

  const suggestions = useMemo(
    () => [
      "What is DocRAG Studio?",
      "Summarize the document",
      "Key insights?",
    ],
    []
  );

  async function handleQuery(e: any) {
    e.preventDefault();

    // Robustly get the query value
    let q = "";
    if (e.target.tagName === "FORM") {
      q = (e.target.elements.namedItem("query") as HTMLTextAreaElement).value;
    } else if (e.target.tagName === "TEXTAREA") {
      q = e.target.value;
    } else {
      // Fallback for direct calls
      q = formRef.current?.querySelector("textarea")?.value || "";
    }

    if (!q.trim()) return;
    if (loading) return;

    // Clear input
    if (formRef.current) {
      const textarea = formRef.current.querySelector("textarea");
      if (textarea) textarea.value = "";
    }

    // Add user message
    setMessages(prev => [...prev, { role: "user", content: q }]);
    setLoading(true);

    // Create placeholder for AI response
    setMessages(prev => [...prev, { role: "ai", content: "" }]);

    const es = new EventSource(`${API_BASE}/api/routes/query-stream?q=${encodeURIComponent(q)}`);

    es.addEventListener("token", (event: MessageEvent) => {
      const { token } = JSON.parse(event.data);
      setMessages(prev => {
        const newMsgs = [...prev];
        const lastMsgIndex = newMsgs.length - 1;
        const lastMsg = newMsgs[lastMsgIndex];

        if (lastMsg && lastMsg.role === "ai") {
          newMsgs[lastMsgIndex] = {
            ...lastMsg,
            content: lastMsg.content + token
          };
        }
        return newMsgs;
      });
    });

    es.addEventListener("sources", (event: MessageEvent) => {
      const { sources } = JSON.parse(event.data) as {
        sources?: Array<{ id?: string; title?: string; snippet?: string }>;
      };

      if (!Array.isArray(sources)) return;

      setMessages(prev => {
        const newMsgs = [...prev];
        const lastMsgIndex = newMsgs.length - 1;
        const lastMsg = newMsgs[lastMsgIndex];

        if (lastMsg && lastMsg.role === "ai") {
          newMsgs[lastMsgIndex] = {
            ...lastMsg,
            sources,
          };
        }
        return newMsgs;
      });
    });

    es.addEventListener("done", () => {
      setLoading(false);
      es.close();
    });

    es.addEventListener("error", (event: MessageEvent) => {
      setLoading(false);
      es.close();
      setMessages(prev => {
        const newMsgs = [...prev];
        const lastMsgIndex = newMsgs.length - 1;
        const lastMsg = newMsgs[lastMsgIndex];

        if (lastMsg && lastMsg.role === "ai") {
          newMsgs[lastMsgIndex] = {
            ...lastMsg,
            content: lastMsg.content + "\n[Error: " + (event.data || "Connection failed") + "]"
          };
        }
        return newMsgs;
      });
    });
  }

  return (
    <div className="page-shell">
      <div className="dashboard">
        {/* Top Panel: Upload */}
        <div className="panel upload-panel">
          <div className="panel-header">
            <div>
              <h2>Knowledge Base</h2>
              <p className="eyebrow">Upload Documents</p>
            </div>
            <div className={`status-pill ${loading ? "busy" : ""}`}>
              {loading ? "Thinking..." : "System Ready"}
            </div>
          </div>

          <div
            className={`dropzone ${isDragOver ? "drag-over" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const droppedFile = e.dataTransfer.files?.[0];
              if (droppedFile) {
                void uploadFile(droppedFile);
              }
            }}
          >
            <div>
              <p style={{ fontWeight: 600, color: "#e2e8f0" }}>
                {fileName || "Choose a file to upload"}
              </p>
              <p className="muted">PDF, DOCX, TXT, MD supported</p>
            </div>
            <div className="dropzone-button">
              <UploadIcon />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleUpload}
              accept=".pdf,.docx,.txt,.md"
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

        {/* Bottom Panel: Chat Interface */}
        <div className="panel chat-panel">
          <div className="panel-header">
            <div>
              <h2>Chat</h2>
              <p className="eyebrow">RAG Agent</p>
            </div>
          </div>

          <div className="chat-history" ref={chatHistoryRef}>
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                <p>Ask a question to start the conversation.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                <span className="message-role">{msg.role === 'user' ? 'You' : 'AI'}</span>
                <div className="message-bubble">
                  {msg.content}
                </div>
                {msg.role === "ai" && msg.sources && msg.sources.length > 0 && (
                  <div className="message-sources">
                    {msg.sources.map((source, idx) => (
                      <div key={`${source.id || source.title || "source"}-${idx}`} className="source-chip">
                        {source.title || source.id || `source:${idx}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="input-area">
            <div className="suggestions">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (formRef.current) {
                      const textarea = formRef.current.querySelector("textarea");
                      if (textarea) {
                        textarea.value = s;
                        handleQuery({ preventDefault: () => { }, target: formRef.current });
                      }
                    }
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            <form ref={formRef} onSubmit={handleQuery} className="query-form">
              <textarea
                name="query"
                rows={1}
                placeholder="Ask a question..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleQuery(e);
                  }
                }}
              />
              <button type="submit" disabled={loading} className="send-button">
                <SendIcon />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
