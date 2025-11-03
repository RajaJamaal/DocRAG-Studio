declare module "pdf-parse" {
  export default function parse(buffer: Buffer): Promise<{
    text: string;
    numpages: number;
    info: any;
    metadata: any;
    version: string;
  }>;
}

declare module "mammoth" {
  export function extractRawText(options: { buffer: Buffer }): Promise<{
    value: string;
    messages: any[];
  }>;
}