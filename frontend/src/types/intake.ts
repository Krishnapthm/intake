export type IntakeStage = "greeting" | "cc" | "hpi" | "ros" | "done";

export type TranscriptMessage = {
  role: "patient" | "agent";
  text: string;
};

export type IntakeBrief = {
  cc?: string;
  hpi?: string;
  ros?: Record<string, string>;
};

export type IntakeSocketMessage = {
  agent_text?: string;
  transcript?: string;
  stage?: IntakeStage;
  is_complete?: boolean;
  pdf_ready?: boolean;
  brief?: IntakeBrief;
  audio_b64?: string;
};

export type VisualizerState =
  | "connecting"
  | "initializing"
  | "listening"
  | "thinking"
  | "speaking";
