from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


# --- Stage extraction models (used during conversation, one call per stage) ---

class CCExtraction(BaseModel):
    is_complete: bool = False
    cc_statement: Optional[str] = None
    onset: Optional[str] = None
    location: Optional[str] = None
    duration: Optional[str] = None
    character: Optional[str] = None
    aggravating: Optional[str] = None
    relieving: Optional[str] = None
    timing: Optional[str] = None
    severity: Optional[str] = None


class HPIExtraction(BaseModel):
    is_complete: bool = False
    narrative: Optional[str] = None
    onset: Optional[str] = None
    location: Optional[str] = None
    duration: Optional[str] = None
    character: Optional[str] = None
    aggravating: Optional[str] = None
    relieving: Optional[str] = None
    timing: Optional[str] = None
    severity: Optional[str] = None
    associated_symptoms: Optional[str] = None


class ROSExtraction(BaseModel):
    is_complete: bool = False
    constitutional: Optional[str] = None
    cardiovascular: Optional[str] = None
    respiratory: Optional[str] = None
    gastrointestinal: Optional[str] = None
    musculoskeletal: Optional[str] = None
    neurological: Optional[str] = None
    other: Optional[str] = None


# --- Brief generation output (LLM returns this, then assembled into IntakeBrief) ---

class ROSBrief(BaseModel):
    constitutional: Optional[str] = None
    cardiovascular: Optional[str] = None
    respiratory: Optional[str] = None
    gastrointestinal: Optional[str] = None
    musculoskeletal: Optional[str] = None
    neurological: Optional[str] = None


class BriefLLMOutput(BaseModel):
    cc: str
    hpi: str  # multi-paragraph narrative prose
    ros: ROSBrief


# --- Final stored brief ---

class IntakeBrief(BaseModel):
    session_id: str
    cc: str = ""
    hpi: str = ""  # narrative prose
    ros: dict[str, str] = Field(default_factory=dict)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
