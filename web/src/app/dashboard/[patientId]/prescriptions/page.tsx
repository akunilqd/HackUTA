import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionForm, AddPanel, Editable, TimesField } from "@/components/dashboard/ActionForm";
import { Badge, cardClass, Facts, Field, inputClass, MealField } from "@/components/dashboard/Field";
import { EmptyState } from "@/components/EmptyState";
import { deleteMedication, saveMedication } from "@/app/dashboard/actions";
import type { MedicationRow } from "@/lib/database.types";
import { getPatient } from "@/lib/dashboard";
import { adminClient } from "@/lib/supabase/admin";
import { formatClock, formatDay, zonedParts } from "@/lib/zoned";

export const metadata: Metadata = { title: "Prescriptions" };

export default function PrescriptionsPage({ params }: PageProps<"/dashboard/[patientId]/prescriptions">) {
  return (
    <Suspense fallback={<div className={`${cardClass} h-64`} aria-busy="true" />}>
      <Prescriptions params={params} />
    </Suspense>
  );
}

async function Prescriptions({ params }: { params: PageProps<"/dashboard/[patientId]/prescriptions">["params"] }) {
  await connection();
  const { patientId } = await params;
  const patient = await getPatient(patientId);
  const { data: meds, error } = await adminClient()
    .from("user_medications")
    .select("*")
    .eq("user_id", patient.id)
    .order("start_date", { ascending: false })
    .order("name");
  if (error) return <EmptyState title="Could not load the prescriptions" body={error.message} />;

  const today = zonedParts(new Date(), patient.timezone).day;
  const isActive = (m: MedicationRow) => m.start_date <= today && (!m.end_date || m.end_date >= today);
  const sorted = [...meds].sort((a, b) => Number(isActive(b)) - Number(isActive(a)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[1.5rem]">Prescriptions</h2>
        <p className="text-ink">
          {meds.filter(isActive).length} active of {meds.length}
        </p>
      </div>

      {sorted.length === 0 && <EmptyState title="No medicines yet" body="Add the first one below. Argos starts calling at its reminder times." />}

      <ul className="flex flex-col gap-4">
        {sorted.map((m) => {
          const active = isActive(m);
          const upcoming = m.start_date > today;
          const view = (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-[1.3rem] font-bold">{m.name}</h3>
                <Badge tone={active ? "good" : upcoming ? "info" : "quiet"}>{active ? "Active" : upcoming ? "Starts later" : "Ended"}</Badge>
              </div>
              <p className="mt-1 text-ink">{m.dosage}</p>
              <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Reminder times for ${m.name}`}>
                {m.reminder_times.map((t) => (
                  <li key={t} className="rounded-full border-2 border-glaze/30 px-3 py-1 font-bold tabular-nums">
                    {formatClock(t)}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Facts
                  items={[
                    ["Meal", m.after_meal === "Yes" ? "After a meal" : "Before a meal"],
                    ["Course", `${formatDay(m.start_date)} → ${m.end_date ? formatDay(m.end_date) : "ongoing"}`],
                  ]}
                />
              </div>
            </>
          );
          return (
            <li key={m.id} className={cardClass}>
              <Editable view={view} form={<MedicineForms patientId={patient.id} med={m} />} title={m.name} />
            </li>
          );
        })}
      </ul>

      <AddPanel label="Add a medicine">
        <MedicineForms patientId={patient.id} today={today} />
      </AddPanel>
    </div>
  );
}

function MedicineForms({ patientId, med, today }: { patientId: string; med?: MedicationRow; today?: string }) {
  const id = med?.id ?? "new";
  return (
    <>
      <ActionForm
        action={saveMedication}
        hidden={{ patientId, ...(med ? { medicationId: med.id } : {}) }}
        submitLabel={med ? "Save medicine" : "Add medicine"}
        resetOnSuccess={!med}
      >
        <div className="flex flex-col gap-6">
          <Field id={`${id}-name`} label="Medicine name">
            <input id={`${id}-name`} name="name" required defaultValue={med?.name} className={inputClass} autoComplete="off" />
          </Field>
          <Field id={`${id}-dosage`} label="Dose" hint="Like 1 tablet, 500 mg.">
            <input id={`${id}-dosage`} name="dosage" required defaultValue={med?.dosage} className={inputClass} autoComplete="off" />
          </Field>
          <TimesField idPrefix={id} initial={(med?.reminder_times ?? []).map((t) => t.slice(0, 5))} />
          <MealField name="afterMeal" defaultValue={med?.after_meal} />
          <div className="grid gap-6 sm:grid-cols-2">
            <Field id={`${id}-start`} label="Start date">
              <input id={`${id}-start`} name="startDate" type="date" required defaultValue={med?.start_date ?? today} className={inputClass} />
            </Field>
            <Field id={`${id}-end`} label="End date (optional)" hint="Leave empty if it is ongoing.">
              <input id={`${id}-end`} name="endDate" type="date" defaultValue={med?.end_date ?? ""} className={inputClass} />
            </Field>
          </div>
        </div>
      </ActionForm>
      {med && (
        <ActionForm
          action={deleteMedication}
          hidden={{ patientId, medicationId: med.id }}
          submitLabel={`Delete ${med.name}`}
          pendingLabel="Deleting…"
          variant="quiet"
          confirm={`Delete ${med.name}? Argos will stop calling about it.`}
          className="mt-6 border-t-2 border-glaze/15 pt-4"
        />
      )}
    </>
  );
}
