import io

from openai import AsyncOpenAI

_client = AsyncOpenAI()


async def transcribe(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    buf = io.BytesIO(audio_bytes)
    buf.name = filename
    response = await _client.audio.transcriptions.create(
        model="whisper-1",
        file=buf,
        response_format="text",
    )
    return response.strip()
