import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications/service";
import { markAllReadAction, openNotificationAction } from "./actions";

export const dynamic = "force-dynamic";

const shell: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "2.5rem 1.5rem" };

function fmt(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export default async function NotificationsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const notifications = await listNotifications(ctx.user.id);
  const hasUnread = notifications.some((n) => n.readAt === null);

  return (
    <main style={shell}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Notifications</h1>
        {hasUnread && (
          <form action={markAllReadAction}>
            <button
              type="submit"
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              Mark all as read
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <p style={{ color: "var(--muted)", marginTop: "1.5rem" }}>You have no notifications.</p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "1.5rem 0 0",
            display: "grid",
            gap: "0.6rem",
          }}
        >
          {notifications.map((n) => {
            const unread = n.readAt === null;
            return (
              <li
                key={n.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "0.8rem 1rem",
                  background: unread ? "var(--nav-active-bg)" : "var(--surface)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <div>
                  <div style={{ fontWeight: unread ? 600 : 400 }}>
                    {unread && (
                      <span
                        aria-label="unread"
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "var(--primary)",
                          marginRight: "0.5rem",
                        }}
                      />
                    )}
                    {n.message}
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: "0.8rem", marginTop: "0.2rem" }}>
                    {fmt(n.createdAt)}
                  </div>
                </div>
                {n.evaluationId && (
                  <form action={openNotificationAction.bind(null, n.id)}>
                    <button
                      type="submit"
                      style={{
                        color: "var(--nav-active-fg)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      View call →
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
