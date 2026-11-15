import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { PageTitle } from "@/components/PageTitle";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return (
    <>
      <PageTitle title="Home" subtitle="Ithaca: today's watch, at a glance" />
      <EmptyState
        title="Today's timeline arrives in the next step"
        body="Once medicines are added, this page shows each dose of the day: taken, upcoming, or missed."
        action={<ButtonLink href="/medicines">Go to medicines</ButtonLink>}
      />
    </>
  );
}
