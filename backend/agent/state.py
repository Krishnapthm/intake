from typing import Literal, Optional
from typing_extensions import TypedDict


class IntakeState(TypedDict, total=False):
    session_id: str
    stage: Literal["greeting", "cc", "hpi", "ros", "closing", "done"]
    messages: list[dict]
    # Extracted data per section
    cc_data: dict          # holds extracted CC fields
    hpi_data: dict         # holds extracted HPI fields
    ros_data: dict         # holds extracted ROS findings
    brief: dict
    turns_in_stage: int
    agent_response: str
    _pending_user_msg: str
    _stage_complete: bool  # explicit flag set by extraction
