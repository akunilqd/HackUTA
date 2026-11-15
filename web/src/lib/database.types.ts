// Hand-written from the schema in ARGOS_FRONTEND_PLAN.md and supabase/002_dose_status.sql.
// Replace with `supabase gen types typescript --project-id <id> > src/lib/database.types.ts`
// once the project credentials are available (see NOTES.md).

export type DoseStatus =
  | "pending"
  | "taken"
  | "missed"
  | "skipped"
  | "calling"
  | "unconfirmed"
  | "missed_no_answer"
  | "wrong_medication_flagged";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          timezone: string;
          height_cm: number | null;
          weight_kg: number | null;
          date_of_birth: string | null;
          family_phone_number: string | null;
          phone: string | null;
        };
        Insert: {
          id: string;
          name: string;
          timezone: string;
          height_cm?: number | null;
          weight_kg?: number | null;
          date_of_birth?: string | null;
          family_phone_number?: string | null;
          phone?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      user_medications: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          dosage: string;
          reminder_times: string[];
          start_date: string;
          end_date: string | null;
          /** "Yes" = taken after a meal, "No" = taken before a meal (database check constraint). */
          after_meal: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          dosage: string;
          reminder_times: string[];
          start_date: string;
          end_date?: string | null;
          after_meal: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_medications"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "user_medications_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ];
      };
      dose_logs: {
        Row: {
          id: string;
          medication_id: string;
          scheduled_at: string;
          taken_at: string | null;
          status: DoseStatus;
        };
        Insert: {
          id?: string;
          medication_id: string;
          scheduled_at: string;
          taken_at?: string | null;
          status: DoseStatus;
        };
        Update: Partial<Database["public"]["Tables"]["dose_logs"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "dose_logs_medication_id_fkey"; columns: ["medication_id"]; isOneToOne: false; referencedRelation: "user_medications"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type UserRow = Database["public"]["Tables"]["users"]["Row"];
export type MedicationRow = Database["public"]["Tables"]["user_medications"]["Row"];
export type DoseLogRow = Database["public"]["Tables"]["dose_logs"]["Row"];
