import type { ReactNode } from "react";

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="border-2 border-gold/60 px-6 py-10 text-center md:px-10">
      <p className="text-[1.3rem] font-bold">{title}</p>
      <p className="mx-auto mt-2 max-w-[46ch] text-ink">{body}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
