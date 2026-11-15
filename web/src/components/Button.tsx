import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "quiet";

const base =
  "inline-flex items-center justify-center gap-2 min-h-14 px-7 rounded-md font-bold text-[1.05rem] leading-none " +
  "transition-[background-color,transform,box-shadow] duration-[160ms] ease-[var(--ease-out-expo)] " +
  "active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-terracotta-deep text-cream shadow-[0_2px_6px_-2px_rgba(30,26,23,0.35)] [@media(hover:hover)]:hover:bg-[#953f1e] " +
    "[@media(hover:hover)]:hover:shadow-[0_3px_10px_-2px_rgba(168,74,37,0.45)]",
  secondary: "border-2 border-glaze text-glaze bg-transparent hover:bg-glaze hover:text-cream",
  quiet: "min-h-12 px-4 text-aegean-deep underline underline-offset-4 hover:text-glaze",
};

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant };

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return <button {...props} className={buttonClass(variant, className)} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; children: ReactNode };

export function ButtonLink({ variant = "primary", className = "", ...props }: ButtonLinkProps) {
  return <Link {...props} className={buttonClass(variant, className)} />;
}
