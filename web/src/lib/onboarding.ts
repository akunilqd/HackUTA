import { z } from "zod";
import { isValidPhone } from "@/lib/phone";

/** Shared by the browser form and the /api/onboarding route, so both check exactly the same rules. */

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isTimeZone(v: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v });
    return v.includes("/") || v === "UTC";
  } catch {
    return false;
  }
}

const optionalNumber = (label: string, max: number) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= max), `${label} must be a number from 0 to ${max}.`);

const medicineSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the medicine's name."),
    dosage: z.string().trim().min(1, "Enter the dose, like 1 tablet, 500 mg."),
    times: z.array(z.object({ value: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time.") })).min(1, "Add at least one time."),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date."),
    endDate: z.string(),
    // Stored exactly as the database check constraint allows: "Yes" (after a meal) or "No" (before a meal).
    afterMeal: z.string().refine((v): boolean => ["Yes", "No"].includes(v), "Choose Yes or No."),
  })
  .superRefine((m, ctx) => {
    if (m.endDate && m.endDate <= m.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "The end date must be after the start date." });
    }
    const seen = new Set<string>();
    m.times.forEach((t, i) => {
      if (t.value && seen.has(t.value)) {
        ctx.addIssue({ code: "custom", path: ["times", i, "value"], message: "This time is already listed." });
      }
      seen.add(t.value);
    });
  });

export const onboardingSchema = z.object({
  name: z.string().trim().min(1, "Enter their name.").max(120),
  phone: z
    .string()
    .trim()
    .min(1, "Enter the iPhone number Argos will FaceTime.")
    .refine(isValidPhone, "Use a full number, like (214) 555-0134, or +44 20 7946 0958 outside the US."),
  timezone: z.string().trim().min(1, "Choose their time zone.").refine(isTimeZone, "Pick a time zone from the list, like America/Chicago."),
  dateOfBirth: z.string().refine((v) => v === "" || v <= today(), "Date of birth cannot be in the future."),
  heightFt: optionalNumber("Feet", 8),
  heightIn: optionalNumber("Inches", 11),
  weightLb: optionalNumber("Weight", 700),
  familyPhone: z.string().trim().refine((v) => v === "" || isValidPhone(v), "Use a full number, like (214) 555-0134."),
  medicines: z.array(medicineSchema).min(1, "Add at least one medicine.").max(30),
});

export type OnboardingValues = z.infer<typeof onboardingSchema>;

export type SavedSummary = {
  userId: string;
  name: string;
  family: string;
  medicines: { name: string; dosage: string; times: string[]; afterMeal: boolean }[];
};
