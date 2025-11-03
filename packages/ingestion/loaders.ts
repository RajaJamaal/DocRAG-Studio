import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export type LoadedDocument = {
  id: string;
  pageContent: string;
  metadata?: Record<string, unknown>;
};

export async function loadDocuments(filePaths: string[]): Promise<LoadedDocument[]> {
  const docs: LoadedDocument[] = [];

  for (const filePath of filePaths) {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath);

    if (ext === ".txt") {
      const raw = await fs.readFile(filePath, "utf-8");
      docs.push({ id: basename, pageContent: raw, metadata: { source: filePath } });
    } else if (ext === ".pdf") {
      const data = await fs.readFile(filePath);
      const parsed = await pdfParse(data);
      docs.push({ id: basename, pageContent: parsed.text, metadata: { source: filePath } });
    } else if (ext === ".docx") {
      const buffer = await fs.readFile(filePath);
      const res = await mammoth.extractRawText({ buffer });
      docs.push({ id: basename, pageContent: res.value, metadata: { source: filePath } });
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  console.log(`Loaded ${docs.length} document(s)`);
  return docs;
}
