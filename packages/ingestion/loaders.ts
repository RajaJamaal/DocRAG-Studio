import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";

export type LoadedDocument = {
  id: string;
  pageContent: string;
  metadata?: Record<string, unknown>;
};

export async function loadDocuments(
  filePaths: string[],
  opts?: { fileHashes?: Record<string, string> }
): Promise<LoadedDocument[]> {
  const docs: LoadedDocument[] = [];

  for (const filePath of filePaths) {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath);

    let content = "";
    if (ext === ".txt" || ext === ".md") {
      content = await fs.readFile(filePath, "utf-8");
    } else if (ext === ".pdf") {
      const data = await fs.readFile(filePath);
      const parsed = await pdfParse(data);
      content = parsed.text;
    } else if (ext === ".docx") {
      const buffer = await fs.readFile(filePath);
      const res = await mammoth.extractRawText({ buffer });
      content = res.value;
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    // Prefer canonical upload hash when available. Fall back to content hash.
    const hash =
      opts?.fileHashes?.[filePath] ??
      await import("crypto").then((c) => c.createHash("sha256").update(content).digest("hex"));

    docs.push({
      id: basename,
      pageContent: content,
      metadata: {
        source: basename,
        hash
      }
    });
  }

  console.log(`Loaded ${docs.length} document(s)`);
  return docs;
}
