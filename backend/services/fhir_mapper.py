"""
Maps an IntakeBrief dict to a self-contained FHIR R4 document Bundle.
All references use urn:uuid: so no FHIR server is required to resolve them.
"""

import uuid
from datetime import datetime, timezone

# LOINC codes for ROS systems
_ROS_LOINC: dict[str, tuple[str, str]] = {
    "constitutional": ("10187-3", "Review of systems - Constitutional"),
    "cardiovascular": ("10200-4", "Review of systems - Cardiovascular"),
    "respiratory":    ("10221-0", "Review of systems - Respiratory"),
    "gastrointestinal": ("10191-5", "Review of systems - Gastrointestinal"),
    "musculoskeletal": ("10196-4", "Review of systems - Musculoskeletal"),
    "neurological":   ("10202-0", "Review of systems - Neurological"),
}


def _loinc(code: str, display: str) -> dict:
    return {"coding": [{"system": "http://loinc.org", "code": code, "display": display}]}


def _div(text: str) -> str:
    escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f'<div xmlns="http://www.w3.org/1999/xhtml">{escaped}</div>'


def brief_to_fhir_bundle(session_id: str, brief: dict) -> dict:
    """Return a FHIR R4 Bundle (type: document) for the given IntakeBrief."""
    now = datetime.now(timezone.utc).isoformat()

    patient_id  = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"patient-{session_id}"))
    encounter_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"encounter-{session_id}"))

    patient_ref  = f"urn:uuid:{patient_id}"
    encounter_ref = f"urn:uuid:{encounter_id}"

    entries: list[dict] = []

    # --- Patient (stub — no PHI until EHR integration) ---
    entries.append({
        "fullUrl": patient_ref,
        "resource": {
            "resourceType": "Patient",
            "id": patient_id,
            "active": True,
            "identifier": [{"value": session_id}],
        },
    })

    # --- Encounter ---
    entries.append({
        "fullUrl": encounter_ref,
        "resource": {
            "resourceType": "Encounter",
            "id": encounter_id,
            "status": "finished",
            "class": {
                "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                "code": "AMB",
                "display": "ambulatory",
            },
            "type": [_loinc("11429006", "Consultation")],
            "subject": {"reference": patient_ref},
        },
    })

    composition_sections: list[dict] = []
    section_obs_refs: list[dict] = []

    # --- Chief Complaint ---
    if brief.get("cc"):
        obs_id = str(uuid.uuid4())
        entries.append({
            "fullUrl": f"urn:uuid:{obs_id}",
            "resource": {
                "resourceType": "Observation",
                "id": obs_id,
                "status": "final",
                "code": _loinc("10154-3", "Chief complaint Narrative - Reported"),
                "subject": {"reference": patient_ref},
                "encounter": {"reference": encounter_ref},
                "valueString": brief["cc"],
            },
        })
        composition_sections.append({
            "title": "Chief Complaint",
            "code": _loinc("10154-3", "Chief complaint Narrative - Reported"),
            "text": {"status": "generated", "div": _div(brief["cc"])},
            "entry": [{"reference": f"urn:uuid:{obs_id}"}],
        })

    # --- HPI ---
    if brief.get("hpi"):
        obs_id = str(uuid.uuid4())
        entries.append({
            "fullUrl": f"urn:uuid:{obs_id}",
            "resource": {
                "resourceType": "Observation",
                "id": obs_id,
                "status": "final",
                "code": _loinc("10164-2", "History of Present Illness Narrative"),
                "subject": {"reference": patient_ref},
                "encounter": {"reference": encounter_ref},
                "valueString": brief["hpi"],
            },
        })
        composition_sections.append({
            "title": "History of Present Illness",
            "code": _loinc("10164-2", "History of Present Illness Narrative"),
            "text": {"status": "generated", "div": _div(brief["hpi"])},
            "entry": [{"reference": f"urn:uuid:{obs_id}"}],
        })

    # --- ROS ---
    ros = {k: v for k, v in (brief.get("ros") or {}).items() if v}
    if ros:
        ros_entries: list[dict] = []
        for system, finding in ros.items():
            loinc_code, loinc_display = _ROS_LOINC.get(
                system, ("10187-3", f"Review of systems - {system.replace('_', ' ').title()}")
            )
            obs_id = str(uuid.uuid4())
            entries.append({
                "fullUrl": f"urn:uuid:{obs_id}",
                "resource": {
                    "resourceType": "Observation",
                    "id": obs_id,
                    "status": "final",
                    "code": _loinc(loinc_code, loinc_display),
                    "subject": {"reference": patient_ref},
                    "encounter": {"reference": encounter_ref},
                    "valueString": finding,
                },
            })
            ros_entries.append({"reference": f"urn:uuid:{obs_id}"})

        ros_text = "; ".join(f"{k.replace('_', ' ').title()}: {v}" for k, v in ros.items())
        composition_sections.append({
            "title": "Review of Systems",
            "code": _loinc("10187-3", "Review of systems"),
            "text": {"status": "generated", "div": _div(ros_text)},
            "entry": ros_entries,
        })

    # --- Composition (document index) ---
    comp_id = str(uuid.uuid4())
    entries.append({
        "fullUrl": f"urn:uuid:{comp_id}",
        "resource": {
            "resourceType": "Composition",
            "id": comp_id,
            "status": "final",
            "type": _loinc("34109-9", "Note"),
            "date": now,
            "title": "Clinical Intake Note",
            "subject": {"reference": patient_ref},
            "encounter": {"reference": encounter_ref},
            "author": [{"display": "Clinical Intake Agent"}],
            "section": composition_sections,
        },
    })

    return {
        "resourceType": "Bundle",
        "id": str(uuid.uuid4()),
        "meta": {"lastUpdated": now},
        "type": "document",
        "timestamp": now,
        "entry": entries,
    }
