import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { Wordmark } from "@/components/Wordmark";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!hasSupabaseEnv) redirect("/");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase.from("users").select("id").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/onboarding");

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b border-glaze/15 bg-cream/95 backdrop-blur-[2px]">
        <div className="mx-auto flex max-w-[72rem] items-center justify-between px-5 py-3 md:px-8">
          <Wordmark href="/home" />
          <AppNav variant="top" />
        </div>
        <div className="meander" aria-hidden="true" />
      </header>
      <main className="mx-auto w-full max-w-[72rem] flex-1 px-5 pb-28 pt-8 md:px-8 md:pb-16 md:pt-10">{children}</main>
      <div className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-gold/60 bg-cream md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <AppNav variant="bottom" />
      </div>
    </div>
  );
}
