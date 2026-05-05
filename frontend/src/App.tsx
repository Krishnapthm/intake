import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IntakeBrief } from "./components/IntakeBrief";
import { ConversationView } from "./components/ConversationView";
import { StageIndicator } from "./components/StageIndicator";
import { AgentAudioVisualizerGrid } from "./components/agents-ui/agent-audio-visualizer-grid";
import { AgentAudioVisualizerBar } from "./components/agents-ui/agent-audio-visualizer-bar";
import { CallControls } from "./components/CallControls";
import { useIntakeSocket } from "./hooks/useIntakeSocket";
import { useScribeTranscription } from "./hooks/useScribeTranscription";
import type { VisualizerState } from "./types/intake";

function generateSessionId() {
  return crypto.randomUUID();
}

const STATUS_LABELS = {
  idle: "Tap to begin",
  connecting: "Connecting…",
  listening: "Listening…",
  speaking: "Speaking…",
  thinking: "Thinking…",
  agent_speaking: "Speaking…",
  mic_error: "Transcription unavailable",
  complete: "Intake complete",
  stopped: "Call ended",
} as const;

type StatusKey = keyof typeof STATUS_LABELS;

export default function App() {
  const [sessionId] = useState(generateSessionId);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const isAgentSpeakingRef = useRef(false);

  const {
    transcript,
    stage,
    isComplete,
    brief,
    isPdfGenerating,
    isPdfReady,
    isConnected,
    sendTranscript,
    isAgentSpeaking,
    isThinking,
    disconnect,
    isStopped,
  } =
    useIntakeSocket(started ? sessionId : null);

  // Keep Scribe connected the entire session; gate sending on the agent not speaking
  // so echo-cancelled mic noise during TTS playback is silently dropped.
  const transcriptionEnabled = started && isConnected && !isComplete && !muted && !isStopped;

  useEffect(() => { isAgentSpeakingRef.current = isAgentSpeaking; }, [isAgentSpeaking]);

  const handleTranscriptReady = useCallback((text: string) => {
    if (!isAgentSpeakingRef.current) sendTranscript(text);
  }, [sendTranscript]);

  const { isListening, isSpeaking, partialTranscript, error: transcriptionError } = useScribeTranscription({
    enabled: transcriptionEnabled,
    onTranscriptReady: handleTranscriptReady,
  });

  const handleStop = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const visualizerState = useMemo<VisualizerState>(() => {
    if (!started) return "listening";
    if (!isConnected) return "connecting";
    if (transcriptionError) return "thinking";
    if (isSpeaking) return "speaking";
    if (isThinking) return "thinking";
    if (isAgentSpeaking) return "speaking";
    return "listening";
  }, [started, isConnected, transcriptionError, isSpeaking, isThinking, isAgentSpeaking]);

  const statusKey = useMemo<StatusKey>(() => {
    if (isStopped) return "stopped";
    if (isComplete) return "complete";
    if (!started) return "idle";
    if (!isConnected) return "connecting";
    if (transcriptionError) return "mic_error";
    if (isSpeaking) return "speaking";
    if (isThinking) return "thinking";
    if (isAgentSpeaking) return "agent_speaking";
    if (isListening) return "listening";
    return "listening";
  }, [isStopped, isComplete, started, isConnected, transcriptionError, isSpeaking, isThinking, isAgentSpeaking, isListening]);

  return (
    <div className="h-screen overflow-hidden bg-zinc-950 text-zinc-50 flex flex-col">
      <header className="w-full px-8 pt-8 pb-4 flex items-center justify-between border-b border-zinc-800">
        <span className="text-sm font-medium tracking-widest text-zinc-500 uppercase">
          Clinical Intake
        </span>
        {started && !isComplete && (
          <StageIndicator stage={stage} />
        )}
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left — voice visualizer */}
        <div className="flex flex-col items-center justify-center gap-6 w-1/2 border-r border-zinc-800 select-none p-10">
          <AgentAudioVisualizerGrid
            state={visualizerState}
            size="xl"
            rowCount={9}
            columnCount={9}
            color="#34d399"
            mediaStream={null}
            className="cursor-pointer rounded-3xl p-6 transition-opacity duration-300 hover:opacity-90 active:opacity-75"
            onClick={() => {
              if (!started) setStarted(true);
            }}
          />

          <p className="text-sm text-zinc-400 tracking-wide">
            {STATUS_LABELS[statusKey]}
          </p>

          {partialTranscript && (
            <p className="max-w-sm text-center text-sm text-emerald-200">
              {partialTranscript}
            </p>
          )}

          {started && !isComplete && !isStopped && (
            <CallControls
              muted={muted}
              onMuteToggle={() => setMuted((m) => !m)}
              onStop={handleStop}
            />
          )}

          {isStopped && (
            <button
              onClick={() => window.location.reload()}
              className="rounded-full px-5 py-2.5 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors duration-150"
            >
              Start new session
            </button>
          )}

          {isAgentSpeaking && (
            <AgentAudioVisualizerBar
              state="speaking"
              size="sm"
              color="#34d399"
              barCount={5}
            />
          )}
        </div>

        {/* Right — transcript / brief */}
        <div className="flex flex-col w-1/2 h-full overflow-hidden p-8">
          {isComplete ? (
            <IntakeBrief
              brief={brief}
              sessionId={sessionId}
              isPdfGenerating={isPdfGenerating}
              isPdfReady={isPdfReady}
            />
          ) : (
            <ConversationView transcript={transcript} />
          )}
        </div>
      </main>
    </div>
  );
}
