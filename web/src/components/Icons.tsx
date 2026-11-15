import type { SVGProps } from "react";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function IconPerson(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" {...props}>
      <circle cx="16" cy="11" r="6" {...stroke} />
      <path d="M5 28c1.5-6 6-9 11-9s9.5 3 11 9" {...stroke} />
    </svg>
  );
}

export function IconBottle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" {...props}>
      <path d="M12 3h8v4h-8zM10 7h12v3H10zM10 10v17a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10" {...stroke} />
      <path d="M13 16h6M13 20h6" {...stroke} />
    </svg>
  );
}

export function IconPhone(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" {...props}>
      <rect x="9" y="3" width="14" height="26" rx="3" {...stroke} />
      <path d="M14 25h4M13 7h6" {...stroke} />
      <path d="M12 13c2-2 6-2 8 0" {...stroke} />
    </svg>
  );
}

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" {...stroke} strokeWidth={2.5} />
    </svg>
  );
}

export function IconClock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" {...stroke} />
      <path d="M12 7v5l3.5 2" {...stroke} />
    </svg>
  );
}

export function IconAlert(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" {...stroke} />
      <path d="M12 7.5v5.5M12 16.5h.01" {...stroke} strokeWidth={2.5} />
    </svg>
  );
}

export function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...props}>
      <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" {...stroke} />
    </svg>
  );
}

export function IconLog(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...props}>
      <path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" {...stroke} />
      <path d="M9 8h6M9 12h6M9 16h4" {...stroke} />
    </svg>
  );
}

export function IconSettings(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="3" {...stroke} />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" {...stroke} />
    </svg>
  );
}
