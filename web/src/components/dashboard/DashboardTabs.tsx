"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export const DASHBOARD_TABS = [
  { slug: "profile", label: "Patient profile" },
  { slug: "prescriptions", label: "Prescriptions" },
  { slug: "history", label: "Dose history" },
  { slug: "appointments", label: "Appointments" },
] as const;

/** The four dashboard pages for one patient. Scrolls sideways on narrow phones instead of wrapping. */
export function DashboardTabs({ patientId }: { patientId: string }) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);
  // On narrow phones the tab row scrolls sideways; keep the current tab in view.
  // Braces matter: newer Chrome returns a Promise from scrollIntoView, and an effect must not return one.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);
  return (
    <nav aria-label="Patient pages" className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1 border-b-2 border-glaze/15">
        {DASHBOARD_TABS.map(({ slug, label }) => {
          const href = `/dashboard/${patientId}/${slug}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={slug}>
              <Link
                href={href}
                ref={active ? activeRef : undefined}
                aria-current={active ? "page" : undefined}
                className={
                  "-mb-[2px] inline-flex min-h-14 items-center border-b-4 px-4 font-bold no-underline transition-colors " +
                  (active ? "border-terracotta-deep text-glaze" : "border-transparent text-ink hover:border-gold hover:text-glaze")
                }
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
