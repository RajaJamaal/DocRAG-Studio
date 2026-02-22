import { z } from "zod";
import url from "url"; // Import url module
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
import { streamAnswerQuery } from "../../../packages/retrieval/ragChain.js";

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
    let rawQuery: string | undefined;

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
        rawQuery = json.q;
      }
    } else if (req.method === "GET") {
      const parsedUrl = url.parse(req.url || "", true);
      const queryParam = parsedUrl.query.q;
      if (typeof queryParam === 'string') {
        rawQuery = queryParam;
      } else if (Array.isArray(queryParam)) {
        rawQuery = queryParam[0];
      }
    }

    const parsedQuery = querySchema.parse({ q: rawQuery });
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

    for await (const event of stream) {
      if (event.type === "token") {
        res.write(`event: token\ndata: ${JSON.stringify({ token: event.token })}\n\n`);
      } else if (event.type === "sources") {
        res.write(`event: sources\ndata: ${JSON.stringify({ sources: event.sources })}\n\n`);
      }
    }
    res.write(`event: done\ndata: [DONE]\n\n`);
    res.end();

  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
    res.end();
  }
}
