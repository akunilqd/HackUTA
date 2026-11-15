import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ButtonLink } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { PageTitle } from "@/components/PageTitle";
import { IconPerson } from "@/components/Icons";
import { formatPhone } from "@/lib/phone";
import { adminClient, hasAdminEnv } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardHome() {
  return (
    <>
      <PageTitle title="Dashboard" subtitle="Choose the person whose records you want to see or change" />
      <Suspense fallback={<ListSkeleton />}>
        <PatientList />
      </Suspense>
    </>
  );
}

async function PatientList() {
  await connection();
  if (!hasAdminEnv()) {
    return <EmptyState title="Not connected yet" body="Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to web/.env.local, then reload." />;
  }
  const { data, error } = await adminClient().from("users").select("id, name, phone, timezone, user_medications(count)").order("name");
  if (error) return <EmptyState title="Could not load patients" body={error.message} />;
  if (!data.length) {
    return (
      <EmptyState
        title="No one is being watched yet"
        body="Add the first person and their medicines. They will appear here."
        action={<ButtonLink href="/onboarding">Get started</ButtonLink>}
      />
    );
  }

  return (
    <>
      <ul className="grid gap-4 md:grid-cols-2">
        {data.map((p) => {
          const meds = p.user_medications[0]?.count ?? 0;
          return (
            <li key={p.id}>
              <Link
                href={`/dashboard/${p.id}/profile`}
                className="group flex items-center gap-4 border-2 border-gold/60 bg-cream px-5 py-5 no-underline transition-colors hover:border-terracotta-deep hover:bg-white/40"
              >
                <IconPerson className="h-10 w-10 shrink-0 text-terracotta-deep" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.25rem] font-bold text-glaze group-hover:underline">{p.name}</span>
                  <span className="block text-ink">
                    {p.phone ? formatPhone(p.phone) : "No phone"} · {meds} {meds === 1 ? "medicine" : "medicines"}
                  </span>
                  <span className="block text-[0.95rem] text-ink">{p.timezone}</span>
                </span>
                <span aria-hidden="true" className="text-[1.5rem] text-terracotta-deep">
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-8">
        <ButtonLink href="/onboarding" variant="secondary">
          + Add another person
        </ButtonLink>
      </div>
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="Loading patients">
      {[0, 1].map((i) => (
        <div key={i} className="h-[7.5rem] border-2 border-gold/40 bg-cream-deep/50" />
      ))}
    </div>
  );
}
