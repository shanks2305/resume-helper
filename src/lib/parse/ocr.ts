import OpenAI from "openai";
import { OCR_SYSTEM } from "@/lib/prompts";

/** Attempt OCR / vision text extraction for image-based PDFs via OpenAI. */
export async function extractTextFromPdfWithOpenAi(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "This PDF looks scanned (no extractable text). Paste the resume text, or set OPENAI_API_KEY for OCR.",
    );
  }

  const model = process.env.OPENAI_OCR_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });
  const b64 = buffer.toString("base64");
  const dataUrl = `data:application/pdf;base64,${b64}`;

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: OCR_SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all readable text from this resume PDF. Return plain text only.",
            },
            // OpenAI file input for document models / multimodal
            {
              type: "file",
              file: {
                filename: filename || "resume.pdf",
                file_data: dataUrl,
              },
            } as unknown as OpenAI.Chat.Completions.ChatCompletionContentPart,
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() || "";
    if (content.length > 40) return content;
  } catch {
    // Fall through to clearer error — file/PDF modality may be unsupported on this model.
  }

  throw new Error(
    "Could not OCR this PDF. It may be image-based — paste the resume text instead, or export a text PDF.",
  );
}
