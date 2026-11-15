import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionForm, AddPanel, Editable } from "@/components/dashboard/ActionForm";
import { Badge, cardClass, Field, inputClass } from "@/components/dashboard/Field";
import { EmptyState } from "@/components/EmptyState";
import { addDose, deleteDose, saveDose } from "@/app/dashboard/actions";
import type { DoseStatus } from "@/lib/database.types";
import { DOSE_STATUS, getPatient } from "@/lib/dashboard";
import { adminClient } from "@/lib/supabase/admin";
import { formatDay, formatTime, toLocalInput, zonedParts } from "@/lib/zoned";

export const metadata: Metadata = { title: "Dose history" };

const RANGES = [7, 30, 90] as const;
const MISSED: DoseStatus[] = ["missed", "missed_no_answer", "wrong_medication_flagged"];
const OPEN: DoseStatus[] = ["pending", "calling"];

type Props = PageProps<"/dashboard/[patientId]/history">;

export default function HistoryPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<div className={`${cardClass} h-96`} aria-busy="true" />}>
      <History params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function History({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  await connection();
  const [{ patientId }, query] = await Promise.all([params, searchParams]);
  const days = RANGES.find((d) => String(d) === query.days) ?? 7;
  const patient = await getPatient(patientId);
  const zone = patient.timezone;
  const since = new Date(new Date().getTime() - days * 86_400_000).toISOString();

  const db = adminClient();
  const [doses, meds] = await Promise.all([
    db
      .from("dose_logs")
      .select("id, status, scheduled_at, taken_at, user_medications!inner(id, name, dosage, user_id)")
      .eq("user_medications.user_id", patient.id)
      .gte("scheduled_at", since)
      .order("scheduled_at", { ascending: false })
      .limit(1000),
    db.from("user_medications").select("id, name, dosage").eq("user_id", patient.id).order("name"),
  ]);
  if (doses.error) return <EmptyState title="Could not load the dose history" body={doses.error.message} />;

  const rows = doses.data;
  const due = rows.filter((d) => !OPEN.includes(d.status));
  const taken = due.filter((d) => d.status === "taken").length;
  const missed = due.filter((d) => MISSED.includes(d.status)).length;
  const adherence = due.length ? Math.round((taken / due.length) * 100) : null;

  const byDay = new Map<string, typeof rows>();
  for (const d of rows) {
    const day = zonedParts(new Date(d.scheduled_at), zone).day;
    byDay.set(day, [...(byDay.get(day) ?? []), d]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-[1.5rem]">Dose history</h2>
        <nav aria-label="Time range" className="flex gap-2">
          {RANGES.map((d) => (
            <Link
              key={d}
              href={`?days=${d}`}
              aria-current={d === days ? "page" : undefined}
              className={
                "inline-flex min-h-12 items-center whitespace-nowrap rounded-md border-2 px-3 font-bold no-underline md:px-4 " +
                (d === days ? "border-glaze bg-glaze text-cream" : "border-glaze/40 text-glaze hover:border-glaze")
              }
            >
              {d} days
            </Link>
          ))}
        </nav>
      </div>

      <dl className="grid grid-cols-3 gap-2 md:gap-3">
        {(
          [
            ["Adherence", adherence === null ? "–" : `${adherence}%`],
            ["Doses taken", String(taken)],
            ["Missed", String(missed)],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="border-2 border-gold/60 px-3 py-3 md:px-4 md:py-4">
            <dt className="text-[0.95rem] text-ink">{label}</dt>
            <dd className="mt-1 text-[1.5rem] font-bold tabular-nums leading-none md:text-[1.8rem]">{value}</dd>
          </div>
        ))}
      </dl>

      {rows.length === 0 && (
        <EmptyState title="Nothing logged in this period" body="Argos writes a row here for every reminder call. You can also log a dose by hand below." />
      )}

      {[...byDay].map(([day, list]) => (
        <section key={day} aria-labelledby={`day-${day}`}>
          <h3 id={`day-${day}`} className="border-b-2 border-gold/60 pb-1 text-[1.1rem] font-bold">
            {formatDay(day)}
          </h3>
          <ul className="divide-y-2 divide-glaze/10">
            {list.map((d) => {
              const s = DOSE_STATUS[d.status] ?? { label: d.status, tone: "quiet" as const };
              const med = d.user_medications;
              const view = (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="w-[5.5rem] shrink-0 font-bold tabular-nums">{formatTime(d.scheduled_at, zone)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-bold">{med.name}</span> <span className="text-ink">{med.dosage}</span>
                    {d.taken_at && <span className="block text-[0.95rem] text-ink">Taken at {formatTime(d.taken_at, zone)}</span>}
                  </span>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </div>
              );
              const form = (
                <div className="py-2">
                  <p className="font-bold">
                    {med.name}, due {formatTime(d.scheduled_at, zone)}
                  </p>
                  <ActionForm action={saveDose} hidden={{ patientId: patient.id, doseId: d.id }} submitLabel="Save dose" className="mt-4">
                    <DoseFields idPrefix={d.id} status={d.status} takenAt={d.taken_at ? toLocalInput(d.taken_at, zone) : toLocalInput(d.scheduled_at, zone)} />
                  </ActionForm>
                  <ActionForm
                    action={deleteDose}
                    hidden={{ patientId: patient.id, doseId: d.id }}
                    submitLabel="Delete this entry"
                    pendingLabel="Deleting…"
                    variant="quiet"
                    confirm="Delete this dose from the history?"
                    className="mt-4"
                  />
                </div>
              );
              return (
                <li key={d.id} className="py-3">
                  <Editable view={view} form={form} inline title={`${med.name} at ${formatTime(d.scheduled_at, zone)}`} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {(meds.data?.length ?? 0) > 0 && (
        <AddPanel label="Log a dose by hand">
          <ActionForm action={addDose} hidden={{ patientId: patient.id }} submitLabel="Log dose" resetOnSuccess>
            <div className="flex flex-col gap-6">
              <Field id="new-dose-med" label="Medicine">
                <select id="new-dose-med" name="medicationId" required className={inputClass} defaultValue="">
                  <option value="" disabled>
                    Choose a medicine
                  </option>
                  {meds.data?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.dosage})
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="new-dose-when" label="When it was due" hint={`On ${patient.name}'s clock (${zone}).`}>
                <input
                  id="new-dose-when"
                  name="scheduledAt"
                  type="datetime-local"
                  required
                  defaultValue={toLocalInput(new Date().toISOString(), zone)}
                  className={`${inputClass} max-w-[20rem]`}
                />
              </Field>
              <DoseFields idPrefix="new-dose" status="taken" takenAt={toLocalInput(new Date().toISOString(), zone)} />
            </div>
          </ActionForm>
        </AddPanel>
      )}
    </div>
  );
}

function DoseFields({ idPrefix, status, takenAt }: { idPrefix: string; status: DoseStatus; takenAt: string }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Field id={`${idPrefix}-status`} label="Status">
        <select id={`${idPrefix}-status`} name="status" defaultValue={status} className={inputClass}>
          {(Object.keys(DOSE_STATUS) as DoseStatus[]).map((k) => (
            <option key={k} value={k}>
              {DOSE_STATUS[k].label}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${idPrefix}-taken`} label="Taken at" hint="Used only when the status is Taken.">
        <input id={`${idPrefix}-taken`} name="takenAt" type="datetime-local" defaultValue={takenAt} className={inputClass} />
      </Field>
    </div>
  );
}
