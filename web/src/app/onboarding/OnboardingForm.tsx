"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFieldArray, useForm, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { Button, buttonClass } from "@/components/Button";
import { Voyage } from "@/components/Voyage";
import { onboardingSchema, today, type OnboardingValues, type SavedSummary } from "@/lib/onboarding";

/* ---------- rules (shared with the server in lib/onboarding.ts) ---------- */

let zoneCache: string[] | null = null;
function zones(): string[] {
  if (zoneCache) return zoneCache;
  try {
    zoneCache = Intl.supportedValuesOf("timeZone");
  } catch {
    zoneCache = ["America/Chicago", "America/New_York", "America/Denver", "America/Los_Angeles", "UTC"];
  }
  return zoneCache;
}
const NO_ZONES: string[] = [];
const noSubscribe = () => () => {};

const schema = onboardingSchema;
type Values = OnboardingValues;

const STEP_FIELDS: (keyof Values)[][] = [
  ["name", "phone", "timezone", "dateOfBirth", "heightFt", "heightIn", "weightLb"],
  ["familyPhone"],
  ["medicines"],
];

const newMedicine = (): Values["medicines"][number] => ({
  name: "",
  dosage: "",
  times: [{ value: "08:00" }],
  startDate: today(),
  endDate: "",
  afterMeal: "",
});

/* ---------- small parts ---------- */

