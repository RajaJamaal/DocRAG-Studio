// Local type fallbacks to avoid requiring 'next' types in environments where Next.js isn't installed
type NextApiRequest = import("http").IncomingMessage & {
  query?: Record<string, any> | string;
  body?: any;
};

type NextApiResponse<T = any> = import("http").ServerResponse & {
  json?: (body: T) => void;
  setHeader: (name: string, value: number | string | string[]) => void;
  write: (chunk: any) => boolean;
  end: (data?: any) => void;
};
import { loadVectorStore } from "../../../packages/retrieval/vectorStoreLoader";
import { answerQuery } from "../../../packages/retrieval/ragChain";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    let q: string | undefined;
    if (req.query && typeof req.query === "object" && "q" in req.query) {
      q = (req.query as Record<string, any>).q;
    } else if (typeof req.query === "string") {
      q = req.query;
    } else if (req.body && typeof req.body === "object" && "q" in req.body) {
      q = req.body.q;
    }
    if (!q) {
      res.statusCode = 400;
      res.json?.({ error: "Query 'q' required" });
      return;
    }

  const retriever = await loadVectorStore();

    const result = await answerQuery(retriever, q, { topK: 3 });

  res.statusCode = 200;
  res.json?.(result);
  return;
  } catch (err) {
    console.error("Query error:", (err as Error).message);
  res.statusCode = 500;
  res.json?.({ error: (err as Error).message });
  return;
  }
}
