import { Suspense } from "react";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { getPatient } from "@/lib/dashboard";
import { formatPhone } from "@/lib/phone";

/** Not async: the patient header streams in, so the tab chrome and each page's fallback show at once. */
export default function PatientLayout({ children, params }: LayoutProps<"/dashboard/[patientId]">) {
  return (
    <>
      <Suspense fallback={<div className="mb-6 h-[8.5rem]" aria-hidden="true" />}>
        <PatientHeader params={params} />
      </Suspense>
      <div className="pt-8">{children}</div>
    </>
  );
}

async function PatientHeader({ params }: { params: LayoutProps<"/dashboard/[patientId]">["params"] }) {
  const { patientId } = await params;
  const patient = await getPatient(patientId);
  return (
    <div>
      <p className="text-[0.95rem] font-bold uppercase tracking-[0.12em] text-terracotta-deep">Watching over</p>
      <h1 className="mt-1 text-[2rem] leading-tight md:text-[2.4rem]">{patient.name}</h1>
      <p className="mt-1 text-ink">
        {patient.phone ? formatPhone(patient.phone) : "No phone"} · {patient.timezone}
      </p>
      <div className="mt-6">
        <DashboardTabs patientId={patient.id} />
      </div>
    </div>
  );
}
