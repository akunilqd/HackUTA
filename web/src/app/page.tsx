import { ButtonLink } from "@/components/Button";
import { GoldFrame, OdysseyBackdrop } from "@/components/OdysseyBackdrop";
import { Wordmark } from "@/components/Wordmark";

export default function LandingPage() {
  return (
    <main className="relative isolate flex min-h-svh flex-1 flex-col items-center px-8 pb-14 pt-10 text-center text-cream md:px-16 md:pb-14 md:pt-10">
      <OdysseyBackdrop />
      <GoldFrame />

      <header className="relative z-10 pt-6 md:pt-6">
        <Wordmark tone="light" />
      </header>

      <div className="relative z-10 flex max-w-[52rem] flex-1 flex-col items-center justify-center py-10 md:py-6">
        <div className="running-dog rise w-48 md:w-64" aria-hidden="true" />
        <h1 className="rise mt-6 text-[2.2rem] leading-[1.08] md:text-[3.6rem] lg:text-[4.2rem]">
          Argos watches over the ones you love
        </h1>
        <p className="rise rise-2 mt-6 max-w-[40ch] text-[1.2rem] text-cream md:text-[1.35rem]">
          At medication time, Pharmasee video-calls your parent, checks the bottle in their hand, and tells you they took it.
        </p>
        <div className="rise rise-3 mt-8 w-full sm:w-auto">
          <ButtonLink href="/onboarding" className="w-full min-h-16 px-12 text-[1.15rem] sm:w-auto">
            Get started
          </ButtonLink>
        </div>
      </div>

      <footer className="relative z-10 max-w-[48rem] pb-6 md:pb-4">
        <p className="text-[1rem] italic text-cream">
          “As soon as he saw Ulysses standing there, he dropped his ears and wagged his tail.”
        </p>
        <p className="mt-2 text-[0.95rem] text-cream/85">
          Homer, Odyssey XVII (tr. Samuel Butler). Art: Ulysses and Argus, Frederick Stacpoole after Briton Rivière, 1885. Public
          domain.
        </p>
      </footer>
    </main>
  );
}
