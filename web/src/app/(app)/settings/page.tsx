import type { Metadata } from "next";
import { PageTitle } from "@/components/PageTitle";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageTitle title="Settings" subtitle="Profile and family contact" />
      <p className="text-ink">Profile and family-contact editing arrive in milestone F2.</p>
    </>
  );
}
