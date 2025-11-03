"use client";
import { useState } from "react";

export default function Home() {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleQuery(e: any) {
    e.preventDefault();
    setAnswer("");
    setLoading(true);
    const q = e.target.query.value;
    const es = new EventSource(`/api/query-stream?q=${encodeURIComponent(q)}`);
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
    <main className="p-8">
      <form onSubmit={handleQuery}>
        <input name="query" className="border p-2 w-full" placeholder="Ask about your docs…" />
        <button type="submit" disabled={loading} className="ml-2 px-4 py-2 bg-blue-500 text-white rounded">{loading ? "Loading…" : "Ask"}</button>
      </form>
      <pre className="mt-4 whitespace-pre-wrap border p-4 min-h-[120px]">{answer}</pre>
    </main>
  );
}
