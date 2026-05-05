import { Mic, MicOff, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type CallControlsProps = {
  muted: boolean;
  onMuteToggle: () => void;
  onStop: () => void;
};

export function CallControls({ muted, onMuteToggle, onStop }: CallControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant={muted ? "destructive" : "secondary"}
        size="lg"
        onClick={onMuteToggle}
      >
        {muted ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
        {muted ? "Unmute" : "Mute"}
      </Button>

      <Button variant="destructive" size="lg" onClick={onStop}>
        <PhoneOff aria-hidden="true" />
        End call
      </Button>
    </div>
  );
}
