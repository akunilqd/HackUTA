import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionForm, AddPanel, Editable } from "@/components/dashboard/ActionForm";
import { Badge, cardClass, Facts, Field, inputClass } from "@/components/dashboard/Field";
import { EmptyState } from "@/components/EmptyState";
import { deleteAppointment, saveAppointment } from "@/app/dashboard/actions";
import type { AppointmentRow, AppointmentStatus } from "@/lib/database.types";
import { APPOINTMENT_STATUS, getPatient } from "@/lib/dashboard";
import { adminClient, isMissingTable } from "@/lib/supabase/admin";
import { formatDateTime, toLocalInput } from "@/lib/zoned";

export const metadata: Metadata = { title: "Appointments" };

type Props = PageProps<"/dashboard/[patientId]/appointments">;

export default function AppointmentsPage({ params }: Props) {
  return (
    <Suspense fallback={<div className={`${cardClass} h-64`} aria-busy="true" />}>
      <Appointments params={params} />
    </Suspense>
  );
}

async function Appointments({ params }: Pick<Props, "params">) {
  await connection();
  const { patientId } = await params;
  const patient = await getPatient(patientId);
  const { data, error } = await adminClient()
    .from("doctor_appointments")
    .select("*")
    .eq("user_id", patient.id)
    .order("scheduled_at", { ascending: true });

  if (isMissingTable(error)) {
    return (
      <EmptyState
        title="The appointments table is not in Supabase yet"
        body="Run supabase/005_doctor_appointments.sql in the Supabase SQL editor, then reload this page."
      />
    );
  }
  if (error) return <EmptyState title="Could not load the appointments" body={error.message} />;

  const now = new Date().getTime();
  const upcoming = data.filter((a) => new Date(a.scheduled_at).getTime() >= now && a.status === "scheduled");
  const past = data.filter((a) => !upcoming.includes(a)).reverse();
  const zone = patient.timezone;

  const list = (items: AppointmentRow[]) => (
    <ul className="flex flex-col gap-4">
      {items.map((a) => (
        <li key={a.id} className={cardClass}>
          <Editable
            view={<AppointmentView a={a} zone={zone} />}
            form={<AppointmentForms patientId={patient.id} zone={zone} a={a} />}
            title={`appointment with ${a.doctor_name}`}
          />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="upcoming-heading" className="flex flex-col gap-4">
        <h2 id="upcoming-heading" className="text-[1.5rem]">
          Upcoming appointments
        </h2>
        {upcoming.length ? list(upcoming) : <EmptyState title="Nothing scheduled" body={`Add ${patient.name}'s next doctor visit below.`} />}
      </section>

      <AddPanel label="Add an appointment">
        <AppointmentForms patientId={patient.id} zone={zone} />
      </AddPanel>

      {past.length > 0 && (
        <section aria-labelledby="past-heading" className="flex flex-col gap-4">
          <h2 id="past-heading" className="text-[1.5rem]">
            Past and cancelled
          </h2>
          {list(past)}
        </section>
      )}
    </div>
  );
}

function AppointmentView({ a, zone }: { a: AppointmentRow; zone: string }) {
  const s = APPOINTMENT_STATUS[a.status] ?? { label: a.status, tone: "quiet" as const };
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-[1.3rem] font-bold">{a.doctor_name}</h3>
        <Badge tone={s.tone}>{s.label}</Badge>
      </div>
      <p className="mt-1 font-bold text-terracotta-deep">{formatDateTime(a.scheduled_at, zone)}</p>
      <div className="mt-4">
        <Facts
          items={[
            ["Specialty", a.specialty],
            ["Where", a.location],
          ]}
        />
      </div>
      {a.notes && <p className="mt-4 whitespace-pre-line border-l-4 border-gold pl-4 text-ink">{a.notes}</p>}
    </>
  );
}

function AppointmentForms({ patientId, zone, a }: { patientId: string; zone: string; a?: AppointmentRow }) {
  const id = a?.id ?? "new-appt";
  return (
    <>
      <ActionForm
        action={saveAppointment}
        hidden={{ patientId, ...(a ? { appointmentId: a.id } : {}) }}
        submitLabel={a ? "Save appointment" : "Add appointment"}
        resetOnSuccess={!a}
      >
        <div className="flex flex-col gap-6">
          <Field id={`${id}-doctor`} label="Doctor">
            <input id={`${id}-doctor`} name="doctorName" required maxLength={120} defaultValue={a?.doctor_name} placeholder="Dr. Nguyen" className={inputClass} />
          </Field>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field id={`${id}-when`} label="Date and time" hint={`On the patient's clock (${zone}).`}>
              <input
                id={`${id}-when`}
                name="scheduledAt"
                type="datetime-local"
                required
                defaultValue={a ? toLocalInput(a.scheduled_at, zone) : ""}
                className={inputClass}
              />
            </Field>
            <Field id={`${id}-status`} label="Status">
              <select id={`${id}-status`} name="status" defaultValue={a?.status ?? "scheduled"} className={inputClass}>
                {(Object.keys(APPOINTMENT_STATUS) as AppointmentStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {APPOINTMENT_STATUS[k].label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field id={`${id}-specialty`} label="Specialty (optional)">
              <input id={`${id}-specialty`} name="specialty" maxLength={120} defaultValue={a?.specialty ?? ""} placeholder="Cardiology" className={inputClass} />
            </Field>
            <Field id={`${id}-location`} label="Where (optional)">
              <input id={`${id}-location`} name="location" maxLength={240} defaultValue={a?.location ?? ""} placeholder="Clinic name or address" className={inputClass} />
            </Field>
          </div>
          <Field id={`${id}-notes`} label="Notes (optional)" hint="What to bring, fasting, questions to ask.">
            <textarea id={`${id}-notes`} name="notes" rows={3} maxLength={2000} defaultValue={a?.notes ?? ""} className={`${inputClass} py-3`} />
          </Field>
        </div>
      </ActionForm>
      {a && (
        <ActionForm
          action={deleteAppointment}
          hidden={{ patientId, appointmentId: a.id }}
          submitLabel="Delete appointment"
          pendingLabel="Deleting…"
          variant="quiet"
          confirm={`Delete the appointment with ${a.doctor_name}?`}
          className="mt-6 border-t-2 border-glaze/15 pt-4"
        />
      )}
    </>
  );
}
