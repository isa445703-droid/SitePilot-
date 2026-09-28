import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/guards";
import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast";

/** Authenticated application shell: sidebar on desktop, drawer on mobile. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <ToastProvider>
      <AppShell user={user}>{children}</AppShell>
    </ToastProvider>
  );
}
