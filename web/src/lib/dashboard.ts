import { notFound } from "next/navigation";
import { cache } from "react";
import type { AppointmentStatus, DoseStatus } from "@/lib/database.types";
import type { Tone } from "@/components/dashboard/Field";
import { adminClient, isUuid } from "@/lib/supabase/admin";

/** One patient per request, shared by the layout header and the page (React.cache dedupes the query). */
export const getPatient = cache(async (patientId: string) => {
  if (!isUuid(patientId)) notFound();
  const { data, error } = await adminClient().from("users").select("*").eq("id", patientId).maybeSingle();
  if (error) throw new Error(`Could not load the patient: ${error.message}`);
  if (!data) notFound();
  return data;
});

export const DOSE_STATUS: Record<DoseStatus, { label: string; tone: Tone }> = {
  taken: { label: "Taken", tone: "good" },
  pending: { label: "Waiting", tone: "info" },
  calling: { label: "Calling now", tone: "info" },
  unconfirmed: { label: "Not confirmed", tone: "warn" },
  missed_no_answer: { label: "No answer", tone: "bad" },
  missed: { label: "Missed", tone: "bad" },
  wrong_medication_flagged: { label: "Wrong bottle", tone: "bad" },
  skipped: { label: "Skipped", tone: "quiet" },
};

export const APPOINTMENT_STATUS: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "Scheduled", tone: "info" },
  completed: { label: "Completed", tone: "good" },
  cancelled: { label: "Cancelled", tone: "quiet" },
  missed: { label: "Missed", tone: "bad" },
};

/** Height and weight are stored metric; families typed them in ft/in and lb, so show them back that way. */
export function imperial(heightCm: number | null, weightKg: number | null) {
  let ft = "";
  let inch = "";
  if (heightCm) {
    const totalIn = Math.round(heightCm / 2.54);
    ft = String(Math.floor(totalIn / 12));
    inch = String(totalIn % 12);
  }
  const lb = weightKg ? String(Math.round(weightKg / 0.45359237)) : "";
  return { ft, inch, lb };
}

export function ageFrom(dateOfBirth: string | null, todayIso: string) {
  if (!dateOfBirth) return null;
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}
