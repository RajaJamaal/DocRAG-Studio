import { z } from "zod";
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
import { loadVectorStore } from "../../../packages/retrieval/vectorStoreLoader/index.js";
import { answerQuery } from "../../../packages/retrieval/ragChain.js";

const querySchema = z.object({
  q: z.string().min(1, "Query 'q' cannot be empty"),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[route:query] handler invoked');
  console.log('[route:query] req.method, req.url', (req as any).method, (req as any).url);

  try {
    let q: string | undefined;

    if (req.method === "POST") {
      const bodyPromise = new Promise<string>((resolve) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => resolve(body));
      });
      const body = await bodyPromise;

      if (body) {
        const json = JSON.parse(body);
        const parsed = querySchema.parse(json);
        q = parsed.q;
      }
    } else if (req.method === "GET") {
      if (req.query && typeof req.query === "object" && "q" in req.query) {
        q = (req.query as Record<string, any>).q;
      }
    }

    if (!q) {
      console.log('[route:query] missing query');
      res.statusCode = 400;
      res.json?.({ error: "Query 'q' required" });
      return;
    }

    console.log('[route:query] query=', q);
    console.log('[route:query] loading vector store');
    console.log('[route:query] calling loadVectorStore()');
    const retriever = await loadVectorStore();
    console.log('[route:query] loadVectorStore() resolved');
    console.log('[route:query] vector store loaded');

    console.log('[route:query] calling answerQuery');
    const result = await answerQuery(retriever, q, { topK: 3 });
    console.log('[route:query] answerQuery returned');

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    const json = JSON.stringify(result);
    res.setHeader('Content-Length', Buffer.byteLength(json));
    res.end(json);
    console.log('[route:query] response sent');
    return;
  } catch (err) {
    console.error("[route:query] Query error:", (err as Error).message);
    res.statusCode = 500;
    res.json?.({ error: (err as Error).message });
    return;
  }
}
