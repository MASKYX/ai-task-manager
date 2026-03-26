import requests
import json

url = "http://127.0.0.1:8000/plan"

payload = {
    "userMessage": "Plan various study sessions this for tomorrow afternoon with break times.",
    "upcomingEvents": [
        {
            "id": "1",
            "summary": "Team meeting",
            "description": "Weekly sync",
            "startDateTime": "2026-03-27T09:00:00Z",
            "endDateTime": "2026-03-27T10:00:00Z",
            "allDay": False
        }
    ],
    "commonSchedules": []
}

response = requests.post(url, json=payload)

print("Status code:", response.status_code)
print("Response body:")
try:
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
except Exception:
    print(response.text)