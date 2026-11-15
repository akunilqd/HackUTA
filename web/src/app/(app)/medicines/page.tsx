import type { Metadata } from "next";
import { EmptyState } from "@/components/EmptyState";
import { PageTitle } from "@/components/PageTitle";

export const metadata: Metadata = { title: "Medicines" };

export default function MedicinesPage() {
  return (
    <>
      <PageTitle title="Medicines" subtitle="The remedies Argos guards each day" />
      <EmptyState title="No medicines yet" body="Adding and editing medicines, with a bottle photo, comes in milestone F2." />
    </>
  );
}
