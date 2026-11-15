/** Plain label first, theme second: "Medicines" / "The remedies Argos guards each day". */
export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-[2rem] leading-tight md:text-[2.4rem]">{title}</h1>
      {subtitle && <p className="mt-1 text-ink">{subtitle}</p>}
    </div>
  );
}