const inputClass =
  "mt-2 block w-full min-h-12 rounded-md border-2 border-glaze/60 bg-white/70 px-4 text-[1.1rem] text-glaze " +
  "focus:border-aegean focus:outline-none focus-visible:outline-none focus:ring-[3px] focus:ring-aegean/30 aria-[invalid=true]:border-red";

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-bold">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[1rem] text-ink">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-2 text-red-deep" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = (id: string, hint?: boolean, error?: string) =>
  [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;

function TimesEditor({
  index,
  control,
  register,
  errors,
}: {
  index: number;
  control: Control<Values>;
  register: UseFormRegister<Values>;
  errors?: FieldErrors<Values["medicines"][number]>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: `medicines.${index}.times` });
  return (
    <fieldset>
      <legend className="font-bold">Reminder times</legend>
      <p className="mt-1 text-[1rem] text-ink">In their time zone. Argos calls at each one.</p>
      <ul className="mt-2 flex flex-col gap-2">
        {fields.map((f, t) => {
          const id = `med-${index}-time-${t}`;
          const err = errors?.times?.[t]?.value?.message;
          return (
            <li key={f.id}>
              <div className="flex items-center gap-2">
                <label htmlFor={id} className="sr-only">
                  Time {t + 1}
                </label>
                <input
                  id={id}
                  type="time"
                  className={`${inputClass} mt-0 max-w-[12rem]`}
                  aria-invalid={err ? true : undefined}
                  aria-describedby={err ? `${id}-error` : undefined}
                  {...register(`medicines.${index}.times.${t}.value`)}
                />
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(t)}
                    className="min-h-12 px-3 text-aegean-deep underline underline-offset-4"
                  >
                    Remove<span className="sr-only"> time {t + 1}</span>
                  </button>
                )}
              </div>
              {err && (
                <p id={`${id}-error`} className="mt-1 text-red-deep" role="alert">
                  {err}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {errors?.times?.message && <p className="mt-2 text-red-deep">{errors.times.message}</p>}
      <button
        type="button"
        onClick={() => append({ value: "" })}
        className="mt-2 min-h-12 font-bold text-aegean-deep underline underline-offset-4"
      >
        + Add another time
      </button>
    </fieldset>
  );
}

function MealChoice({
  index,
  register,
  error,
}: {
  index: number;
  register: UseFormRegister<Values>;
  error?: string;
}) {
  const name = `medicines.${index}.afterMeal` as const;
  const errId = `med-${index}-meal-error`;
  return (
    <fieldset aria-describedby={error ? errId : undefined}>
      <legend className="font-bold">Is it taken after a meal?</legend>
      <p className="mt-1 text-[1rem] text-ink">Yes means it is taken after eating. No means before eating.</p>
      <div className="mt-2 grid gap-3 sm:max-w-[30rem] sm:grid-cols-2">
        {(
          [
            ["Yes", "Yes", "After a meal"],
            ["No", "No", "Before a meal"],
          ] as const
        ).map(([value, label, detail]) => (
          <label
            key={value}
            className={
              "flex min-h-[4.25rem] cursor-pointer items-center gap-3 rounded-md border-2 border-glaze/60 bg-white/70 px-4 " +
              "has-[:checked]:border-terracotta-deep has-[:checked]:bg-terracotta-deep/10 " +
              "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-aegean/40 " +
              (error ? "border-red" : "")
            }
          >
            <input type="radio" value={value} className="h-6 w-6 shrink-0 accent-[#a84a25]" {...register(name)} />
            <span className="leading-tight">
              <span className="font-bold">{label}</span>
              <span className="text-ink">, {detail.toLowerCase()}</span>
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id={errId} className="mt-2 text-red-deep" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/* ---------- the form ---------- */

type Saved = SavedSummary;

export function OnboardingForm({ enabled }: { enabled: boolean }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Empty on the server: the server and the browser can ship different time-zone lists.
  const zoneList = useSyncExternalStore(noSubscribe, zones, () => NO_ZONES);

  const {
    register,
    control,
    handleSubmit,
    trigger,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      phone: "",
      timezone: "",
      dateOfBirth: "",
      heightFt: "",
      heightIn: "",
      weightLb: "",
      familyPhone: "",
      // startDate is filled after mount: reading the clock during prerender would freeze it.
      medicines: [{ name: "", dosage: "", times: [{ value: "08:00" }], startDate: "", endDate: "", afterMeal: "" }],
    },
  });
  const medicines = useFieldArray({ control, name: "medicines" });

  // Default to the browser's time zone, set after mount so server and client markup match.
  useEffect(() => {
    if (!getValues("timezone")) setValue("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (!getValues("medicines.0.startDate")) setValue("medicines.0.startDate", today());
  }, [getValues, setValue]);

  // Move focus to the new step's heading so screen readers announce it; never on first load.
  const shown = useRef({ step, saved: false });
  useEffect(() => {
    const isDone = saved !== null;
    if (shown.current.step === step && shown.current.saved === isDone) return;
    shown.current = { step, saved: isDone };
    headingRef.current?.focus();
  }, [step, saved]);

  async function next() {
    if (await trigger(STEP_FIELDS[step])) setStep((s) => s + 1);
  }

  async function save(values: Values) {
    setServerError(null);
    if (!enabled) {
      setServerError("Saving is not connected yet: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are missing from web/.env.local.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await res.json().catch(() => ({}))) as Partial<SavedSummary> & { error?: string };
      if (!res.ok || !body.userId) {
        setServerError(`${body.error ?? `The server answered ${res.status}.`} Your answers are still here; try again.`);
        return;
      }
      setSaved(body as SavedSummary);
    } catch {
      setServerError("Could not reach the server. Check your connection; your answers are still here.");
    } finally {
      setSaving(false);
    }
  }

  const card = "relative border-2 border-gold bg-cream text-glaze";

  if (saved) {
    return (
      <section className={card}>
        <div className="meander mx-2 mt-2" aria-hidden="true" />
        <div className="px-6 pb-9 pt-7 md:px-10">
          <h1 ref={headingRef} tabIndex={-1} className="text-[2rem] leading-tight focus:outline-none focus-visible:outline-none md:text-[2.4rem]">
            Argos is on watch
          </h1>
          <p className="mt-2 text-ink">
            The ship has reached Ithaca. Argos will FaceTime {saved.name} at each time below
            {saved.family ? `, and call ${saved.family} if something is wrong.` : "."}
          </p>
          <ul className="mt-6 flex flex-col gap-4">
            {saved.medicines.map((m) => (
              <li key={m.name} className="border-t-2 border-glaze/20 pt-4">
                <p className="text-[1.15rem] font-bold">{m.name}</p>
                <p className="text-ink">
                  {m.dosage} · {m.afterMeal ? "After a meal" : "Before a meal"}
                </p>
                <ul className="mt-2 flex flex-wrap gap-2" aria-label={`Reminder times for ${m.name}`}>
                  {m.times.map((t) => (
                    <li key={t} className="rounded-full border-2 border-glaze/30 px-3 py-1 font-bold tabular-nums">
                      {t}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-[1rem] text-ink">
            Reference number: <span className="break-all font-bold text-glaze">{saved.userId}</span>
          </p>
          <Link href="/" className={buttonClass("secondary", "mt-8")}>
            Back to the start
          </Link>
        </div>
        <div className="meander mx-2 mb-2" aria-hidden="true" />
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit(save)} noValidate>
      <Voyage step={step} />

      <section className={`${card} mt-6`}>
        <div className="meander mx-2 mt-2" aria-hidden="true" />
        <div className="px-6 pb-9 pt-7 md:px-10">
          {step === 0 && (
            <>
              <h1 ref={headingRef} tabIndex={-1} className="text-[1.9rem] leading-tight focus:outline-none focus-visible:outline-none md:text-[2.3rem]">
                Who Argos watches over
              </h1>
              <p className="mt-2 text-ink">The person who will get the calls. Argos will greet them by name.</p>
              <div className="mt-8 flex flex-col gap-6">
                <Field id="name" label="Their name" error={errors.name?.message}>
                  <input
                    id="name"
                    autoComplete="off"
                    className={inputClass}
                    aria-invalid={errors.name ? true : undefined}
                    aria-describedby={describedBy("name", false, errors.name?.message)}
                    {...register("name")}
                  />
                </Field>
                <Field
                  id="phone"
                  label="Their iPhone number"
                  hint="Argos places a FaceTime call to this number. US numbers can be typed as usual."
                  error={errors.phone?.message}
                >
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    className={inputClass}
                    aria-invalid={errors.phone ? true : undefined}
                    aria-describedby={describedBy("phone", true, errors.phone?.message)}
                    {...register("phone")}
                  />
                </Field>
                <Field
                  id="timezone"
                  label="Their time zone"
                  hint="Reminder times follow this clock. Start typing a city, like Chicago."
                  error={errors.timezone?.message}
                >
                  <input
                    id="timezone"
                    list="timezone-list"
                    autoComplete="off"
                    className={inputClass}
                    aria-invalid={errors.timezone ? true : undefined}
                    aria-describedby={describedBy("timezone", true, errors.timezone?.message)}
                    {...register("timezone")}
                  />
                  <datalist id="timezone-list">
                    {zoneList.map((z) => (
                      <option key={z} value={z} />
                    ))}
                  </datalist>
                </Field>
                <Field id="dateOfBirth" label="Date of birth (optional)" error={errors.dateOfBirth?.message}>
                  <input
                    id="dateOfBirth"
                    type="date"
                    className={`${inputClass} max-w-[16rem]`}
                    aria-invalid={errors.dateOfBirth ? true : undefined}
                    aria-describedby={describedBy("dateOfBirth", false, errors.dateOfBirth?.message)}
                    {...register("dateOfBirth")}
                  />
                </Field>
                <fieldset>
                  <legend className="font-bold">Height and weight (optional)</legend>
                  <div className="mt-2 grid max-w-[24rem] grid-cols-3 gap-3">
                    {(
                      [
                        ["heightFt", "Feet"],
                        ["heightIn", "Inches"],
                        ["weightLb", "Pounds"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key}>
                        <label htmlFor={key} className="block text-[1rem]">
                          {label}
                        </label>
                        <input
                          id={key}
                          inputMode="decimal"
                          className={`${inputClass} mt-1`}
                          aria-invalid={errors[key] ? true : undefined}
                          {...register(key)}
                        />
                      </div>
                    ))}
                  </div>
                  {(["heightFt", "heightIn", "weightLb"] as const).map(
                    (k) =>
                      errors[k] && (
                        <p key={k} className="mt-2 text-red-deep" role="alert">
                          {errors[k]?.message}
                        </p>
                      ),
                  )}
                </fieldset>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 ref={headingRef} tabIndex={-1} className="text-[1.9rem] leading-tight focus:outline-none focus-visible:outline-none md:text-[2.3rem]">
                Family contact
              </h1>
              <p className="mt-2 text-ink">Who should Argos call if a dose is missed or something seems wrong?</p>
              <div className="mt-8">
                <Field
                  id="familyPhone"
                  label="Family phone number (optional)"
                  hint="Usually yours. You can add it later."
                  error={errors.familyPhone?.message}
                >
                  <input
                    id="familyPhone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className={inputClass}
                    aria-invalid={errors.familyPhone ? true : undefined}
                    aria-describedby={describedBy("familyPhone", true, errors.familyPhone?.message)}
                    {...register("familyPhone")}
                  />
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 ref={headingRef} tabIndex={-1} className="text-[1.9rem] leading-tight focus:outline-none focus-visible:outline-none md:text-[2.3rem]">
                Medicines
              </h1>
              <p className="mt-2 text-ink">The remedies Argos guards each day. Add each one with the times it is taken.</p>
              <ol className="mt-8 flex flex-col gap-8">
                {medicines.fields.map((f, i) => {
                  const e = errors.medicines?.[i];
                  return (
                    <li key={f.id} className="border-t-2 border-glaze pt-6">
                      <div className="flex items-baseline justify-between gap-4">
                        <h2 className="font-sans text-[1.2rem] font-bold tracking-normal">Medicine {i + 1}</h2>
                        {medicines.fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => medicines.remove(i)}
                            className="min-h-12 text-aegean-deep underline underline-offset-4"
                          >
                            Remove<span className="sr-only"> medicine {i + 1}</span>
                          </button>
                        )}
                      </div>
                      <div className="mt-4 flex flex-col gap-6">
                        <Field id={`med-${i}-name`} label="Name" error={e?.name?.message}>
                          <input
                            id={`med-${i}-name`}
                            className={inputClass}
                            aria-invalid={e?.name ? true : undefined}
                            aria-describedby={describedBy(`med-${i}-name`, false, e?.name?.message)}
                            {...register(`medicines.${i}.name`)}
                          />
                        </Field>
                        <Field id={`med-${i}-dosage`} label="Dosage" hint="For example: 1 tablet, 500 mg." error={e?.dosage?.message}>
                          <input
                            id={`med-${i}-dosage`}
                            className={inputClass}
                            aria-invalid={e?.dosage ? true : undefined}
                            aria-describedby={describedBy(`med-${i}-dosage`, true, e?.dosage?.message)}
                            {...register(`medicines.${i}.dosage`)}
                          />
                        </Field>
                        <MealChoice index={i} register={register} error={e?.afterMeal?.message} />
                        <TimesEditor index={i} control={control} register={register} errors={e} />
                        <div className="grid gap-6 sm:grid-cols-2">
                          <Field id={`med-${i}-start`} label="Start date" error={e?.startDate?.message}>
                            <input
                              id={`med-${i}-start`}
                              type="date"
                              className={inputClass}
                              aria-invalid={e?.startDate ? true : undefined}
                              {...register(`medicines.${i}.startDate`)}
                            />
                          </Field>
                          <Field id={`med-${i}-end`} label="End date (optional)" error={e?.endDate?.message}>
                            <input
                              id={`med-${i}-end`}
                              type="date"
                              className={inputClass}
                              aria-invalid={e?.endDate ? true : undefined}
                              aria-describedby={describedBy(`med-${i}-end`, false, e?.endDate?.message)}
                              {...register(`medicines.${i}.endDate`)}
                            />
                          </Field>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <button
                type="button"
                onClick={() => medicines.append(newMedicine())}
                className={buttonClass("secondary", "mt-8 w-full sm:w-auto")}
              >
                + Add medicine
              </button>
            </>
          )}

          {serverError && (
            <div role="alert" className="mt-8 border-2 border-red bg-red/10 p-4 text-red-deep">
              {serverError}
            </div>
          )}

          <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            {step > 0 ? (
              <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : (
              <Link href="/" className={buttonClass("quiet")}>
                Cancel
              </Link>
            )}
            {step < 2 ? (
              <Button type="button" onClick={next}>
                Continue
              </Button>
            ) : (
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save and finish"}
              </Button>
            )}
          </div>
        </div>
        <div className="meander mx-2 mb-2" aria-hidden="true" />
      </section>
    </form>
  );
}
