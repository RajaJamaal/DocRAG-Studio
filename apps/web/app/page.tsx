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
  const [uploadStatus, setUploadStatus] = useState("");

  async function handleUpload(e: any) {
    const file = e.target.files[0];
    if (!file) return;

    setUploadStatus("Uploading...");
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

      setUploadStatus(`Success: ${file.name} ingested.`);
    } catch (err) {
      setUploadStatus(`Error: ${(err as Error).message}`);
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
    setAnswer("");
    setLoading(true);
    const q = e.target.query.value;
    const es = new EventSource(`${API_BASE}/api/routes/query-stream?q=${encodeURIComponent(q)}`);
    es.onmessage = (event) => {
      // fallback for default event
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
      setAnswer((prev) => prev + "\n[Error: " + event.data + "]");
    });
  }

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">DocRAG Studio</h1>

      <div className="mb-8 p-4 border rounded bg-gray-50">
        <h2 className="font-semibold mb-2">1. Upload Document</h2>
        <input type="file" onChange={handleUpload} className="block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100
        "/>
        {uploadStatus && <p className="mt-2 text-sm text-gray-600">{uploadStatus}</p>}
      </div>

      <div className="p-4 border rounded bg-white">
        <h2 className="font-semibold mb-2">2. Ask Question</h2>
        <form onSubmit={handleQuery} className="flex gap-2">
          <input name="query" className="border p-2 w-full rounded" placeholder="Ask about your docs…" />
          <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">
            {loading ? "Thinking…" : "Ask"}
          </button>
        </form>
        <pre className="mt-4 whitespace-pre-wrap border p-4 min-h-[120px] bg-gray-50 rounded font-mono text-sm">{answer}</pre>
      </div>
    </main>
  );
}
