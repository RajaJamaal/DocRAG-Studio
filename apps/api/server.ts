import http from "http";
import url from "url";
import fs from "fs";

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

async function loadHandler(pathname: string) {
  // try TypeScript first (we run with ts-node/esm), then JS
  const tsFile = `./routes${pathname}.ts`;
  const jsFile = `./routes${pathname}.js`;
  let file = "";
  if (fs.existsSync(tsFile)) file = tsFile;
  else if (fs.existsSync(jsFile)) file = jsFile;
  else throw new Error(`Handler not found: ${tsFile} or ${jsFile}`);
  const mod = await import(file);
  return mod.default;
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url || "", true);
  const pathname = parsed.pathname || "";

  try {
    if (pathname === "/api/routes/query" || pathname === "/api/routes/query-stream") {
      const handler = await loadHandler(pathname);
      await handler(req as any, res as any);
      return;
    }

    if (pathname === "/health") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.statusCode = 404;
    res.end("Not found");
  } catch (err) {
    console.error("Server error:", err);
    if (!res.headersSent) res.setHeader("content-type", "application/json");
    res.statusCode = 500;
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
});

server.listen(port, () => {
  console.log(`Dev API server listening on http://localhost:${port}`);
});

export {};
