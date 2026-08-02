import type { Metadata } from "next";
import "./globals.css";
import { getAuthContext } from "@/lib/auth";
import { SessionProvider, type SessionValue } from "@/lib/auth/session-context";
import { unreadNotificationCount } from "@/lib/notifications/service";
import { AppShell } from "./app-shell";

export const metadata: Metadata = {
  title: "CC-Quality — QA Scorecard",
  description: "Call Center Quality Scoring System",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getAuthContext();
  const session: SessionValue = ctx
    ? {
        user: {
          id: ctx.user.id,
          email: ctx.user.email,
          name: ctx.user.name,
          role: ctx.user.role,
          active: ctx.user.active,
          agentLoginId: ctx.user.agentLoginId,
        },
        permissions: [...ctx.permissions],
      }
    : { user: null, permissions: [] };

  // Only agents receive notifications today, so only they need the badge count.
  const unreadCount =
    ctx && ctx.user.role === "AGENT" ? await unreadNotificationCount(ctx.user.id) : 0;

  return (
    <html lang="en">
      <body>
        <SessionProvider value={session}>
          <AppShell unreadCount={unreadCount}>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
