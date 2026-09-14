# FitCheck

Resume + job description matcher for ATS friendliness, keyword coverage, and rewrite suggestions.

## Stack

- Next.js (App Router) — free deploy on Vercel
- OpenAI ChatGPT API (production)
- Ollama (local / private)

## Setup

```bash
npm install
cp .env.example .env.local
```

Add your OpenAI key to `.env.local`:

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

For local Ollama:

```bash
ollama pull llama3.1:8b
# in .env.local
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
```

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy (Vercel)

1. Push the repo and import it in Vercel
2. Set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`, `LLM_PROVIDER=openai`)
3. Deploy

Ollama is for local use only unless you host it yourself and point `OLLAMA_BASE_URL` at that server.

## What it does

1. Parses PDF / DOCX / TXT resumes
2. Extracts JD keywords via LLM
3. Scores keyword match + ATS format heuristics
4. Returns missing keywords, checklist, and rewrite suggestions
5. Optionally fills a **LaTeX** resume template (Deedy, Jake/sb2nov, Modern, PlushCV, Harshibar) from JD + resume — download `.tex` or compile PDF
