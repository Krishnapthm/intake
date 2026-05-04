import { useCallback, useEffect, useRef, useState } from "react";
import type { IntakeBrief, IntakeSocketMessage, IntakeStage, TranscriptMessage } from "@/types/intake";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000";

export function useIntakeSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [stage, setStage] = useState<IntakeStage>("greeting");
  const [isComplete, setIsComplete] = useState(false);
  const [brief, setBrief] = useState<IntakeBrief | null>(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [isPdfReady, setIsPdfReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isStopped, setIsStopped] = useState(false);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }, []);

  const playNext = useCallback(async function playNextImpl() {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    const b64 = audioQueueRef.current.shift();
    if (!b64) return;
    isPlayingRef.current = true;
    setIsAgentSpeaking(true);
    try {
      const ctx = getAudioCtx();
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const buffer = await ctx.decodeAudioData(bytes.buffer);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        isPlayingRef.current = false;
        if (audioQueueRef.current.length === 0) setIsAgentSpeaking(false);
        void playNextImpl();
      };
      source.start();
    } catch {
      isPlayingRef.current = false;
      setIsAgentSpeaking(false);
      void playNextImpl();
    }
  }, [getAudioCtx]);

  const enqueueAudio = useCallback((b64: string) => {
    audioQueueRef.current.push(b64);
    setIsThinking(false);
    playNext();
  }, [playNext]);

  useEffect(() => {
    if (!sessionId) return;

    const ws = new WebSocket(`${WS_URL}/ws/${sessionId}`);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    ws.onmessage = (event: MessageEvent<string>) => {
      const data = JSON.parse(event.data) as IntakeSocketMessage;
      if (data.agent_text) {
        const agentText = data.agent_text;
        setTranscript((prev) => {
          const next = [...prev];
          if (data.transcript) next.push({ role: "patient", text: data.transcript });
          next.push({ role: "agent", text: agentText });
          return next;
        });
      }
      if (data.stage) setStage(data.stage);
      if (data.is_complete) {
        setIsComplete(true);
        setIsPdfGenerating(!data.pdf_ready);
        setIsPdfReady(Boolean(data.pdf_ready));
        if (data.brief) setBrief(data.brief);
      }
      if (data.audio_b64) {
        enqueueAudio(data.audio_b64);
      }
    };

    return () => ws.close();
  }, [sessionId, enqueueAudio]);

  const sendAudio = useCallback((blob: Blob | ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(blob);
      setIsThinking(true);
    }
  }, []);

  const sendTranscript = useCallback((transcript: string) => {
    const text = transcript.trim();
    if (text && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ transcript: text }));
      setIsThinking(true);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    audioQueueRef.current = [];
    if (audioCtxRef.current?.state !== "closed") {
      audioCtxRef.current?.close();
    }
    isPlayingRef.current = false;
    setIsAgentSpeaking(false);
    setIsThinking(false);
    setIsConnected(false);
    setIsStopped(true);
  }, []);

  return {
    transcript,
    stage,
    isComplete,
    brief,
    isPdfGenerating,
    isPdfReady,
    isConnected,
    sendAudio,
    sendTranscript,
    isAgentSpeaking,
    isThinking,
    isStopped,
    disconnect,
  };
}
