import asyncio
import base64
import os

from elevenlabs.client import ElevenLabs

_client = ElevenLabs(api_key=os.environ.get("ELEVENLABS_API_KEY", ""))
VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "")


def _synthesize_blocking(text: str) -> str:
    audio_bytes = b"".join(
        _client.text_to_speech.convert(
            voice_id=VOICE_ID,
            text=text,
            model_id="eleven_turbo_v2",
            output_format="mp3_44100_128",
        )
    )
    return base64.b64encode(audio_bytes).decode()


async def synthesize(text: str) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _synthesize_blocking, text)
