"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBottle, IconHome, IconLog, IconSettings } from "./Icons";

const LINKS = [
  { href: "/home", label: "Home", Icon: IconHome },
  { href: "/medicines", label: "Medicines", Icon: IconBottle },
  { href: "/history", label: "Ship's log", Icon: IconLog },
  { href: "/settings", label: "Settings", Icon: IconSettings },
] as const;

/** Top links on desktop, a tab bar on phones. One component so the active state never drifts. */
export function AppNav({ variant }: { variant: "top" | "bottom" }) {
  const pathname = usePathname();
  const isTop = variant === "top";
  return (
    <nav aria-label="Main" className={isTop ? "hidden md:block" : "md:hidden"}>
      <ul className={isTop ? "flex items-center gap-1" : "grid grid-cols-4"}>
        {LINKS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  isTop
                    ? `inline-flex min-h-12 items-center gap-2 rounded-md px-4 font-bold no-underline transition-colors ${
                        active ? "bg-glaze text-cream" : "text-glaze hover:bg-cream-deep"
                      }`
                    : `flex min-h-16 flex-col items-center justify-center gap-1 text-[0.95rem] font-bold no-underline ${
                        active ? "text-terracotta-deep" : "text-ink"
                      }`
                }
              >
                <Icon className={isTop ? "h-5 w-5" : "h-6 w-6"} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
