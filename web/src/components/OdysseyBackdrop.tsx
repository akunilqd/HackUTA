import Image from "next/image";
import ulyssesAndArgus from "../../public/art/ulysses-and-argus.jpg";

/**
 * The Rivière scene as a full-bleed ground, dimmed with glaze so cream text reads on top of it
 * (overlay keeps cream text above 7:1 even over the engraving's lightest highlights).
 */
export function OdysseyBackdrop({ strength = "hero" }: { strength?: "hero" | "form" }) {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-glaze" aria-hidden="true">
      <Image
        src={ulyssesAndArgus}
        alt=""
        fill
        priority
        sizes="100vw"
        placeholder="blur"
        className="object-cover object-[52%_60%]"
      />
      <div className={`absolute inset-0 ${strength === "hero" ? "bg-glaze/55" : "bg-glaze/80"}`} />
      <div
        className="absolute inset-0"
        style={{
          background:
            strength === "hero"
              ? "radial-gradient(ellipse 60% 55% at 50% 50%, rgba(30,26,23,0.82) 0%, rgba(30,26,23,0.55) 60%, rgba(30,26,23,0) 100%)"
              : "none",
        }}
      />
    </div>
  );
}

/** A gold frame inset from the page edge, growing with the content: a 2px rule with the Greek key running inside its top and bottom. */
export function GoldFrame() {
  return (
    <div className="pointer-events-none absolute inset-3 z-0 border-2 border-gold/80 md:inset-6" aria-hidden="true">
      <div className="meander absolute inset-x-2 top-2" />
      <div className="meander absolute inset-x-2 bottom-2" />
    </div>
  );
}
