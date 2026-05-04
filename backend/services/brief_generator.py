from openai import AsyncOpenAI

from agent.prompts import BRIEF_GENERATION
from models import BriefLLMOutput, IntakeBrief

client = AsyncOpenAI()


async def generate_brief(session_id: str, messages: list[dict]) -> IntakeBrief:
    """Generate structured IntakeBrief from full conversation history."""
    transcript = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in messages
    )

    response = await client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": BRIEF_GENERATION},
            {"role": "user", "content": transcript},
        ],
        response_format=BriefLLMOutput,
    )

    output = response.choices[0].message.parsed
    if output is None:
        return IntakeBrief(session_id=session_id)

    ros = {
        system: finding
        for system, finding in output.ros.model_dump().items()
        if finding is not None
    }

    return IntakeBrief(
        session_id=session_id,
        cc=output.cc,
        hpi=output.hpi,
        ros=ros,
    )
