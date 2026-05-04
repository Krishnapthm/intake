# Clinical Intake Agent

## Overview

A voice-based clinical intake agent that conducts a structured pre-visit interview with a simulated patient entirely in the browser. The patient speaks through their microphone; the agent listens, responds in natural speech, and guides the conversation through a fixed clinical workflow. When the session ends, the system generates a structured clinical brief (CC, HPI, ROS) and exports a formatted PDF.

## Demo

[Loom walkthrough](https://loom.com/YOUR_LINK_HERE)

## Features

- Real-time voice conversation over WebSocket — no page refreshes, no push-to-talk buttons
- Voice Activity Detection automatically captures speech; agent responds with synthesized audio
- Six-stage intake state machine: Greeting, Chief Complaint, HPI, Review of Systems, Closing
- Each stage has a dedicated system prompt and per-turn structured extraction running silently alongside the dialogue
- Stages advance on completeness (structured LLM check), not just turn count; hard cap is a fallback
- Agent responses capped at 150 tokens and 2 sentences to minimize TTS latency
- Structured clinical brief generated at session end via a separate GPT-4o call in JSON mode
- Server-side PDF export (ReportLab) with clinical section formatting
- Live transcript panel and stage progress indicator in the UI

## Tech Stack

| Layer    | Tool                                     |
| -------- | ---------------------------------------- |
| Backend  | FastAPI + uvicorn                        |
| Agent    | LangGraph (single-node state machine)    |
| LLM      | GPT-4o (dialogue, extraction, brief gen) |
| STT      | ElevenLabs `scribe_v1`                   |
| TTS      | ElevenLabs `eleven_turbo_v2`             |
| PDF      | ReportLab (server-side)                  |
| Frontend | React + Vite (plain JSX)                 |
| Session  | In-memory dict (MemorySaver pattern)     |

## Getting Started

### Prerequisites

- Python 3.12 with `uv` installed
- Node.js 18+
- OpenAI API key
- ElevenLabs API key and a Voice ID

### Setup

```bash
# Clone and enter the repo
git clone https://github.com/Krishnapthm/intake
cd clinical-brief

# Backend environment
cp .env.example .env
# Fill in: OPENAI_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID

# Frontend environment
cp frontend/.env.example frontend/.env
# Defaults (ws://localhost:8000, http://localhost:8000) work for local dev

# Install backend deps
cd backend
uv sync

# Install frontend deps
cd ../frontend
npm install
```

### Running

```bash
# Terminal 1 — backend
cd backend
uv run uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev
```

Open `http://localhost:5173`, click the visualizer to begin.

## Conversation Flow

```
greeting -> cc -> hpi -> ros -> closing -> done
```

Each stage has a system prompt, a max turn limit, and a silent extraction prompt:

| Stage    | Max Turns | Extraction Model | Advance Condition                                      |
| -------- | --------- | ---------------- | ------------------------------------------------------ |
| greeting | 2         | —                | Patient says anything                                  |
| cc       | 5         | CCExtraction     | cc_statement + onset + character + severity present    |
| hpi      | 10        | HPIExtraction    | Coherent narrative covering onset, character, severity |
| ros      | 8         | ROSExtraction    | Constitutional + chief-complaint system + 2 others     |
| closing  | 1         | —                | Always advances                                        |

Each patient turn triggers two LLM calls: one for the spoken agent reply, one silent structured extraction to evaluate completeness. If extraction returns `is_complete: true`, the stage advances. If the turn cap is hit, it advances regardless.

On `done`, the server calls `generate_brief()` with the full message history, which runs a separate GPT-4o call in JSON mode to produce the final CC/HPI/ROS document.

## Clinical Output Format

**Chief Complaint** — one sentence in the patient's own words.

**History of Present Illness** — 1–3 paragraphs of clinical prose in third person. Covers onset, location, character, severity (0–10), aggravating and relieving factors, progression, associated symptoms, and functional impact. Preserves the patient's descriptor words in quotes and uses exact time references. No diagnostic conclusions.

**Review of Systems** — per-system finding phrases for each system discussed (e.g., `"denies fever or chills"`, `"reports fatigue for 2 weeks"`). Systems not discussed are omitted. Covers constitutional, cardiovascular, respiratory, gastrointestinal, musculoskeletal, and neurological.

The brief is available as JSON via `GET /session/{id}/brief` and as a formatted PDF via `GET /session/{id}/brief/pdf`.

## Design Decisions and Tradeoffs

- **Two LLM calls per turn.** The dialogue call and the extraction call are separate. This keeps the conversational prompts clean and the extraction prompts precise. The cost is added latency per turn (~300–600 ms); a production system would batch or stream these. The extraction prompt also runs at every turn after the first, even when it is unlikely to return `is_complete` early in a stage.

- **No VAD on the backend.** The frontend uses the Web Audio API for voice activity detection and sends a single audio blob per utterance. This simplifies the server (stateless audio handler) but makes the system sensitive to browser MediaRecorder behavior and network drops. A production system would use a server-side VAD or streaming Whisper.

- **In-memory session state.** `_sessions` is a plain dict on the FastAPI process. This is fine for a single demo session but does not survive restarts and will not scale horizontally. The LangGraph `MemorySaver` pattern is a clean swap point for `SqliteSaver` or Redis.

- **Whisper-1 for STT, not ElevenLabs Scribe.** The original design specified ElevenLabs Scribe v1 but Whisper-1 was used. Whisper-1 accepts `audio/webm` natively from MediaRecorder, requires no extra setup, and performs well enough for this use case. Scribe v1 would reduce vendor count.

- **Hard turn caps as a fallback, not primary logic.** The primary advance condition is structured extraction completeness. Turn caps exist to guarantee termination when the patient is evasive or the extraction is too conservative. In practice, the caps are generous enough that they rarely fire on a cooperative patient.

## What I Would Improve with More Time

- **Streaming audio response.** ElevenLabs has a streaming endpoint; the current implementation buffers the full MP3 before sending. Switching to chunked streaming would cut perceived latency by 1–2 seconds per turn.

- **Richer extraction with confidence scoring.** The current extraction models use a binary `is_complete` flag. A confidence score or a list of missing required fields would let the agent ask more targeted follow-up questions rather than relying on the dialogue prompt to figure out what is still needed.

- **Persistent sessions with a real database.** In-memory state means the brief is lost on server restart. Replacing the `_sessions` dict with `SqliteSaver` (or Postgres for multi-tenant use) would make sessions durable and enable retrieval by a clinician before the appointment.
