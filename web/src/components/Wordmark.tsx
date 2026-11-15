import Link from "next/link";

/** The Pharmasee wordmark: Cinzel beside a plain gold ring. `tone` follows the ground it sits on. */
export function Wordmark({
  href = "/",
  tone = "dark",
  className = "",
}: {
  href?: string;
  tone?: "dark" | "light";
  className?: string;
}) {
  const ink = tone === "light" ? "#f3e9d2" : "#1e1a17";
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 no-underline ${tone === "light" ? "text-cream" : "text-glaze"} ${className}`}
      aria-label="Pharmasee home"
    >
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0">
        <circle cx="11" cy="11" r="9" fill="none" stroke="#d4a64a" strokeWidth="2.5" />
        <circle cx="11" cy="11" r="2.5" fill={ink} />
      </svg>
      <span className="font-display text-[1.15rem] tracking-[0.12em]">PHARMASEE</span>
    </Link>
  );
}
