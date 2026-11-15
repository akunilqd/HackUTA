import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionForm, Editable } from "@/components/dashboard/ActionForm";
import { cardClass, Facts, Field, inputClass } from "@/components/dashboard/Field";
import { updateProfile } from "@/app/dashboard/actions";
import { ageFrom, getPatient, imperial } from "@/lib/dashboard";
import { formatPhone } from "@/lib/phone";
import { zonedParts } from "@/lib/zoned";

export const metadata: Metadata = { title: "Patient profile" };

export default function ProfilePage({ params }: PageProps<"/dashboard/[patientId]/profile">) {
  return (
    <Suspense fallback={<div className={`${cardClass} h-80`} aria-busy="true" />}>
      <Profile params={params} />
    </Suspense>
  );
}

async function Profile({ params }: { params: PageProps<"/dashboard/[patientId]/profile">["params"] }) {
  await connection();
  const { patientId } = await params;
  const p = await getPatient(patientId);
  const { ft, inch, lb } = imperial(p.height_cm, p.weight_kg);
  const age = ageFrom(p.date_of_birth, zonedParts(new Date(), p.timezone).day);

  const view = (
    <Facts
      items={[
        ["Name", p.name],
        ["iPhone Argos calls", p.phone ? formatPhone(p.phone) : null],
        ["Time zone", p.timezone],
        ["Date of birth", p.date_of_birth ? `${p.date_of_birth}${age !== null ? ` (age ${age})` : ""}` : null],
        ["Height", ft ? `${ft} ft ${inch} in (${p.height_cm} cm)` : null],
        ["Weight", lb ? `${lb} lb (${p.weight_kg} kg)` : null],
        ["Family contact", p.family_phone_number ? formatPhone(p.family_phone_number) : null],
        ["Reference number", <span key="id" className="break-all font-normal">{p.id}</span>],
      ]}
    />
  );

  const form = (
    <ActionForm action={updateProfile} hidden={{ patientId: p.id }} submitLabel="Save profile">
      <div className="flex flex-col gap-6">
        <Field id="name" label="Name">
          <input id="name" name="name" required maxLength={120} defaultValue={p.name} className={inputClass} autoComplete="off" />
        </Field>
        <Field id="phone" label="iPhone number Argos calls" hint="A full number, like (214) 555-0134.">
          <input id="phone" name="phone" type="tel" required defaultValue={p.phone ? formatPhone(p.phone) : ""} className={inputClass} />
        </Field>
        <Field id="timezone" label="Time zone" hint="Reminder times are read on this clock, like America/Chicago.">
          <input id="timezone" name="timezone" required defaultValue={p.timezone} className={`${inputClass} max-w-[22rem]`} />
        </Field>
        <Field id="dateOfBirth" label="Date of birth (optional)">
          <input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={p.date_of_birth ?? ""} className={`${inputClass} max-w-[16rem]`} />
        </Field>
        <fieldset>
          <legend className="font-bold">Height and weight (optional)</legend>
          <div className="mt-2 grid max-w-[24rem] grid-cols-3 gap-3">
            {(
              [
                ["heightFt", "Feet", ft, 8],
                ["heightIn", "Inches", inch, 11],
                ["weightLb", "Pounds", lb, 700],
              ] as const
            ).map(([key, label, value, max]) => (
              <div key={key}>
                <label htmlFor={key} className="block text-[1rem]">
                  {label}
                </label>
                <input id={key} name={key} inputMode="numeric" type="number" min={0} max={max} defaultValue={value} className={`${inputClass} mt-1`} />
              </div>
            ))}
          </div>
        </fieldset>
        <Field id="familyPhone" label="Family contact number (optional)" hint="Argos calls this number when a dose is missed.">
          <input
            id="familyPhone"
            name="familyPhone"
            type="tel"
            defaultValue={p.family_phone_number ? formatPhone(p.family_phone_number) : ""}
            className={inputClass}
          />
        </Field>
      </div>
    </ActionForm>
  );

  return (
    <section className={cardClass} aria-labelledby="profile-heading">
      <h2 id="profile-heading" className="mb-5 text-[1.5rem]">
        Patient profile
      </h2>
      <Editable view={view} form={form} editLabel="Edit profile" />
    </section>
  );
}
