from openai import AsyncOpenAI
from . import prompts
from .state import IntakeState
from models import CCExtraction, HPIExtraction, ROSExtraction

_client = AsyncOpenAI()

STAGE_MAX_TURNS = {
    "greeting": 2,
    "cc": 5,
    "hpi": 10,
    "ros": 8,
    "closing": 1,
}

STAGE_ORDER = ["greeting", "cc", "hpi", "ros", "closing", "done"]

STAGE_PROMPTS = {
    "greeting": prompts.GREETING,
    "cc": prompts.CC,
    "hpi": prompts.HPI,
    "ros": prompts.ROS,
    "closing": prompts.CLOSING,
}

# Extraction prompts — silent, never spoken
EXTRACTION_PROMPTS = {
    "cc": prompts.CC_EXTRACTION,
    "hpi": prompts.HPI_EXTRACTION,
    "ros": prompts.ROS_EXTRACTION,
}

EXTRACTION_MODELS = {
    "cc": CCExtraction,
    "hpi": HPIExtraction,
    "ros": ROSExtraction,
}


def next_stage(current: str) -> str:
    idx = STAGE_ORDER.index(current)
    return STAGE_ORDER[min(idx + 1, len(STAGE_ORDER) - 1)]


async def _check_stage_complete(stage: str, messages: list[dict]) -> tuple[bool, dict]:
    """Silent LLM call to check if stage has sufficient data. Returns (is_complete, extracted_data)."""
    extraction_prompt = EXTRACTION_PROMPTS.get(stage)
    model_cls = EXTRACTION_MODELS.get(stage)
    if not extraction_prompt or not model_cls:
        return False, {}

    response = await _client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": extraction_prompt},
            *messages,
            {"role": "user", "content": "Extract the data and assess completeness based on the conversation so far."},
        ],
        response_format=model_cls,
        max_tokens=400,
    )

    result = response.choices[0].message.parsed
    if result is None:
        return False, {}

    is_complete = result.is_complete
    data = result.model_dump(exclude={"is_complete"}, exclude_none=True)
    return is_complete, data


async def process_turn(state: dict) -> dict:
    stage = state.get("stage", "greeting")
    turns = state.get("turns_in_stage", 0)
    existing_messages = list(state.get("messages", []))
    pending_user_msg = state.get("_pending_user_msg", "")

    # Build messages for this turn
    messages_for_llm = existing_messages.copy()
    if pending_user_msg:
        messages_for_llm.append({"role": "user", "content": pending_user_msg})

    system_prompt = STAGE_PROMPTS.get(stage, prompts.GREETING)

    # Main dialogue call — what the agent says to the user
    response = await _client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "system", "content": system_prompt}] + messages_for_llm,
        max_tokens=150,  # Keep responses concise for TTS
    )

    agent_text = (response.choices[0].message.content or "").strip()

    # Determine if stage should advance
    should_advance = False
    extracted_data = {}

    new_turns = turns + 1

    # Check stage completion after user responds (not on greeting's first turn)
    if pending_user_msg and stage in EXTRACTION_PROMPTS:
        should_advance, extracted_data = await _check_stage_complete(stage, messages_for_llm)

    # Hard cap: force advance if max turns reached
    if new_turns >= STAGE_MAX_TURNS.get(stage, 1):
        should_advance = True

    # Special case: greeting advances only after user has said something
    if stage == "greeting" and pending_user_msg:
        should_advance = True

    new_stage = next_stage(stage) if should_advance else stage
    reset_turns = 0 if should_advance else new_turns

    # Update message history
    updated_messages = list(existing_messages)
    if pending_user_msg:
        updated_messages.append({"role": "user", "content": pending_user_msg})
    updated_messages.append({"role": "assistant", "content": agent_text})

    # Merge extracted data into state
    update = {
        **state,
        "messages": updated_messages,
        "stage": new_stage,
        "turns_in_stage": reset_turns,
        "agent_response": agent_text,
        "_pending_user_msg": "",
    }

    # Store extracted section data
    if extracted_data:
        data_key = f"{stage}_data"
        update[data_key] = {**state.get(data_key, {}), **extracted_data}

    return update
