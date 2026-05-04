import type { IntakeStage } from "@/types/intake";

const STAGES = [
  { key: "greeting", label: "Greeting" },
  { key: "cc", label: "Chief Complaint" },
  { key: "hpi", label: "HPI" },
  { key: "ros", label: "ROS" },
  { key: "done", label: "Done" },
];

export function StageIndicator({ stage }: { stage: IntakeStage }) {
  const currentIdx = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="flex items-center gap-1.5">
      {STAGES.map((s, i) => (
        <div
          key={s.key}
          title={s.label}
          className={[
            "h-1.5 rounded-full transition-all duration-500",
            i < currentIdx
              ? "w-4 bg-emerald-400"
              : i === currentIdx
              ? "w-6 bg-emerald-400"
              : "w-4 bg-zinc-700",
          ].join(" ")}
        />
      ))}
    </div>
  );
}
