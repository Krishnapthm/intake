import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TranscriptMessage } from "@/types/intake";

export function ConversationView({ transcript }: { transcript: TranscriptMessage[] }) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  if (transcript.length === 0) return null;

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 w-full">
        {transcript.map((msg, i) => (
          <div
            key={i}
            className={[
              "flex flex-col gap-1",
              msg.role === "patient" ? "items-end" : "items-start",
            ].join(" ")}
          >
            <span className="text-xs text-zinc-600 px-1">
              {msg.role === "agent" ? "Agent" : "You"}
            </span>
            <div
              className={[
                "max-w-xs px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                msg.role === "patient"
                  ? "bg-emerald-400/10 text-emerald-200 rounded-br-sm"
                  : "bg-zinc-800 text-zinc-200 rounded-bl-sm",
              ].join(" ")}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
