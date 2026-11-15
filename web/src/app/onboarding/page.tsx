import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { OdysseyBackdrop } from "@/components/OdysseyBackdrop";
import { Wordmark } from "@/components/Wordmark";
import { OnboardingForm } from "./OnboardingForm";

export const metadata: Metadata = { title: "Begin the journey" };

export default function OnboardingPage() {
  return (
    <main className="relative isolate flex min-h-svh flex-1 flex-col">
      <OdysseyBackdrop strength="form" />
      <header className="flex justify-center px-5 pt-8">
        <Wordmark tone="light" />
      </header>
      <div className="mx-auto w-full max-w-[42rem] px-4 pb-16 pt-8 md:px-5">
        <Suspense fallback={<div className="min-h-[36rem] border-2 border-gold bg-cream" aria-busy="true" />}>
          <RequestTimeForm />
        </Suspense>
      </div>
      <div className="running-dog mt-auto" aria-hidden="true" />
      <div className="h-4" aria-hidden="true" />
    </main>
  );
}

/** The form keys fields with random ids and reads today's date, so it renders per request, not at build time. */
async function RequestTimeForm() {
  await connection();
  const canSave = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  return <OnboardingForm enabled={canSave} />;
}
