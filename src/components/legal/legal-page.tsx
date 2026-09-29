import Link from "next/link";

export type LegalSection = { heading: string; body: string };

/**
 * Shared shell for /legal/* — one readable column of prose with the same
 * header as the pricing page. Content arrives already translated so the pages
 * can keep their keys as literal strings (verified by tests/i18n-keys.test.ts).
 */
export function LegalPage({
  appName,
  backLabel,
  title,
  updated,
  intro,
  sections,
}: {
  appName: string;
  backLabel: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-sm font-black text-white">
              SP
            </span>
            <span className="text-[15px] font-bold tracking-tight">{appName}</span>
          </Link>
          <Link href="/" className="text-sm font-medium text-primary hover:underline">
            {backLabel}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">{updated}</p>
        <p className="mt-6 text-lg leading-relaxed text-muted">{intro}</p>

        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold text-ink">{section.heading}</h2>
              <p className="mt-2 leading-relaxed text-muted">{section.body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
