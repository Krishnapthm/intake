import io
import json
import os
from contextlib import asynccontextmanager
from datetime import timezone

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import httpx
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib import colors

from agent.graph import intake_graph
from services.brief_generator import generate_brief
from services.stt import transcribe
from services.tts import synthesize

_sessions: dict[str, dict] = {}
_pdfs: dict[str, bytes] = {}


def _init_session(session_id: str) -> dict:
    return {
        "session_id": session_id,
        "stage": "greeting",
        "messages": [],
        "cc": "",
        "hpi": {},
        "ros": {},
        "brief": {},
        "pdf_ready": False,
        "turns_in_stage": 0,
        "agent_response": "",
        "_pending_user_msg": "",
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Clinical Intake API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _advance_session(session: dict, transcript: str) -> tuple[dict, dict]:
    session["_pending_user_msg"] = transcript

    result = await intake_graph.ainvoke(session)
    current_stage = result.get("stage", "greeting")
    is_complete = current_stage == "done"
    agent_text = result.get("agent_response", "")
    audio_b64 = await synthesize(agent_text)

    payload = {
        "transcript": transcript,
        "agent_text": agent_text,
        "audio_b64": audio_b64,
        "stage": current_stage,
        "is_complete": is_complete,
        "pdf_ready": bool(result.get("pdf_ready")),
    }
    if is_complete and result.get("brief"):
        payload["brief"] = result["brief"]

    return result, payload


@app.get("/scribe-token")
async def get_scribe_token():
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY is not configured")

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
            headers={"xi-api-key": api_key},
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=response.status_code,
            detail="Failed to create ElevenLabs Scribe token",
        )

    return {"token": response.json()["token"]}


@app.websocket("/ws/{session_id}")
async def intake_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()

    session = _sessions.get(session_id)
    if not session:
        session = _init_session(session_id)
        _sessions[session_id] = session

    # Send initial greeting before waiting for user audio
    result = await intake_graph.ainvoke(session)
    _sessions[session_id] = result
    session = result

    agent_text = result.get("agent_response", "")
    current_stage = result.get("stage", "greeting")
    audio_b64 = await synthesize(agent_text)

    await websocket.send_json({
        "transcript": "",
        "agent_text": agent_text,
        "audio_b64": audio_b64,
        "stage": current_stage,
        "is_complete": False,
    })

    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
            if "bytes" in message and message["bytes"] is not None:
                transcript = await transcribe(message["bytes"])
            elif "text" in message and message["text"] is not None:
                data = json.loads(message["text"])
                transcript = str(data.get("transcript", "")).strip()
            else:
                continue

            if not transcript:
                continue

            result, payload = await _advance_session(session, transcript)
            _sessions[session_id] = result
            session = result

            await websocket.send_json(payload)

            if payload["is_complete"] and not result.get("brief"):
                brief = await generate_brief(session_id, result.get("messages", []))
                brief_dict = brief.model_dump(mode="json")
                _pdfs[session_id] = _build_pdf(session_id, brief_dict)
                result["brief"] = brief_dict
                result["pdf_ready"] = True
                _sessions[session_id] = result

                await websocket.send_json({
                    "transcript": "",
                    "agent_text": "",
                    "audio_b64": "",
                    "stage": "done",
                    "is_complete": True,
                    "brief": brief_dict,
                    "pdf_ready": True,
                })
    except WebSocketDisconnect:
        pass


@app.get("/session/{session_id}/brief")
async def get_brief(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        **session,
        "pdf_ready": session_id in _pdfs or bool(session.get("pdf_ready")),
    }


def _build_pdf(session_id: str, brief: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=LETTER,
        leftMargin=inch,
        rightMargin=inch,
        topMargin=inch,
        bottomMargin=inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title", parent=styles["Title"], fontSize=18, spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", parent=styles["Normal"], fontSize=10, textColor=colors.grey, spaceAfter=16
    )
    section_style = ParagraphStyle(
        "Section", parent=styles["Normal"], fontSize=9, textColor=colors.grey,
        spaceBefore=14, spaceAfter=6, fontName="Helvetica-Bold", leading=12,
    )
    body_style = ParagraphStyle(
        "Body", parent=styles["Normal"], fontSize=11, leading=16, spaceAfter=4
    )
    label_style = ParagraphStyle(
        "Label", parent=styles["Normal"], fontSize=9, textColor=colors.grey,
        spaceBefore=8, spaceAfter=2, fontName="Helvetica-Bold"
    )

    generated_at = brief.get("generated_at", "")
    if generated_at:
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(str(generated_at).replace("Z", "+00:00"))
            generated_at = dt.astimezone(timezone.utc).strftime("%B %d, %Y at %H:%M UTC")
        except Exception:
            pass

    story = [
        Paragraph("Intake Brief", title_style),
        Paragraph(f"Session {session_id} &nbsp;·&nbsp; {generated_at}", subtitle_style),
        HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey, spaceAfter=10),
    ]

    cc = brief.get("cc", "")
    if cc:
        story += [
            Paragraph("CHIEF COMPLAINT", section_style),
            Paragraph(cc, body_style),
        ]

    hpi = brief.get("hpi", "")
    if hpi:
        story += [
            Paragraph("HISTORY OF PRESENT ILLNESS", section_style),
            Paragraph(hpi.replace("\n", "<br/>"), body_style),
        ]

    ros = brief.get("ros", {})
    if ros:
        story.append(Paragraph("REVIEW OF SYSTEMS", section_style))
        for system, finding in ros.items():
            if finding:
                story.append(Paragraph(system.replace("_", " ").title(), label_style))
                story.append(Paragraph(str(finding), body_style))

    doc.build(story)
    return buf.getvalue()


@app.get("/session/{session_id}/brief/pdf")
async def download_brief_pdf(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    brief = session.get("brief")
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not yet generated for this session")

    pdf_bytes = _pdfs.get(session_id)
    if pdf_bytes is None:
        brief_dict = brief if isinstance(brief, dict) else brief.model_dump(mode="json")
        pdf_bytes = _build_pdf(session_id, brief_dict)
        _pdfs[session_id] = pdf_bytes
        session["pdf_ready"] = True

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="intake-{session_id}.pdf"'},
    )
