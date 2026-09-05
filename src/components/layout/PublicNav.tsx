import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "How it works", to: "/", hash: "how-it-works" },
  { label: "Verify", to: "/verify" },
  { label: "For Organizations", to: "/login" },
] as const;

export function PublicNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-colors",
        scrolled ? "glass-panel border-x-0 border-t-0 rounded-none" : "border-b border-transparent",
      )}
    >
      <nav
        className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
        aria-label="Main"
      >
        <Link to="/" className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) =>
            "hash" in l && l.hash ? (
              <Link
                key={l.label}
                to={l.to}
                hash={l.hash}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {l.label}
              </Link>
            ) : (
              <Link
                key={l.label}
                to={l.to}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {l.label}
              </Link>
            ),
          )}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Issuer Login</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/verify">Verify Certificate</Link>
          </Button>
        </div>

        <button
          type="button"
          className="rounded-md p-2 text-foreground md:hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <Menu className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {open && (
        <div className="border-t bg-card px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <Button asChild variant="outline" onClick={() => setOpen(false)}>
              <Link to="/login">Issuer Login</Link>
            </Button>
            <Button asChild onClick={() => setOpen(false)}>
              <Link to="/verify">Verify Certificate</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
