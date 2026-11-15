"use server";

import { refresh } from "next/cache";
import type { AppointmentStatus, DoseStatus } from "@/lib/database.types";
import { medicineSchema, profileSchema } from "@/lib/onboarding";
import { toE164 } from "@/lib/phone";
import { adminClient, isMissingTable, isUuid } from "@/lib/supabase/admin";
import { fromLocalInput } from "@/lib/zoned";

/**
 * Every dashboard edit goes through here. There is no login (owner request), so these run with the
 * service role; each one re-checks that the row it touches belongs to the patient in the form.
 */

export type ActionState = { ok: boolean; message: string; at: number };

const done = (message: string): ActionState => {
  refresh();
  return { ok: true, message, at: Date.now() };
};
const fail = (message: string): ActionState => ({ ok: false, message, at: Date.now() });
// Browsers submit textarea line breaks as CRLF; store plain LF.
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").replace(/\r\n?/g, "\n").trim();

const DOSE_STATUSES: DoseStatus[] = [
  "pending",
  "taken",
  "missed",
  "skipped",
  "calling",
  "unconfirmed",
  "missed_no_answer",
  "wrong_medication_flagged",
];
const APPOINTMENT_STATUSES: AppointmentStatus[] = ["scheduled", "completed", "cancelled", "missed"];

async function patientZone(patientId: string): Promise<string | null> {
  const { data } = await adminClient().from("users").select("timezone").eq("id", patientId).maybeSingle();
  return data?.timezone ?? null;
}

/* ---------- patient profile ---------- */

