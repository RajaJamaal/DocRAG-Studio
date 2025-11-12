import { z } from "zod";
// Local type fallbacks to avoid requiring 'next' types in environments where Next.js isn't installed
type NextApiRequest = import("http").IncomingMessage &
  {
    query?: Record<string, any> | string;
    body?: any;
  };
type NextApiResponse<T = any> = import("http").ServerResponse &
  {
    json?: (body: T) => void;
    setHeader: (name: string, value: number | string | string[]) => void;
    write: (chunk: any) => boolean;
    end: (data?: any) => void;
  };

import { loadVectorStore } from "../../../packages/retrieval/vectorStoreLoader/index.js";
import { streamAnswerQuery } from "../../../packages/retrieval/ragChain/index.js"; // Import the new streaming function

export const config = {
  api: {
    bodyParser: false,
  },
};

const querySchema = z.object({
  q: z.string().min(1, "Query 'q' cannot be empty"),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[route:query-stream] handler invoked', { method: (req as any).method, url: (req as any).url });
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let q: string;
  try {
    const parsedQuery = querySchema.parse({ q: req.query?.q || req.body?.q });
    q = parsedQuery.q;
  } catch (e) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: (e as Error).message })}\n\n`);
    res.end();
    return;
  }

  try {
    console.log('[route:query-stream] calling loadVectorStore()');
    const retriever = await loadVectorStore();
    console.log('[route:query-stream] loadVectorStore() resolved');

    const stream = streamAnswerQuery(retriever, q, { topK: 3 });

    for await (const chunk of stream) {
      res.write(`event: token\ndata: ${JSON.stringify({ token: chunk })}\n\n`);
    }
    res.write(`event: done\ndata: [DONE]\n\n`);
    res.end();

  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
    res.end();
  }
}