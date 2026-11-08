import { Suspense } from "react";
import { ReportView } from "@/components/ReportView";

export default function ReportPage() {
  return (
    <Suspense fallback={<p className="text-dust">Loading this report.</p>}>
      <ReportView />
    </Suspense>
  );
}