"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/Button";
import type { ActionState } from "@/app/dashboard/actions";
import { inputClass } from "./Field";

type Action = (prev: ActionState | null, fd: FormData) => Promise<ActionState>;

/** Lets a form inside <Editable> or <AddPanel> close it after a successful save. */
const PanelContext = createContext<(() => void) | null>(null);

const TOAST_EVENT = "dashboard:toast";

/**
 * Success messages live here, not beside the form: a save can move a card to another section
 * (an appointment marked Completed) or remove it (a delete), which would unmount a local message.
 * Rendered once in the dashboard layout.
 */
export function Toaster() {
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = (e: Event) => {
      const message = (e as CustomEvent<string>).detail;
      setToast({ message, id: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 5000);
    };
    window.addEventListener(TOAST_EVENT, show);
    return () => {
      window.removeEventListener(TOAST_EVENT, show);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center px-4" role="status" aria-live="polite">
      {toast && (
        <p
          key={toast.id}
          className="settle pointer-events-auto flex items-center gap-3 border-2 border-gold bg-glaze px-5 py-3 font-bold text-cream shadow-[0_6px_20px_-6px_rgba(30,26,23,0.5)]"
        >
          <span aria-hidden="true" className="text-gold">
            ✓
          </span>
          {toast.message}
        </p>
      )}
    </div>
  );
}

/**
 * A form bound to a dashboard Server Action. Submits without React's automatic reset, so a rejected
 * edit keeps what the person typed and shows the error under the button; success goes to the <Toaster>.
 */
export function ActionForm({
  action,
  hidden,
  submitLabel,
  pendingLabel = "Saving…",
  variant = "primary",
  confirm,
  resetOnSuccess = false,
  className = "",
  children,
}: {
  action: Action;
  hidden: Record<string, string>;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "quiet";
  confirm?: string;
  resetOnSuccess?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  // Toast as soon as the server answers, not in an effect: the save's refresh can unmount this form
  // (a card moving to another section) before any effect of it runs.
  const [state, formAction, pending] = useActionState(async (prev: ActionState | null, fd: FormData) => {
    const result = await action(prev, fd);
    if (result.ok) window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: result.message }));
    return result;
  }, null);
  const formRef = useRef<HTMLFormElement>(null);
  const closePanel = useContext(PanelContext);

  useEffect(() => {
    if (!state?.ok) return;
    if (resetOnSuccess) formRef.current?.reset();
    closePanel?.();
    // Runs once per server answer; `at` changes on every submit.
  }, [state?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <div className={children ? "mt-6 flex flex-wrap items-center gap-4" : "flex flex-wrap items-center gap-4"}>
        <Button type="submit" variant={variant} disabled={pending} className={variant === "quiet" ? "" : "min-h-12"}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        <p role="alert" className="font-bold text-red-deep">
          {state && !state.ok && !pending ? state.message : ""}
        </p>
      </div>
    </form>
  );
}

/** Shows `view`; "Edit" swaps in `form` (one or more <ActionForm>s) until a save succeeds or the person cancels. */
export function Editable({
  view,
  form,
  editLabel = "Edit",
  title,
  inline = false,
}: {
  view: ReactNode;
  form: ReactNode;
  editLabel?: string;
  /** Read by screen readers after the button label: "Edit Metformin". */
  title?: string;
  /** Put the Edit button beside the view (for short rows) instead of under it. */
  inline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setEditing(false);
    requestAnimationFrame(() => editRef.current?.focus());
  };

  if (editing) {
    return (
      <PanelContext value={close}>
        <div>
          {form}
          <button type="button" onClick={close} className="mt-3 min-h-12 text-aegean-deep underline underline-offset-4 hover:text-glaze">
            Cancel
          </button>
        </div>
      </PanelContext>
    );
  }
  return (
    <div className={inline ? "flex flex-wrap items-center justify-between gap-x-4 gap-y-2" : ""}>
      <div className={inline ? "min-w-0 flex-1" : ""}>{view}</div>
      <div className={inline ? "flex items-center" : "mt-5"}>
        <Button ref={editRef} type="button" variant="secondary" className="min-h-12" onClick={() => setEditing(true)}>
          {editLabel}
          {title && <span className="sr-only"> {title}</span>}
        </Button>
      </div>
    </div>
  );
}

/** A "+ Add …" button that opens a create form and closes it again after a successful save. */
export function AddPanel({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  if (!open) {
    return (
      <div>
        <Button type="button" onClick={() => setOpen(true)}>
          + {label}
        </Button>
      </div>
    );
  }
  return (
    <PanelContext value={close}>
      <div className="border-2 border-terracotta-deep/50 bg-white/40 px-5 py-6 md:px-7">
        <h2 className="text-[1.4rem]">{label}</h2>
        <div className="mt-4">{children}</div>
        <button type="button" onClick={close} className="mt-3 min-h-12 text-aegean-deep underline underline-offset-4 hover:text-glaze">
          Cancel
        </button>
      </div>
    </PanelContext>
  );
}

/** Reminder times as a growable list of <input type="time" name="times">. */
export function TimesField({ idPrefix, initial }: { idPrefix: string; initial: string[] }) {
  const start = initial.length ? initial : ["08:00"];
  const nextKey = useRef(start.length); // keys 0..n-1 go to the starting times; new rows count up from here
  const [times, setTimes] = useState(() => start.map((value, key) => ({ key, value })));
  return (
    <fieldset>
      <legend className="font-bold">Reminder times</legend>
      <p className="mt-1 text-[1rem] text-ink">In the patient&rsquo;s time zone. Argos calls at each one.</p>
      <ul className="mt-2 flex flex-col gap-2">
        {times.map((t, i) => (
          <li key={t.key} className="flex items-center gap-2">
            <label htmlFor={`${idPrefix}-t${t.key}`} className="sr-only">
              Time {i + 1}
            </label>
            <input
              id={`${idPrefix}-t${t.key}`}
              type="time"
              name="times"
              required
              defaultValue={t.value}
              className={`${inputClass} mt-0 max-w-[12rem]`}
            />
            {times.length > 1 && (
              <button
                type="button"
                onClick={() => setTimes((all) => all.filter((x) => x.key !== t.key))}
                className="min-h-12 px-3 text-aegean-deep underline underline-offset-4"
              >
                Remove<span className="sr-only"> time {i + 1}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setTimes((all) => [...all, { key: nextKey.current++, value: "" }])}
        className="mt-2 min-h-12 font-bold text-aegean-deep underline underline-offset-4"
      >
        + Add another time
      </button>
    </fieldset>
  );
}
