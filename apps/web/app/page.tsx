"use client";
import "../tracing";
import "./page.css";
import { useMemo, useState, useRef, useEffect, type ReactNode } from "react";

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

const TypingIndicator = () => (
  <div className="typing-indicator" aria-label="AI is thinking">
    <span />
    <span />
    <span />
  </div>
);

type Message = {
  role: "user" | "ai";
  content: string;
  pending?: boolean;
  sources?: Array<{
    ref?: number;
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

  function formatInlineCitations(
    content: string,
    sources: Array<{ ref?: number; id?: string; title?: string }>
  ): string {
    const citationGroupRegex = /(?:\s*\[source:\d+\]\s*)+/gi;

    return content.replace(citationGroupRegex, (group: string) => {
      const refs = Array.from(group.matchAll(/\[source:(\d+)\]/gi))
        .map((match) => Number.parseInt(match[1], 10))
        .filter((ref) => !Number.isNaN(ref));

      if (refs.length === 0) return group;

      const labels: string[] = [];
      const seen = new Set<string>();

      for (const ref of refs) {
        const source = sources.find((s) => s.ref === ref);
        const label = source?.title || source?.id || `source:${ref}`;
        if (seen.has(label)) continue;
        seen.add(label);
        labels.push(`[${label}]`);
      }

      return labels.length > 0 ? ` (source: ${labels.join(", ")})` : group;
    });
  }

  function renderAiContent(content: string) {
    const normalizedContent = content
      // Break chained bullet ideas into separate lines.
      .replace(/(\]|\)|\.|:)\s*-\s+(?=[A-Z])/g, "$1\n- ")
      // Break chained numbered points into separate lines.
      .replace(/(\]|\)|\.|:)\s*(\d+\.\s+)/g, "$1\n$2");

    const lines = normalizedContent.split("\n");
    const blocks: ReactNode[] = [];
    let i = 0;
    let key = 0;

    const isHeading = (line: string) => /^#{1,3}\s+/.test(line);
    const isBullet = (line: string) => /^[-*]\s+/.test(line);
    const isNumbered = (line: string) => /^\d+\.\s+/.test(line);

    while (i < lines.length) {
      const line = lines[i].trim();

      if (!line) {
        i += 1;
        continue;
      }

      const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2].trim();
        const tag = level === 1 ? "h3" : level === 2 ? "h4" : "h5";
        blocks.push(
          <div key={`ai-block-${key++}`} className={`ai-heading ${tag}`}>
            {text}
          </div>
        );
        i += 1;
        continue;
      }

      if (isBullet(line)) {
        const items: string[] = [];
        while (i < lines.length && isBullet(lines[i].trim())) {
          const rawItem = lines[i].trim().replace(/^[-*]\s+/, "");
          const splitItems = rawItem
            .split(/\s+-\s+(?=[A-Z])/)
            .map((item) => item.trim())
            .filter(Boolean);
          if (splitItems.length > 0) {
            items.push(...splitItems);
          }
          i += 1;
        }
        blocks.push(
          <ul key={`ai-block-${key++}`} className="ai-list ai-list-ul">
            {items.map((item, idx) => (
              <li key={`ai-li-${key}-${idx}`}>{item}</li>
            ))}
          </ul>
        );
        continue;
      }

      if (isNumbered(line)) {
        const items: string[] = [];
        while (i < lines.length && isNumbered(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
          i += 1;
        }
        blocks.push(
          <ol key={`ai-block-${key++}`} className="ai-list ai-list-ol">
            {items.map((item, idx) => (
              <li key={`ai-ol-${key}-${idx}`}>{item}</li>
            ))}
          </ol>
        );
        continue;
      }

      let paragraph = line;
      i += 1;
      while (i < lines.length) {
        const next = lines[i].trim();
        if (!next || isHeading(next) || isBullet(next) || isNumbered(next)) break;
        paragraph += ` ${next}`;
        i += 1;
      }

      blocks.push(
        <p key={`ai-block-${key++}`} className="ai-paragraph">
          {paragraph}
        </p>
      );
    }

    if (blocks.length === 0) return <p className="ai-paragraph">{content}</p>;
    return <div className="ai-rich-content">{blocks}</div>;
  }

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
    setMessages(prev => [...prev, { role: "ai", content: "", pending: true }]);

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
            pending: false,
            content: lastMsg.content + token
          };
        }
        return newMsgs;
      });
    });

    es.addEventListener("sources", (event: MessageEvent) => {
      const { sources } = JSON.parse(event.data) as {
        sources?: Array<{ ref?: number; id?: string; title?: string; snippet?: string }>;
      };

      if (!Array.isArray(sources)) return;

      setMessages(prev => {
        const newMsgs = [...prev];
        const lastMsgIndex = newMsgs.length - 1;
        const lastMsg = newMsgs[lastMsgIndex];

        if (lastMsg && lastMsg.role === "ai") {
          newMsgs[lastMsgIndex] = {
            ...lastMsg,
            pending: false,
            content: formatInlineCitations(lastMsg.content, sources),
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
            pending: false,
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
                  {msg.role === "ai"
                    ? (msg.pending ? <TypingIndicator /> : renderAiContent(msg.content))
                    : msg.content}
                </div>
                {msg.role === "ai" && !msg.pending && msg.sources && msg.sources.length > 0 && (
                  <details className="message-citations">
                    <summary>Sources ({msg.sources.length})</summary>
                    <ul className="citation-list">
                      {msg.sources.map((source, idx) => (
                        <li key={`${source.id || source.title || "source"}-${idx}`} className="citation-item">
                          <span className="source-chip">
                            {source.title || source.id || `source:${idx + 1}`}
                          </span>
                          {source.snippet && (
                            <p className="source-snippet">{source.snippet}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
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
