import { redirect } from "next/navigation";
import { Suspense } from "react";

/** /dashboard/{id} opens the profile tab. */
export default function PatientIndex({ params }: PageProps<"/dashboard/[patientId]">) {
  return (
    <Suspense>
      <GoToProfile params={params} />
    </Suspense>
  );
}

async function GoToProfile({ params }: { params: PageProps<"/dashboard/[patientId]">["params"] }) {
  const { patientId } = await params;
  return redirect(`/dashboard/${patientId}/profile`);
}
