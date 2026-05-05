from elevenlabs.client import AsyncElevenLabs

_client = AsyncElevenLabs()


async def transcribe(audio_bytes: bytes) -> str:
    response = await _client.speech_to_text.convert(
        audio=audio_bytes,
        model_id="scribe_v2",
    )
    return response.text.strip()
