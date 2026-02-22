import "./tracing.js";
import http from "http";
import url from "url";
import { fileURLToPath, pathToFileURL } from "url";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const port = process.env.PORT ? Number(process.env.PORT) : 3001;

async function loadHandler(pathname: string) {
  // Map '/api/routes/<name>' -> './routes/<name>.ts' or .js
  const prefix = "/api/routes/";
  if (!pathname.startsWith(prefix)) throw new Error("Invalid route");
  // sanitize route name to avoid duplicated segments
  let name = pathname.replace(new RegExp(`^${prefix}+`), "").replace(/\/+/g, "/");
  // take the last path segment (e.g. 'query' from 'query' or 'api/routes/query')
  name = name.split("/").filter(Boolean).pop() || "";

  const tsUrl = new URL(`./routes/${name}.ts`, import.meta.url);
  const jsUrl = new URL(`./routes/${name}.js`, import.meta.url);
  const tsPath = fileURLToPath(tsUrl);
  const jsPath = fileURLToPath(jsUrl);

  let chosenUrl: URL | null = null;
  if (fs.existsSync(jsPath)) chosenUrl = jsUrl;
  else if (fs.existsSync(tsPath)) chosenUrl = tsUrl;
  else throw new Error(`Handler not found: ${tsUrl.href} or ${jsUrl.href}`);

  const mod = await import(chosenUrl.href);
  return mod.default;
}

const server = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*"); // Or a specific origin
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, traceparent, tracestate, X-File-Name"
  );

  // Handle OPTIONS pre-flight requests
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = url.parse(req.url || "", true);
  const pathname = parsed.pathname || "";
  console.log("[server] incoming", req.method, pathname);

  try {
    if (pathname.startsWith("/api/routes/")) {
      console.log("[server] resolving handler for", pathname);
      const handler = await loadHandler(pathname);
      console.log("[server] loaded handler; invoking...");

      // Attach json helper
      (res as any).json = (body: any) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(body));
      };

      await handler(req as any, res as any);
      console.log("[server] handler completed");
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

export { };
