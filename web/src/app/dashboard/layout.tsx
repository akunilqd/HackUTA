import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b border-glaze/15 bg-cream/95 backdrop-blur-[2px]">
        <div className="mx-auto flex max-w-[72rem] items-center justify-between gap-4 px-5 py-3 md:px-8">
          <Wordmark />
          <Link href="/dashboard" className="inline-flex min-h-12 items-center whitespace-nowrap rounded-md px-3 font-bold md:px-4 text-glaze no-underline hover:bg-cream-deep">
            All patients
          </Link>
        </div>
        <div className="meander" aria-hidden="true" />
      </header>
      <main className="mx-auto w-full max-w-[72rem] flex-1 px-5 pb-20 pt-8 md:px-8 md:pt-10">{children}</main>
    </div>
  );
}
