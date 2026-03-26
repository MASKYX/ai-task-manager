from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from google import genai
import os
import json

app = FastAPI()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

class CalendarEventDto(BaseModel):
    id: Optional[str] = None
    summary: Optional[str] = None
    description: Optional[str] = None
    startDateTime: Optional[str] = None
    endDateTime: Optional[str] = None
    allDay: bool = False


class CommonScheduleDto(BaseModel):
    name: str
    preferredStartTime: Optional[str] = None
    preferredDurationMinutes: Optional[int] = None


class PlanningRequest(BaseModel):
    userMessage: str
    upcomingEvents: List[CalendarEventDto] = Field(default_factory=list)
    commonSchedules: List[CommonScheduleDto] = Field(default_factory=list)


class PlannedAction(BaseModel):
    type: Literal["CREATE_EVENT", "UPDATE_EVENT", "DELETE_EVENT"]
    eventId: Optional[str] = None
    summary: Optional[str] = None
    description: Optional[str] = None
    startDateTime: Optional[str] = None
    endDateTime: Optional[str] = None
    allDay: Optional[bool] = None


class PlanningResponse(BaseModel):
    plan: str
    actions: List[PlannedAction] = Field(default_factory=list)
    needsConfirmation: bool = True


SYSTEM_PROMPT = """
You are an AI planning assistant for a task manager app.

You receive:
- a user message
- a list of upcoming calendar events
- a list of common schedule templates

Your job:
1. Understand the user's intention
2. Propose a short plan
3. Return a list of actions if needed

Rules:
- Return only valid JSON
- Allowed action types: CREATE_EVENT, UPDATE_EVENT, DELETE_EVENT
- If no action is needed, return an empty actions list
- Be conservative if the request is unclear
"""


@app.post("/plan", response_model=PlanningResponse)
async def plan(request: PlanningRequest):
    try:
        example_output = {
            "plan": "There is a free slot tomorrow morning before the existing meeting, so scheduling gym from 07:30 to 08:30 is a reasonable option.",
            "actions": [
                {
                    "type": "CREATE_EVENT",
                    "summary": "Gym",
                    "description": "Suggested by AI planner",
                    "startDateTime": "2026-03-27T07:30:00Z",
                    "endDateTime": "2026-03-27T08:30:00Z",
                    "allDay": False
                }
            ],
            "needsConfirmation": True
        }

        prompt = (
            SYSTEM_PROMPT
            + "\n\nRequest data:\n"
            + json.dumps(request.model_dump(), ensure_ascii=False, indent=2)
            + "\n\nReturn JSON with this shape:\n"
            + json.dumps(example_output, ensure_ascii=False, indent=2)
        )

        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt,
        )

        text = response.text.strip()

        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("json"):
                text = text[4:].strip()

        data = json.loads(text)
        return PlanningResponse(**data)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))