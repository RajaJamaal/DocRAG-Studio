import fs from "fs";
import path from "path";
import { UPLOADS_DIR } from "../../../packages/config/index.js";
import { buildIngestionGraph } from "../../../packages/graph/ingestionGraph.js";
import { loadVectorStore } from "../../../packages/retrieval/vectorStoreLoader/index.js";

// Local type fallbacks
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log('[route:upload] handler invoked');

    if (req.method !== "POST") {
        res.statusCode = 405;
        res.json?.({ error: "Method not allowed" });
        return;
    }

    const filename = req.headers["x-file-name"] as string;
    if (!filename) {
        res.statusCode = 400;
        res.json?.({ error: "Missing X-File-Name header" });
        return;
    }

    try {
        // Ensure uploads directory exists
        if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }

        const filePath = path.join(UPLOADS_DIR, filename);
        const writeStream = fs.createWriteStream(filePath);

        // Calculate hash on the fly
        const crypto = await import("crypto");
        const hashStream = crypto.createHash("sha256");

        await new Promise((resolve, reject) => {
            req.on("data", (chunk) => {
                writeStream.write(chunk);
                hashStream.update(chunk);
            });
            req.on("end", () => {
                writeStream.end();
                resolve(null);
            });
            req.on("error", (err) => {
                writeStream.end();
                reject(err);
            });
        });

        const fileHash = hashStream.digest("hex");
        console.log(`[route:upload] File saved to ${filePath} (hash: ${fileHash})`);

        // Check for duplicates using hash
        const store = await loadVectorStore();
        if (store.hasDocument && await store.hasDocument(filename, fileHash)) {
            console.log(`[route:upload] Duplicate detected: ${filename} (hash match)`);
            // Cleanup
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

            res.statusCode = 409;
            res.json?.({ error: "Document already exists" });
            return;
        }

        // Trigger ingestion
        console.log('[route:upload] Starting ingestion...');
        const graph = buildIngestionGraph();
        try {
            const finalState = await graph.invoke({ filePaths: [filePath] });
            console.log('[route:upload] Ingestion complete');
            res.statusCode = 200;
            res.json?.({ success: true, state: finalState });
        } catch (ingestErr) {
            console.error("[route:upload] Ingestion failed:", ingestErr);
            // Cleanup file on failure
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`[route:upload] Cleaned up file: ${filePath}`);
            }
            throw ingestErr;
        }

    } catch (err) {
        console.error("[route:upload] Error:", err);
        res.statusCode = 500;
        res.json?.({ error: (err as Error).message });
    }
}
