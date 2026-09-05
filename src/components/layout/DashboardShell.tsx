import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  FileStack,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  Settings,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Logo } from "./Logo";
import { NetworkStatus } from "@/components/common/NetworkStatus";
import { ORGANIZATION } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Overview", to: "/dashboard", icon: LayoutDashboard },
  { label: "Certificates", to: "/dashboard/certificates", icon: FileStack },
  { label: "Issue Certificate", to: "/issue", icon: PlusCircle },
  { label: "Bulk Issue", to: "/issue/bulk", icon: Upload },
  { label: "Verification", to: "/verify", icon: ShieldCheck },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-surface/50">
      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-4 lg:flex">
          <Link to="/" className="px-2 py-1">
            <Logo />
          </Link>

          <nav className="mt-6 flex-1 space-y-1" aria-label="Dashboard">
            {NAV.map((item) => {
              const active =
                item.to === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-3 border-t pt-4">
            <NetworkStatus className="w-full justify-center" />
            <Link
              to="/login"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden /> Sign out
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="glass-panel sticky top-0 z-40 rounded-none border-x-0 border-t-0">
            <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
              <div className="flex items-center gap-3 lg:hidden">
                <Link to="/">
                  <Logo compact />
                </Link>
                <span className="text-sm font-medium text-foreground">Certiproof</span>
              </div>
              <p className="hidden truncate text-sm text-muted-foreground lg:block">
                {ORGANIZATION.name}
              </p>
              <div className="flex items-center gap-3">
                <NetworkStatus className="hidden sm:inline-flex" />
                <span className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                  HI
                </span>
              </div>
            </div>
          </header>

          <main className="px-4 pt-6 pb-24 sm:px-6 lg:pb-10">{children}</main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="glass-panel fixed inset-x-0 bottom-0 z-40 flex items-center justify-around rounded-none border-x-0 border-b-0 px-2 py-2 lg:hidden"
        aria-label="Dashboard mobile"
      >
        {NAV.filter((n) => n.to !== "/verify").map((item) => {
          const active =
            item.to === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-lg px-2 py-1 text-[10px]",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" aria-hidden />
              <span className="truncate">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