export async function updateProfile(_: ActionState | null, fd: FormData): Promise<ActionState> {
  const patientId = text(fd, "patientId");
  if (!isUuid(patientId)) return fail("Unknown patient.");
  const parsed = profileSchema.safeParse({
    name: text(fd, "name"),
    phone: text(fd, "phone"),
    timezone: text(fd, "timezone"),
    dateOfBirth: text(fd, "dateOfBirth"),
    heightFt: text(fd, "heightFt"),
    heightIn: text(fd, "heightIn"),
    weightLb: text(fd, "weightLb"),
    familyPhone: text(fd, "familyPhone"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Some answers are not valid.");
  const v = parsed.data;
  const ft = Number(v.heightFt || 0);
  const inch = Number(v.heightIn || 0);

  const { error } = await adminClient()
    .from("users")
    .update({
      name: v.name,
      phone: toE164(v.phone),
      timezone: v.timezone,
      family_phone_number: v.familyPhone ? toE164(v.familyPhone) : null,
      date_of_birth: v.dateOfBirth || null,
      height_cm: ft || inch ? Math.round((ft * 30.48 + inch * 2.54) * 10) / 10 : null,
      weight_kg: v.weightLb ? Math.round(Number(v.weightLb) * 0.45359237 * 10) / 10 : null,
    })
    .eq("id", patientId);
  if (error) return fail(`Could not save the profile (${error.message}).`);
  return done("Profile saved.");
}

/* ---------- prescriptions (user_medications) ---------- */

export async function saveMedication(_: ActionState | null, fd: FormData): Promise<ActionState> {
  const patientId = text(fd, "patientId");
  const medicationId = text(fd, "medicationId");
  if (!isUuid(patientId)) return fail("Unknown patient.");
  if (medicationId && !isUuid(medicationId)) return fail("Unknown medicine.");

  const parsed = medicineSchema.safeParse({
    name: text(fd, "name"),
    dosage: text(fd, "dosage"),
    times: fd.getAll("times").map((t) => ({ value: String(t) })),
    startDate: text(fd, "startDate"),
    endDate: text(fd, "endDate"),
    afterMeal: text(fd, "afterMeal"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Some answers are not valid.");
  const m = parsed.data;
  const row = {
    name: m.name,
    dosage: m.dosage,
    reminder_times: [...new Set(m.times.map((t) => t.value))].sort(),
    start_date: m.startDate,
    end_date: m.endDate || null,
    after_meal: m.afterMeal,
  };

  const db = adminClient();
  if (medicationId) {
    const { data, error } = await db.from("user_medications").update(row).eq("id", medicationId).eq("user_id", patientId).select("id");
    if (error) return fail(`Could not save the medicine (${error.message}).`);
    if (!data?.length) return fail("This medicine no longer exists.");
    return done(`${m.name} saved.`);
  }
  const { error } = await db.from("user_medications").insert({ ...row, user_id: patientId });
  if (error) return fail(`Could not add the medicine (${error.message}).`);
  return done(`${m.name} added. Argos will call at ${row.reminder_times.join(", ")}.`);
}

export async function deleteMedication(_: ActionState | null, fd: FormData): Promise<ActionState> {
  const patientId = text(fd, "patientId");
  const medicationId = text(fd, "medicationId");
  if (!isUuid(patientId) || !isUuid(medicationId)) return fail("Unknown medicine.");
  const { error } = await adminClient().from("user_medications").delete().eq("id", medicationId).eq("user_id", patientId);
  if (error?.code === "23503") {
    return fail("This medicine has dose history, so it cannot be deleted. Set an end date instead to stop the calls.");
  }
  if (error) return fail(`Could not delete the medicine (${error.message}).`);
  return done("Medicine deleted.");
}

/* ---------- dose history (dose_logs) ---------- */

/** dose_logs_check: taken_at may be set only when status is 'taken'. */
function takenAtFor(status: DoseStatus, takenInput: string, scheduledAt: string, zone: string) {
  if (status !== "taken") return null;
  return (fromLocalInput(takenInput, zone) ?? new Date(scheduledAt)).toISOString();
}

async function doseOfPatient(doseId: string, patientId: string) {
  const { data } = await adminClient()
    .from("dose_logs")
    .select("id, scheduled_at, user_medications!inner(user_id)")
    .eq("id", doseId)
    .eq("user_medications.user_id", patientId)
    .maybeSingle();
  return data;
}

export async function saveDose(_: ActionState | null, fd: FormData): Promise<ActionState> {
  const patientId = text(fd, "patientId");
  const doseId = text(fd, "doseId");
  const status = text(fd, "status") as DoseStatus;
  if (!isUuid(patientId) || !isUuid(doseId)) return fail("Unknown dose.");
  if (!DOSE_STATUSES.includes(status)) return fail("Choose a status.");
  const [dose, zone] = await Promise.all([doseOfPatient(doseId, patientId), patientZone(patientId)]);
  if (!dose || !zone) return fail("This dose no longer exists.");

  const { error } = await adminClient()
    .from("dose_logs")
    .update({ status, taken_at: takenAtFor(status, text(fd, "takenAt"), dose.scheduled_at, zone) })
    .eq("id", doseId);
  if (error) return fail(`Could not save the dose (${error.message}).`);
  return done("Dose updated.");
}

export async function addDose(_: ActionState | null, fd: FormData): Promise<ActionState> {
  const patientId = text(fd, "patientId");
  const medicationId = text(fd, "medicationId");
  const status = text(fd, "status") as DoseStatus;
  if (!isUuid(patientId)) return fail("Unknown patient.");
  if (!isUuid(medicationId)) return fail("Choose a medicine.");
  if (!DOSE_STATUSES.includes(status)) return fail("Choose a status.");
  const zone = await patientZone(patientId);
  if (!zone) return fail("Unknown patient.");
  const scheduled = fromLocalInput(text(fd, "scheduledAt"), zone);
  if (!scheduled) return fail("Choose when the dose was due.");

  const db = adminClient();
  const { data: med } = await db.from("user_medications").select("id").eq("id", medicationId).eq("user_id", patientId).maybeSingle();
  if (!med) return fail("Choose one of this patient's medicines.");

  const scheduledAt = scheduled.toISOString();
  const { error } = await db.from("dose_logs").insert({
    medication_id: medicationId,
    scheduled_at: scheduledAt,
    status,
    taken_at: takenAtFor(status, text(fd, "takenAt"), scheduledAt, zone),
  });
  if (error?.code === "23505") return fail("A dose of this medicine is already logged at that time. Edit that entry instead.");
  if (error) return fail(`Could not log the dose (${error.message}).`);
  return done("Dose logged.");
}

export async function deleteDose(_: ActionState | null, fd: FormData): Promise<ActionState> {
  const patientId = text(fd, "patientId");
  const doseId = text(fd, "doseId");
  if (!isUuid(patientId) || !isUuid(doseId)) return fail("Unknown dose.");
  if (!(await doseOfPatient(doseId, patientId))) return fail("This dose no longer exists.");
  const { error } = await adminClient().from("dose_logs").delete().eq("id", doseId);
  if (error) return fail(`Could not delete the dose (${error.message}).`);
  return done("Dose deleted.");
}

/* ---------- doctor appointments ---------- */

export async function saveAppointment(_: ActionState | null, fd: FormData): Promise<ActionState> {
  const patientId = text(fd, "patientId");
  const appointmentId = text(fd, "appointmentId");
  const status = (text(fd, "status") || "scheduled") as AppointmentStatus;
  if (!isUuid(patientId)) return fail("Unknown patient.");
  if (appointmentId && !isUuid(appointmentId)) return fail("Unknown appointment.");
  if (!APPOINTMENT_STATUSES.includes(status)) return fail("Choose a status.");

  const doctorName = text(fd, "doctorName");
  if (!doctorName) return fail("Enter the doctor's name.");
  if (doctorName.length > 120) return fail("The doctor's name is too long.");
  const zone = await patientZone(patientId);
  if (!zone) return fail("Unknown patient.");
  const when = fromLocalInput(text(fd, "scheduledAt"), zone);
  if (!when) return fail("Choose the date and time of the appointment.");

  const row = {
    doctor_name: doctorName,
    specialty: text(fd, "specialty").slice(0, 120) || null,
    location: text(fd, "location").slice(0, 240) || null,
    scheduled_at: when.toISOString(),
    status,
    notes: text(fd, "notes").slice(0, 2000) || null,
    doctor_instructions: text(fd, "doctorInstructions").slice(0, 4000) || null,
  };

  const db = adminClient();
  if (appointmentId) {
    const { data, error } = await db.from("doctor_appointments").update(row).eq("id", appointmentId).eq("user_id", patientId).select("id");
    if (isMissingTable(error)) return fail("Run supabase/005_doctor_appointments.sql first.");
    if (error) return fail(`Could not save the appointment (${error.message}).`);
    if (!data?.length) return fail("This appointment no longer exists.");
    return done("Appointment saved.");
  }
  const { error } = await db.from("doctor_appointments").insert({ ...row, user_id: patientId });
  if (isMissingTable(error)) return fail("Run supabase/005_doctor_appointments.sql first.");
  if (error) return fail(`Could not add the appointment (${error.message}).`);
  return done(`Appointment with ${doctorName} added.`);
}

export async function deleteAppointment(_: ActionState | null, fd: FormData): Promise<ActionState> {
  const patientId = text(fd, "patientId");
  const appointmentId = text(fd, "appointmentId");
  if (!isUuid(patientId) || !isUuid(appointmentId)) return fail("Unknown appointment.");
  const { error } = await adminClient().from("doctor_appointments").delete().eq("id", appointmentId).eq("user_id", patientId);
  if (error) return fail(`Could not delete the appointment (${error.message}).`);
  return done("Appointment deleted.");
}
