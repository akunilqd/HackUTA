import type { ReactNode } from "react";

/** Same look as the onboarding form's inputs, so editing feels like the place the data came from. */
export const inputClass =
  "mt-2 block w-full min-h-12 rounded-md border-2 border-glaze/60 bg-white/70 px-4 text-[1.1rem] text-glaze " +
  "focus:border-aegean focus:outline-none focus-visible:outline-none focus:ring-[3px] focus:ring-aegean/30";

export const cardClass = "border-2 border-gold/60 bg-cream px-5 py-5 md:px-7 md:py-6";

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block font-bold">
        {label}
      </label>
      {hint && <p className="mt-1 text-[1rem] text-ink">{hint}</p>}
      {children}
    </div>
  );
}

/** Read-only label/value pairs. */
export function Facts({ items }: { items: [label: string, value: ReactNode][] }) {
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[0.95rem] text-ink">{label}</dt>
          <dd className="mt-0.5 font-bold">{value ?? <span className="font-normal text-ink">Not set</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Before / after a meal, as the two big radio cards the onboarding form uses. */
export function MealField({ name, defaultValue }: { name: string; defaultValue?: string }) {
  return (
    <fieldset>
      <legend className="font-bold">Is it taken after a meal?</legend>
      <div className="mt-2 grid gap-3 sm:max-w-[30rem] sm:grid-cols-2">
        {(
          [
            ["Yes", "After a meal"],
            ["No", "Before a meal"],
          ] as const
        ).map(([value, detail]) => (
          <label
            key={value}
            className={
              "flex min-h-14 cursor-pointer items-center gap-3 rounded-md border-2 border-glaze/60 bg-white/70 px-4 " +
              "has-[:checked]:border-terracotta-deep has-[:checked]:bg-terracotta-deep/10 " +
              "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-aegean/40"
            }
          >
            <input type="radio" name={name} value={value} defaultChecked={defaultValue === value} required className="h-6 w-6 shrink-0 accent-[#a84a25]" />
            <span className="leading-tight">
              <span className="font-bold">{value}</span>
              <span className="text-ink">, {detail.toLowerCase()}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const TONES = {
  good: "border-olive-deep/50 bg-olive/15 text-olive-deep",
  bad: "border-red-deep/40 bg-red/10 text-red-deep",
  info: "border-aegean-deep/40 bg-aegean/10 text-aegean-deep",
  warn: "border-terracotta-deep/40 bg-gold/20 text-terracotta-deep",
  quiet: "border-glaze/25 bg-cream-deep text-ink",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border-2 px-3 py-0.5 text-[0.9rem] font-bold leading-snug ${TONES[tone]}`}>
      {children}
    </span>
  );
}
