const STEPS = ["Your loved one", "Family contact", "Medicines"];

/** Progress as a ship crossing a thin sea line toward Ithaca. */
export function Voyage({ step }: { step: number }) {
  const progress = step / STEPS.length; // 0 at the start, 1 at Ithaca
  return (
    <div className="text-cream">
      <div className="relative h-14 overflow-hidden">
        <svg className="absolute inset-x-0 bottom-1 h-6 w-full" viewBox="0 0 600 24" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M0 14 C 50 14, 75 6, 100 6 S 150 14, 200 14 S 250 6, 300 6 S 350 14, 400 14 S 450 6, 500 6 S 550 14, 600 14"
            fill="none"
            stroke="#d4a64a"
            strokeWidth="2"
          />
        </svg>
        <div
          className="absolute inset-x-0 bottom-3 transition-transform duration-700 ease-[var(--ease-out-expo)] motion-reduce:transition-none"
          style={{ transform: `translateX(calc(${progress * 100}% - ${progress * 44}px))` }}
          aria-hidden="true"
        >
          <svg width="44" height="30" viewBox="0 0 44 30">
            <path d="M2 20h40l-7 7H9z" fill="#a84a25" stroke="#f3e9d2" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M21 3v17" stroke="#f3e9d2" strokeWidth="1.5" />
            <path d="M21 4l13 4v9l-13 2z" fill="#f3e9d2" />
            <circle cx="36" cy="23" r="1.4" fill="#f3e9d2" />
          </svg>
        </div>
        <span className="absolute bottom-8 right-0 font-display text-[1.05rem] tracking-[0.1em] text-gold">Ithaca</span>
      </div>
      <ol className="mt-3 grid grid-cols-3 gap-2 text-[1rem]" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={i === step ? "font-bold text-cream" : i < step ? "text-cream/85" : "text-cream/70"}
          >
            <span className="sr-only">{i < step ? "Done: " : i === step ? "Current: " : ""}</span>
            {i + 1}. {label}
          </li>
        ))}
      </ol>
    </div>
  );
}
