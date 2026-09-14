import { NextResponse } from "next/server";
import { clientKeyFromRequest, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Compile LaTeX to PDF.
 * Uses latexonline.cc text API when available; otherwise returns 502
 * so the client can fall back to .tex download.
 */
export async function POST(request: Request) {
  const limited = rateLimit(`compile-latex:${clientKeyFromRequest(request)}`, 8);
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Rate limit reached. Try again in ${limited.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  try {
    const body = (await request.json()) as {
      tex?: string;
      filename?: string;
      engine?: string;
    };

    const tex = String(body.tex || "").trim();
    if (tex.length < 40) {
      return NextResponse.json(
        { error: "LaTeX source is required." },
        { status: 400 },
      );
    }

    // Prefer POST /data with a tar when possible; for simple single-file
    // docs the GET text= endpoint works for shorter resumes.
    // Long documents: try texlive data endpoint with multipart form.
    const filename = body.filename || "resume.pdf";
    const engine = body.engine === "xelatex" ? "xelatex" : "pdflatex";

    // Attempt latexonline compile via text query (works for typical 1-page resumes)
    const compileUrl = new URL("https://latexonline.cc/compile");
    compileUrl.searchParams.set("text", tex);
    compileUrl.searchParams.set("command", engine);
    compileUrl.searchParams.set("force", "true");
    compileUrl.searchParams.set("download", filename);

    const upstream = await fetch(compileUrl.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(55_000),
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (
      upstream.ok &&
      (contentType.includes("pdf") ||
        contentType.includes("octet-stream") ||
        contentType.includes("application/pdf"))
    ) {
      const bytes = await upstream.arrayBuffer();
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const log = await upstream.text();
    return NextResponse.json(
      {
        error:
          "LaTeX compile failed. Download the .tex and open it in Overleaf.",
        log: log.slice(0, 4000),
      },
      { status: 502 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "LaTeX compile service unavailable.",
      },
      { status: 502 },
    );
  }
}
