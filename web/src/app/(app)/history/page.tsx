import type { Metadata } from "next";
import { EmptyState } from "@/components/EmptyState";
import { PageTitle } from "@/components/PageTitle";

export const metadata: Metadata = { title: "Ship's log" };

export default function HistoryPage() {
  return (
    <>
      <PageTitle title="Ship's log" subtitle="Every dose Argos has checked" />
      <EmptyState title="Nothing logged yet" body="Dose history written by the Argos agent appears here in milestone F3." />
    </>
  );
}
