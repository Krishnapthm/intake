# CLAUDE.md

## Project Overview

Voice-based clinical intake agent. Browser mic → ElevenLabs Scribe v1 STT → LangGraph state machine → GPT-4o → ElevenLabs TTS → browser audio. On completion, generates a structured clinical brief (CC, HPI, ROS) and exports a PDF (server-side via ReportLab).

## Architecture

```text
Browser mic → WebSocket /ws/{session_id} → FastAPI
                                            ├── ElevenLabs Scribe v1 (STT)
                                            ├── LangGraph (intake flow)
                                            │     └── GPT-4o (dialogue + NLU)
                                            └── ElevenLabs (TTS)

On is_complete → generate_brief() → IntakeBrief JSON
GET /session/{id}/brief/pdf → ReportLab PDF
```

## Stack

| Layer    | Tool                              |
|----------|-----------------------------------|
| Backend  | FastAPI + uvicorn                 |
| Agent    | LangGraph (MemorySaver, in-memory)|
| LLM      | OpenAI GPT-4o                     |
| STT      | ElevenLabs Scribe v1              |
| TTS      | ElevenLabs eleven_turbo_v2        |
| PDF      | ReportLab (server-side)           |
| Frontend | React + Vite (plain JSX, no TS)   |
| Env mgr  | uv (Python 3.12)                  |

**Do NOT add:** Twilio, any telephony, Redis, Postgres, auth, jsPDF (PDF is backend).

## File Structure

```text
backend/
  main.py                   # FastAPI app + WebSocket /ws/{session_id}
  models.py                 # IntakeBrief, HPIFields (Pydantic)
  agent/
    state.py                # IntakeState TypedDict
    graph.py                # LangGraph graph + MemorySaver
    nodes.py                # Node functions per stage
    prompts.py              # All system prompts as constants
  services/
    stt.py                  # ElevenLabs Scribe v1 transcription
    tts.py                  # ElevenLabs → base64 MP3
    brief_generator.py      # GPT-4o JSON mode → IntakeBrief
frontend/
  src/
    App.jsx
    components/
      VoiceRecorder.jsx     # getUserMedia + MediaRecorder, hold-to-speak
      ConversationView.jsx  # scrolling transcript
      StageIndicator.jsx    # stage progress bar
      IntakeBrief.jsx       # brief display + PDF download button
    hooks/
      useIntakeSocket.js    # WebSocket + audio playback queue
prompts/                    # optional plain-text prompt storage
```

## LangGraph Stages

`greeting → cc → hpi → ros → closing → done`

Max turns per stage: CC=3, HPI=8, ROS=6. Use GPT-4o completeness check before advancing (not just turn count).

## WebSocket Contract

**Client → Server:** binary audio blob (audio/webm)

**Server → Client (JSON):**

```json
{
  "transcript": "...",
  "agent_text": "...",
  "audio_b64": "<base64 mp3>",
  "stage": "hpi",
  "is_complete": false
}
```

On completion, `is_complete: true` + `brief: { cc, hpi, ros }` included.

## Run Commands

```bash
# Backend
cd backend
uv run uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm run dev
```

## Environment Variables

**NEVER read `.env` files** — they contain real secrets. To check required variable names, read `.env.example` only.

Copy `.env.example` → `.env` in project root, fill in keys.
Copy `frontend/.env.example` → `frontend/.env`.

| Variable             | Description                          |
|----------------------|--------------------------------------|
| OPENAI_API_KEY       | OpenAI key (Whisper + GPT-4o)        |
| ELEVENLABS_API_KEY   | ElevenLabs key                       |
| ELEVENLABS_VOICE_ID  | Voice ID from ElevenLabs dashboard   |
| CORS_ORIGINS         | Comma-separated allowed origins      |
| VITE_WS_URL          | WebSocket base URL for frontend      |
| VITE_API_URL         | REST API base URL for frontend       |

## Key Decisions

- **PDF on backend** (ReportLab) — not jsPDF in browser — for consistent formatting and no client-side dependency.
- **MemorySaver** for session state — no DB needed for prototype. Swap to `SqliteSaver` for persistence.
- **Hold-to-speak** UX in VoiceRecorder — simpler than VAD, works for demo.
- **ElevenLabs eleven_turbo_v2** — lowest latency model; keep agent replies ≤2 sentences to minimize TTS delay.
- **audio/webm** from MediaRecorder — Whisper accepts it natively, no browser-side conversion needed.
