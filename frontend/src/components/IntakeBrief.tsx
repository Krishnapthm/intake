import type { ReactNode } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IntakeBrief as IntakeBriefData } from "@/types/intake";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type IntakeBriefProps = {
  brief: IntakeBriefData | null;
  sessionId: string;
  isPdfGenerating: boolean;
  isPdfReady: boolean;
};

export function IntakeBrief({ brief, sessionId, isPdfGenerating, isPdfReady }: IntakeBriefProps) {
  const canDownload = Boolean(brief && isPdfReady);
  const showLoading = isPdfGenerating || !canDownload;

  const downloadPdf = () => {
    window.location.href = `${API_URL}/session/${sessionId}/brief/pdf`;
  };

  return (
    <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <h2 className="text-base font-medium text-zinc-100">Intake Brief</h2>
        {canDownload ? (
          <Button onClick={downloadPdf} size="sm" className="bg-emerald-400 text-zinc-950 hover:bg-emerald-300">
            <Download data-icon="inline-start" />
            Download PDF
          </Button>
        ) : showLoading ? (
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
            <LoaderCircle className="size-4 animate-spin text-emerald-400" />
            Generating PDF
          </div>
        ) : null}
      </div>

      {brief ? (
        <div className="divide-y divide-zinc-800">
          <Section title="Chief Complaint">
            <p className="text-sm text-zinc-300">{brief.cc}</p>
          </Section>

          <Section title="History of Present Illness">
            <p className="whitespace-pre-line text-sm leading-6 text-zinc-300">{brief.hpi}</p>
          </Section>

          <Section title="Review of Systems">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
              {Object.entries(brief.ros ?? {}).map(([system, findings]) => (
                <div key={system}>
                  <dt className="text-xs text-zinc-500 capitalize">{system}</dt>
                  <dd className="text-sm text-zinc-300">{findings}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </div>
      ) : (
        <div className="flex min-h-64 items-center justify-center px-6 py-12 text-sm text-zinc-400">
          <LoaderCircle className="mr-2 size-4 animate-spin text-emerald-400" />
          Building the clinical brief and PDF
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="px-6 py-4">
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">{title}</h3>
      {children}
    </div>
  );
}
