type PdfParseResult = {
  text: string;
  numpages: number;
  info: any;
  metadata: any;
  version: string;
};

declare module "pdf-parse" {
  export default function parse(buffer: Buffer): Promise<{
    text: string;
    numpages: number;
    info: any;
    metadata: any;
    version: string;
  }>;
}

declare module "pdf-parse/lib/pdf-parse.js" {
  export default function parse(buffer: Buffer): Promise<PdfParseResult>;
}
