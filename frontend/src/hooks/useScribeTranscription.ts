import { useCallback, useEffect, useRef } from "react";
import { CommitStrategy, useScribe } from "@elevenlabs/react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type ScribeTokenResponse = {
  token: string;
};

type ScribeTranscript = {
  text: string;
};

type UseScribeTranscriptionOptions = {
  enabled: boolean;
  onTranscriptReady: (transcript: string) => void;
};

async function fetchScribeToken(): Promise<string> {
  const response = await fetch(`${API_URL}/scribe-token`);
  if (!response.ok) {
    throw new Error("Failed to create Scribe token");
  }
  const data = (await response.json()) as ScribeTokenResponse;
  return data.token;
}

export function useScribeTranscription({
  enabled,
  onTranscriptReady,
}: UseScribeTranscriptionOptions) {
  const connectingRef = useRef(false);

  const handleCommittedTranscript = useCallback(
    (data: ScribeTranscript) => {
      const text = data.text.trim();
      if (text) onTranscriptReady(text);
    },
    [onTranscriptReady],
  );

  const handleError = useCallback((error: unknown) => {
    console.error("[Scribe]", error);
  }, []);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    vadSilenceThresholdSecs: 2,
    vadThreshold: 0.35,
    minSpeechDurationMs: 100,
    minSilenceDurationMs: 500,
    languageCode: "en",
    onCommittedTranscript: handleCommittedTranscript,
    onError: handleError,
  });

  const {
    connect: connectScribe,
    disconnect,
    error,
    isConnected,
    partialTranscript,
    status,
  } = scribe;

  useEffect(() => {
    if (!enabled) {
      connectingRef.current = false;
      if (isConnected || status === "connecting") {
        disconnect();
      }
      return;
    }

    if (
      isConnected ||
      status === "connecting" ||
      status === "error" ||
      connectingRef.current
    ) {
      return;
    }

    let cancelled = false;
    connectingRef.current = true;

    async function connect() {
      try {
        const token = await fetchScribeToken();
        if (cancelled) return;
        await connectScribe({
          token,
          microphone: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (error) {
        console.error("[Scribe] Failed to connect", error);
      } finally {
        connectingRef.current = false;
      }
    }

    connect();

    return () => {
      cancelled = true;
    };
  }, [enabled, isConnected, status, connectScribe, disconnect]);

  return {
    isListening: isConnected,
    isSpeaking: Boolean(partialTranscript),
    partialTranscript,
    error,
    status,
    stop: disconnect,
  };
}
