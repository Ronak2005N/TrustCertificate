import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DashboardShell } from "@/components/layout/DashboardShell";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <DashboardShell>
      <Outlet />
    </DashboardShell>
  ),
});
