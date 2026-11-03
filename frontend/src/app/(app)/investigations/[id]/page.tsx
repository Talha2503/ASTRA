import { Suspense } from "react";
import { InvestigationView } from "@/components/InvestigationView";

export default function InvestigationPage() {
  return (
    <Suspense fallback={<p className="text-dust">Loading this investigation.</p>}>
      <InvestigationView />
    </Suspense>
  );
}