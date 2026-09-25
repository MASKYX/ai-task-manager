import json
import logging
import os
from datetime import date, datetime
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from google import genai
from google.genai.errors import ServerError
from pydantic import BaseModel, ConfigDict, Field, model_validator

load_dotenv()
app = FastAPI()
logger = logging.getLogger(__name__)
PRIMARY_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
FALLBACK_MODEL = "gemini-2.5-flash-lite"


class CalendarEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str | None = None
    summary: str | None = None
    description: str | None = None
    startDateTime: str | None = None
    endDateTime: str | None = None
    allDay: bool = False


class TemporalContext(BaseModel):
    model_config = ConfigDict(extra="forbid")
    currentDate: date
    currentTime: str = Field(min_length=1)
    dayOfWeek: Literal["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
    timezone: str = Field(min_length=1)


class CalendarContext(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider: Literal["LOCAL", "GOOGLE"]
    events: list[CalendarEvent]
    temporal: TemporalContext


class CalendarAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["CREATE_EVENT", "UPDATE_EVENT", "DELETE_EVENT"]
    eventId: str | None = None
    summary: str | None = None
    description: str | None = None
    startDateTime: str | None = None
    endDateTime: str | None = None
    allDay: bool | None = None

    @model_validator(mode="after")
    def validate_fields(self):
        if self.type == "CREATE_EVENT" and self.eventId:
            raise ValueError("CREATE_EVENT must not have an event ID")
        if self.type != "CREATE_EVENT" and not self.eventId:
            raise ValueError("An existing event ID is required")
        if self.type == "DELETE_EVENT":
            if self.summary is not None or self.startDateTime is not None or self.endDateTime is not None:
                raise ValueError("DELETE_EVENT must only identify an event")
            return self
        if not self.summary or not self.startDateTime or not self.endDateTime or self.allDay is None:
            raise ValueError("Event details are required")
        if self.allDay:
            start = date.fromisoformat(self.startDateTime)
            end = date.fromisoformat(self.endDateTime)
        else:
            start = datetime.fromisoformat(self.startDateTime.replace("Z", "+00:00"))
            end = datetime.fromisoformat(self.endDateTime.replace("Z", "+00:00"))
            if start.tzinfo is None or end.tzinfo is None:
                raise ValueError("Timed events require timezone offsets")
        if end <= start:
            raise ValueError("Event end must follow its start")
        return self


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["USER", "ASSISTANT"]
    content: str = Field(min_length=1)
    actions: list[CalendarAction] | None = None


class PlanningRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    context: CalendarContext
    preferences: str | None = None
    request: str = Field(min_length=1)
    history: list[ChatMessage] = Field(default_factory=list)


class PlanningResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    comment: str = Field(min_length=1)
    actions: list[CalendarAction] = Field(default_factory=list)


SYSTEM_PROMPT = """You propose calendar actions for a task manager. Never execute changes.
Use the complete calendar context, user preferences, and conversation history. Keep the comment concise.
Treat context.temporal as the authoritative current date, time, day of week, and timezone for all relative dates.
Never say an action has already been executed. Describe actions as proposals awaiting confirmation.
Return only the structured response. If no change is needed, return a comment and an empty actions list.
Only use CREATE_EVENT, UPDATE_EVENT, or DELETE_EVENT. For updates and deletes, use an ID from context. For updates, include the complete event details.
For all-day events, use YYYY-MM-DD dates with an exclusive end date. For timed events, use ISO 8601 timestamps with offsets.
You may propose multiple actions for either calendar provider. Every proposed action still requires user confirmation."""


@app.post("/plan", response_model=PlanningResponse)
async def plan(request: PlanningRequest):
    prompt = SYSTEM_PROMPT + "\n\n" + json.dumps(request.model_dump(mode="json"), ensure_ascii=False)
    config = {
        "response_mime_type": "application/json",
        "response_json_schema": PlanningResponse.model_json_schema(),
    }
    try:
        with genai.Client(api_key=os.getenv("GEMINI_API_KEY")) as client:
            try:
                response = client.models.generate_content(
                    model=PRIMARY_MODEL, contents=prompt, config=config,
                )
            except ServerError as exc:
                if exc.code != 503 or PRIMARY_MODEL == FALLBACK_MODEL:
                    raise
                logger.warning("Primary Gemini model unavailable; using fallback model")
                response = client.models.generate_content(
                    model=FALLBACK_MODEL, contents=prompt, config=config,
                )
    except ServerError as exc:
        if exc.code == 503:
            logger.warning("Gemini models are temporarily unavailable")
            raise HTTPException(status_code=503, detail="AI provider is busy. Please retry shortly.") from exc
        logger.exception("Gemini request failed")
        raise HTTPException(status_code=502, detail="AI provider request failed") from exc
    except Exception as exc:
        logger.exception("Gemini request failed")
        raise HTTPException(status_code=502, detail="AI provider request failed") from exc

    try:
        result = PlanningResponse.model_validate_json(response.text)
        known_ids = {event.id for event in request.context.events}
        if any(action.eventId not in known_ids for action in result.actions if action.eventId):
            raise ValueError("AI referenced an unknown event")
        return result
    except Exception as exc:
        logger.exception("AI response validation failed")
        raise HTTPException(status_code=502, detail="AI response processing failed") from exc
