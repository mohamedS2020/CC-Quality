"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { useSession } from "@/lib/auth/session-context";
import type { PermissionKey } from "@/lib/auth/permissions";
import { logoutAction } from "./login/actions";
import styles from "./app-shell.module.css";

// --- Icons (inline, stroke-based, no dependencies) -------------------------
type IconProps = { size?: number };
const svg = (path: ReactNode, size = 18) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {path}
  </svg>
);
const IconHome = ({ size }: IconProps) =>
  svg(
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </>,
    size,
  );
const IconClipboard = ({ size }: IconProps) =>
  svg(
    <>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4V3h6v1" />
      <path d="M9 10h6M9 14h6M9 18h4" />
    </>,
    size,
  );
const IconEdit = ({ size }: IconProps) =>
  svg(
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>,
    size,
  );
const IconUpload = ({ size }: IconProps) =>
  svg(
    <>
      <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
    </>,
    size,
  );
const IconSliders = ({ size }: IconProps) =>
  svg(
    <>
      <path d="M4 6h11M19 6h1M4 12h4M12 12h8M4 18h9M17 18h3" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="14" cy="18" r="2" />
    </>,
    size,
  );
const IconCalendar = ({ size }: IconProps) =>
  svg(
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>,
    size,
  );
const IconUsers = ({ size }: IconProps) =>
  svg(
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8" />
      <path d="M18 20a6 6 0 0 0-3-5.2" />
    </>,
    size,
  );
const IconShield = ({ size }: IconProps) =>
  svg(
    <>
      <path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>,
    size,
  );
const IconChart = ({ size }: IconProps) =>
  svg(
    <>
      <path d="M5 20V11M12 20V5M19 20v-6" />
      <path d="M3 20h18" />
    </>,
    size,
  );
const IconBell = ({ size }: IconProps) =>
  svg(
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>,
    size,
  );
const IconMenu = ({ size }: IconProps) => svg(<path d="M4 6h16M4 12h16M4 18h16" />, size);
const IconLogout = ({ size }: IconProps) =>
  svg(
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5" />
      <path d="M5 12h11" />
    </>,
    size,
  );

// --- Nav model -------------------------------------------------------------
type NavItem = {
  href: string;
  label: string;
  permission?: PermissionKey;
  roles?: UserRole[];
  icon: ReactNode;
};
type NavGroup = { label?: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    items: [
      { href: "/", label: "Home", icon: <IconHome /> },
      {
        href: "/dashboard",
        label: "My scorecard",
        permission: "reports.view",
        roles: ["AGENT"],
        icon: <IconChart />,
      },
      { href: "/notifications", label: "Notifications", roles: ["AGENT"], icon: <IconBell /> },
    ],
  },
  {
    label: "Scoring",
    items: [
      {
        href: "/evaluations",
        label: "Evaluations",
        permission: "evaluations.view",
        icon: <IconClipboard />,
      },
      {
        href: "/evaluations/new",
        label: "New score sheet",
        permission: "evaluations.create",
        icon: <IconEdit />,
      },
      {
        href: "/evaluations/import",
        label: "Import",
        permission: "imports.run",
        icon: <IconUpload />,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        href: "/admin/config",
        label: "Configuration",
        permission: "config.view",
        icon: <IconSliders />,
      },
      {
        href: "/admin/periods",
        label: "Periods",
        permission: "periods.lock",
        icon: <IconCalendar />,
      },
      { href: "/admin/agents", label: "Agents", permission: "agents.manage", icon: <IconUsers /> },
      { href: "/admin/users", label: "Users", permission: "users.manage", icon: <IconShield /> },
    ],
  },
  // "Insights" (dashboards/reports, reports.view) slots in here at task 9.
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  MODERATOR: "Moderator",
  AGENT: "Agent",
};

/** Longest-prefix match so nested routes highlight the right item (never two). */
function computeActive(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const match =
      href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
    if (match && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

export function AppShell({
  children,
  unreadCount = 0,
}: {
  children: ReactNode;
  unreadCount?: number;
}) {
  const { user, permissions } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Unauthenticated (e.g. /login): render the page with no chrome.
  if (!user) return <>{children}</>;

  const granted = new Set(permissions);
  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter(
      (i) =>
        (!i.permission || granted.has(i.permission)) && (!i.roles || i.roles.includes(user.role)),
    ),
  })).filter((g) => g.items.length > 0);

  const activeHref = computeActive(
    pathname,
    groups.flatMap((g) => g.items.map((i) => i.href)),
  );

  const brand = (
    <div className={styles.brand}>
      <span className={styles.brandMark} aria-hidden="true">
        CC
      </span>
      <span className={styles.brandText}>
        <span className={styles.brandTitle}>CC-Quality</span>
        <span className={styles.brandSub}>QA Scorecard</span>
      </span>
    </div>
  );

  return (
    <div className={styles.shell}>
      <aside
        className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}
        aria-label="Primary navigation"
      >
        {brand}
        <nav className={styles.nav}>
          {groups.map((group, gi) => (
            <div className={styles.group} key={group.label ?? `g${gi}`}>
              {group.label && <div className={styles.groupLabel}>{group.label}</div>}
              {group.items.map((item) => {
                const active = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.item} ${active ? styles.itemActive : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.icon}
                    <span className={styles.itemLabel}>{item.label}</span>
                    {item.href === "/notifications" && unreadCount > 0 && (
                      <span className={styles.badge}>{unreadCount}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={styles.footer}>
          <div className={styles.userCard}>
            <span className={styles.avatar} aria-hidden="true">
              {initials(user.name)}
            </span>
            <span className={styles.userMeta}>
              <span className={styles.userName}>{user.name}</span>
              <span className={styles.userRole}>{ROLE_LABEL[user.role] ?? user.role}</span>
            </span>
          </div>
          <form action={logoutAction}>
            <button type="submit" className={styles.signout}>
              <IconLogout size={16} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <button
        type="button"
        aria-label="Close navigation"
        tabIndex={open ? 0 : -1}
        className={`${styles.overlay} ${open ? styles.overlayShown : ""}`}
        onClick={() => setOpen(false)}
      />

      <div className={styles.contentCol}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.hamburger}
            aria-label="Open navigation"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <IconMenu />
          </button>
          <span className={styles.topbarBrand}>CC-Quality</span>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
