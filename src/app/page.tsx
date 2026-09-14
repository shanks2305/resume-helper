import { AnalyzeForm } from "@/components/AnalyzeForm";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-[min(100%,92rem)] flex-1 flex-col px-4 py-5 sm:px-6 sm:py-6 md:px-8 lg:px-10 xl:px-12">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
        <div>
          <p className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)] sm:text-4xl">
            FitCheck
          </p>
          <p className="mt-1 max-w-3xl text-sm text-[var(--muted)] sm:text-base">
            Match your resume to a job description — one step at a time.
          </p>
        </div>
      </header>

      <AnalyzeForm />
    </main>
  );
}
