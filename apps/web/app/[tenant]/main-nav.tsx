"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Navigation principale ; la page courante est signalée aux lecteurs d'écran (aria-current). */
export function MainNav({ tenant }: { tenant: string }) {
  const pathname = usePathname();
  const links = [{ href: `/${tenant}/tickets`, label: "Tickets" }];

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
