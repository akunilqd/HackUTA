import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { onboardingSchema, type SavedSummary } from "@/lib/onboarding";
import { formatPhone, toE164 } from "@/lib/phone";

/**
 * Saves the onboarding form to Supabase from the server.
 *
 * Uses the same SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY as the Argos backend. These names have no
 * NEXT_PUBLIC_ prefix, so Next.js never sends them to the browser. `users.id` must reference an
 * `auth.users` row, so each family gets an auth user first (like seed.mjs does), with a generated
 * placeholder email: families never sign in.
 */
export async function POST(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "The server is not connected to Supabase yet." }, { status: 503 });
  }

  const parsed = onboardingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Some answers are not valid." }, { status: 400 });
  }
  const v = parsed.data;

  const supabase = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const auth = await supabase.auth.admin.createUser({
    email: `family-${crypto.randomUUID()}@pharmasee.local`,
    email_confirm: true,
    user_metadata: { created_by: "pharmasee-web", patient_name: v.name },
  });
  if (auth.error || !auth.data.user) {
    console.error("onboarding: createUser failed", auth.error?.message);
    return NextResponse.json({ error: "Could not create the account in Supabase." }, { status: 502 });
  }
  const userId = auth.data.user.id;
  const undo = async () => {
    await supabase.from("users").delete().eq("id", userId);
    await supabase.auth.admin.deleteUser(userId);
  };

  const ft = Number(v.heightFt || 0);
  const inch = Number(v.heightIn || 0);
  const { error: userError } = await supabase.from("users").insert({
    id: userId,
    name: v.name,
    timezone: v.timezone,
    phone: toE164(v.phone),
    family_phone_number: v.familyPhone ? toE164(v.familyPhone) : null,
    date_of_birth: v.dateOfBirth || null,
    height_cm: ft || inch ? Math.round((ft * 30.48 + inch * 2.54) * 10) / 10 : null,
    weight_kg: v.weightLb ? Math.round(Number(v.weightLb) * 0.45359237 * 10) / 10 : null,
  });
  if (userError) {
    console.error("onboarding: users insert failed", userError.message);
    await undo();
    return NextResponse.json({ error: `Could not save the person (${userError.message}).` }, { status: 502 });
  }

  const rows = v.medicines.map((m) => ({
    user_id: userId,
    name: m.name,
    dosage: m.dosage,
    reminder_times: [...new Set(m.times.map((t) => t.value))].sort(),
    start_date: m.startDate,
    end_date: m.endDate || null,
    after_meal: m.afterMeal,
  }));
  const { error: medError } = await supabase.from("user_medications").insert(rows);
  if (medError) {
    console.error("onboarding: user_medications insert failed", medError.message);
    await undo();
    return NextResponse.json({ error: `Could not save the medicines (${medError.message}).` }, { status: 502 });
  }

  const summary: SavedSummary = {
    userId,
    name: v.name,
    family: v.familyPhone ? formatPhone(toE164(v.familyPhone)) : "",
    medicines: rows.map((r) => ({ name: r.name, dosage: r.dosage, times: r.reminder_times, afterMeal: r.after_meal === "Yes" })),
  };
  return NextResponse.json(summary, { status: 201 });
}
