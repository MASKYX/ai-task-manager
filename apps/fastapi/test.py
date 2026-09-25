import asyncio
import unittest
from unittest.mock import patch
from types import SimpleNamespace
from google.genai.errors import ServerError

from fastapi import HTTPException
from main import FALLBACK_MODEL, PRIMARY_MODEL, PlanningRequest, plan


class PlanningTests(unittest.TestCase):
    def setUp(self):
        self.request = PlanningRequest.model_validate({
            "context": {"provider": "LOCAL", "events": [], "temporal": {
                "currentDate": "2026-09-23", "currentTime": "14:30:00+02:00",
                "dayOfWeek": "WEDNESDAY", "timezone": "Europe/Madrid"
            }},
            "preferences": "Mornings", "request": "Add a meeting"
        })

    @patch("main.genai.Client")
    def test_actions(self, client):
        client.return_value.__enter__.return_value.models.generate_content.return_value.text = (
            '{"comment":"Please confirm.","actions":[{"type":"CREATE_EVENT",'
            '"summary":"Meeting","startDateTime":"2026-09-22T09:00:00Z",'
            '"endDateTime":"2026-09-22T10:00:00Z","allDay":false}]}')
        result = asyncio.run(plan(self.request))
        self.assertEqual(result.actions[0].type, "CREATE_EVENT")
        client.return_value.__exit__.assert_called_once()
        self.assertEqual(client.return_value.__enter__.return_value.models.generate_content.call_args.kwargs["model"], PRIMARY_MODEL)
        self.assertEqual(client.return_value.__enter__.return_value.models.generate_content.call_args.kwargs["config"]["response_mime_type"], "application/json")
        self.assertFalse(client.return_value.__enter__.return_value.models.generate_content.call_args.kwargs["config"]["response_json_schema"]["additionalProperties"])

    @patch("main.genai.Client")
    def test_comment_only(self, client):
        client.return_value.__enter__.return_value.models.generate_content.return_value.text = '{"comment":"Your calendar is clear."}'
        result = asyncio.run(plan(self.request))
        self.assertEqual(result.actions, [])

    @patch("main.genai.Client")
    def test_invalid_action(self, client):
        client.return_value.__enter__.return_value.models.generate_content.return_value.text = (
            '{"comment":"Done","actions":[{"type":"HACK"}]}')
        with self.assertRaises(HTTPException) as error:
            asyncio.run(plan(self.request))
        self.assertEqual(error.exception.status_code, 502)

    @patch("main.genai.Client")
    def test_google_multi_action_proposal(self, client):
        request = self.request.model_copy(update={"context": self.request.context.model_copy(update={"provider": "GOOGLE"})})
        action = ('{"type":"CREATE_EVENT","summary":"Gym",'
                  '"startDateTime":"2026-09-22","endDateTime":"2026-09-23","allDay":true}')
        client.return_value.__enter__.return_value.models.generate_content.return_value.text = (
            '{"comment":"Confirm.","actions":[' + action + ',' + action + ']}')
        result = asyncio.run(plan(request))
        self.assertEqual(len(result.actions), 2)

    @patch("main.genai.Client")
    def test_history_is_included_in_model_prompt(self, client):
        request = PlanningRequest.model_validate({
            **self.request.model_dump(),
            "history": [{"role": "USER", "content": "Earlier request"}],
        })
        client.return_value.__enter__.return_value.models.generate_content.return_value.text = (
            '{"comment":"Follow-up received.","actions":[]}')
        asyncio.run(plan(request))
        prompt = client.return_value.__enter__.return_value.models.generate_content.call_args.kwargs["contents"]
        self.assertIn("Earlier request", prompt)

    @patch("main.genai.Client")
    def test_temporal_context_is_included_in_model_prompt(self, client):
        client.return_value.__enter__.return_value.models.generate_content.return_value.text = (
            '{"comment":"Today is Wednesday.","actions":[]}')
        asyncio.run(plan(self.request))
        prompt = client.return_value.__enter__.return_value.models.generate_content.call_args.kwargs["contents"]
        self.assertIn('"currentDate": "2026-09-23"', prompt)
        self.assertIn('"currentTime": "14:30:00+02:00"', prompt)
        self.assertIn('"dayOfWeek": "WEDNESDAY"', prompt)
        self.assertIn('"timezone": "Europe/Madrid"', prompt)
        self.assertIn("authoritative current date", prompt)

    @patch("main.genai.Client")
    def test_falls_back_on_model_unavailable(self, client):
        unavailable = ServerError(503, {"error": {"code": 503, "status": "UNAVAILABLE", "message": "busy"}})
        generator = client.return_value.__enter__.return_value.models.generate_content
        generator.side_effect = [unavailable, SimpleNamespace(text='{"comment":"No changes needed.","actions":[]}')]
        result = asyncio.run(plan(self.request))
        self.assertEqual(result.actions, [])
        self.assertEqual([call.kwargs["model"] for call in generator.call_args_list],
                         [PRIMARY_MODEL, FALLBACK_MODEL])

    @patch("main.genai.Client")
    def test_busy_provider_has_clear_error(self, client):
        unavailable = ServerError(503, {"error": {"code": 503, "status": "UNAVAILABLE", "message": "busy"}})
        client.return_value.__enter__.return_value.models.generate_content.side_effect = unavailable
        with self.assertRaises(HTTPException) as error:
            asyncio.run(plan(self.request))
        self.assertEqual(error.exception.status_code, 503)
        self.assertIn("busy", error.exception.detail)

    @patch("main.genai.Client")
    def test_ai_failure(self, client):
        client.return_value.__enter__.return_value.models.generate_content.side_effect = RuntimeError("secret")
        with self.assertRaises(HTTPException) as error:
            asyncio.run(plan(self.request))
        self.assertEqual(error.exception.status_code, 502)
        self.assertNotIn("secret", error.exception.detail)


    def test_oversized_request_is_rejected(self):
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            PlanningRequest.model_validate({
                **self.request.model_dump(), "request": "x" * 4001
            })

    @patch("main.genai.Client")
    def test_unknown_event_id_from_ai_is_rejected(self, client):
        client.return_value.__enter__.return_value.models.generate_content.return_value.text = (
            '{"comment":"Delete it","actions":[{"type":"DELETE_EVENT","eventId":"another-user-event"}]}')
        with self.assertRaises(HTTPException) as error:
            asyncio.run(plan(self.request))
        self.assertEqual(error.exception.status_code, 502)

if __name__ == "__main__":
    unittest.main()
