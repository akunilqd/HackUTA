const E164 = /^\+[1-9]\d{7,14}$/;

/** Normalizes what people type into E.164. Ten digits are read as a US number. */
export function toE164(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export function isValidPhone(raw: string): boolean {
  return E164.test(toE164(raw));
}

/** Display form: US numbers as (214) 555-0134, everything else as stored. */
export function formatPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}
