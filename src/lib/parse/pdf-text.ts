import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";

/**
 * pdfjs-dist evaluates `new DOMMatrix()` while the module loads.
 * In Next/Turbopack the hashed `pdf-parse` external cannot `require("@napi-rs/canvas")`
 * from `import.meta.url`, so install the Node canvas globals first.
 */
function defineIfMissing(name: "DOMMatrix" | "ImageData" | "Path2D", value: unknown) {
  const g = globalThis as Record<string, unknown>;
  if (g[name] == null) g[name] = value;
}

function ensurePdfJsDomPolyfills() {
  defineIfMissing("DOMMatrix", DOMMatrix);
  defineIfMissing("ImageData", ImageData);
  defineIfMissing("Path2D", Path2D);
}

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  ensurePdfJsDomPolyfills();
  const { CanvasFactory } = await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer, CanvasFactory });
  try {
    const result = await parser.getText();
    return result.text || "";
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
