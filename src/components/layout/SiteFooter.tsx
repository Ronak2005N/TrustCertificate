import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Verify", to: "/verify" as const },
      { label: "Issue", to: "/issue" as const },
      { label: "Dashboard", to: "/dashboard" as const },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "How it works", to: "/" as const },
      { label: "Documentation", to: "/" as const },
      { label: "Contact", to: "/" as const },
    ],
  },
];

const TECH = ["Next.js", "Polygon", "Solidity", "SHA-256"];

export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Certificate verification you can trust. Blockchain-backed certificate verification
            platform.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {TECH.map((t) => (
              <li
                key={t}
                className="rounded-full border bg-muted/60 px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
              >
                {t}
              </li>
            ))}
          </ul>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="text-xs font-semibold tracking-widest text-foreground uppercase">
              {col.title}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© 2026 Certiproof. Academic prototype — demo blockchain records only.</p>
          <p>Polygon Amoy Testnet · CertChainRegistry</p>
        </div>
      </div>
    </footer>
  );
}
