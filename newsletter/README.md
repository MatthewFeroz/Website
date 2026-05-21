# NYC AI Events Newsletter

This folder contains the reusable Resend broadcast template for the How AI Works / NYC AI Events newsletter.

Resend resources created:

- Segment: `NYC AI Events`
  - ID: `44bab4be-c391-40b0-aa87-c35b7addf73a`
- Topic: `NYC AI Events`
  - ID: `4acd0291-67fd-4817-ae17-aa079c750315`
- Broadcast draft:
  - ID: `fbd2dd52-280d-4ca3-a7a1-e85fa38d68d4`
  - From: `How AI Works <events@matthewferoz.com>`
  - Reply-to: `Matthew Feroz <matt@matthewferoz.com>`

Files:

- `nyc-ai-events-issue-template.html` — HTML broadcast template
- `nyc-ai-events-issue-template.txt` — plain-text fallback

The `/events/` page signup form posts to Convex:

`https://grateful-pony-674.convex.site/newsletter/subscribe`

Convex env vars needed in production:

- `RESEND_API_KEY`
- Optional override: `RESEND_NYC_AI_EVENTS_SEGMENT_ID`
- Optional override: `RESEND_NYC_AI_EVENTS_TOPIC_ID`

The code has fallback IDs for the segment/topic above, so only `RESEND_API_KEY` is required if those IDs stay the same.
