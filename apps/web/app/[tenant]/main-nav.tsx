"use client";

import type { Role } from "@deskflow/shared";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Navigation principale ; la page courante est signalée aux lecteurs d'écran (aria-current).
 * Le tableau de bord n'est proposé qu'aux admins, seuls autorisés à lire les indicateurs.
 */
export function MainNav({ tenant, role }: { tenant: string; role: Role }) {
  const pathname = usePathname();
  const links = [
    { href: `/${tenant}/tickets`, label: "Tickets" },
    ...(role === "ADMIN" ? [{ href: `/${tenant}/dashboard`, label: "Tableau de bord" }] : []),
  ];

  return (
    <nav aria-label="Navigation principale">
      <ul className="flex gap-4 text-sm">
        {links.map(({ href, label }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("hover:text-foreground", active ? "font-medium text-foreground" : "text-muted-foreground")}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
