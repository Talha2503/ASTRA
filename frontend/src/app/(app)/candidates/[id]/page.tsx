import { Suspense } from "react";
import { CandidateView } from "@/components/CandidateView";

export default function CandidatePage() {
  return (
    <Suspense fallback={<p className="text-dust">Loading this star.</p>}>
      <CandidateView />
    </Suspense>
  );
}