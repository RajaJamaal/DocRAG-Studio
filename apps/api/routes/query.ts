import type { NextApiRequest, NextApiResponse } from "next";
import { loadLocalVectorStore } from "../../../packages/retrieval/vectorStoreLoader";
import { answerQuery } from "../../../packages/retrieval/ragChain";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : req.body?.q;
    if (!q) return res.status(400).json({ error: "Query 'q' required" });

    const retriever = await loadLocalVectorStore();

    const result = await answerQuery(retriever, q, { topK: 3 });

    return res.status(200).json(result);
  } catch (err) {
    console.error("Query error:", (err as Error).message);
    return res.status(500).json({ error: (err as Error).message });
  }
}
