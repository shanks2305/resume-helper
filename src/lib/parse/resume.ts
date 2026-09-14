import mammoth from "mammoth";
import { sanitizeResumeText } from "@/lib/resume/contact";
import { extractTextFromPdfWithOpenAi } from "./ocr";

function cleanExtractedText(text: string): string {
  return sanitizeResumeText(text).trim();
}

export async function extractResumeText(
  file: File | null,
  pastedText: string,
  options: { allowOcr?: boolean } = {},
): Promise<{ text: string; source: "file" | "paste" | "ocr" }> {
  const paste = pastedText.trim();
  const allowOcr = options.allowOcr !== false;

  if (file && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();
    const type = file.type;

    if (
      name.endsWith(".docx") ||
      type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      const text = cleanExtractedText(result.value);
      if (!text) throw new Error("Could not extract text from the DOCX file.");
      return { text, source: "file" };
    }

    if (name.endsWith(".pdf") || type === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        const text = cleanExtractedText(result.text || "");
        if (text) return { text, source: "file" };
      } finally {
        await parser.destroy().catch(() => undefined);
      }

      if (allowOcr) {
        const ocrText = await extractTextFromPdfWithOpenAi(buffer, file.name);
        return { text: cleanExtractedText(ocrText), source: "ocr" };
      }

      throw new Error(
        "Could not extract text from the PDF. It may be image-based — paste the text instead.",
      );
    }

    if (name.endsWith(".txt") || type.startsWith("text/")) {
      const text = cleanExtractedText(buffer.toString("utf8"));
      if (!text) throw new Error("The text file is empty.");
      return { text, source: "file" };
    }

    throw new Error("Unsupported file type. Use PDF, DOCX, or TXT.");
  }

  if (paste) {
    return { text: cleanExtractedText(paste), source: "paste" };
  }

  throw new Error("Provide a resume file or paste resume text.");
}
