<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the server-side Convex backend. A shared `convex/posthog.ts` helper creates a short-lived, serverless-safe PostHog client (flushAt=1, flushInterval=0, shutdown() on every invocation). Events are captured directly in Convex `action` handlers, and via `ctx.scheduler.runAfter(0, ...)` in Convex `mutation` handlers (which cannot make external HTTP calls). Environment variables `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` are set in `.env`.

| Event | Description | File |
|---|---|---|
| `payment completed` | Fires when a Stripe `checkout.session.completed` webhook is processed and a purchase record is created. | `convex/stripe.ts` |
| `lead submitted` | Fires when a user submits the roadmap quiz form and the lead is successfully saved. | `convex/leads.ts` |
| `access code redeemed` | Fires when a new user redeems an access code for the first time, creating their account. | `convex/auth.ts` |
| `user logged in` | Fires when a returning user logs back in with their previously-used access code. | `convex/auth.ts` |
| `quiz completed` | Fires when a user submits a quiz attempt, with score, pass/fail, category, and time spent. | `convex/quizzes.ts` |
| `diagnostic completed` | Fires when a user completes the free diagnostic quiz, with overall score, level, and time spent. | `convex/diagnostic.ts` |
| `resource downloaded` | Fires when an authenticated user downloads a resource unlocked by passing a quiz. | `convex/resources.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics:** https://us.posthog.com/project/217363/dashboard/1548746
- **Payments & Leads Conversion Funnel:** https://us.posthog.com/project/217363/insights/jx09hEfW
- **New Leads Over Time:** https://us.posthog.com/project/217363/insights/Ax1JSv0K
- **Quiz Completions Over Time (by pass/fail):** https://us.posthog.com/project/217363/insights/1sApuUtO
- **Diagnostic Score Distribution (by level):** https://us.posthog.com/project/217363/insights/j4PptTn7
- **Resource Downloads Over Time:** https://us.posthog.com/project/217363/insights/NQZMb4MS

> **Note:** Set `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` in your Convex deployment environment variables (via the Convex dashboard) so events are captured in production. Local `.env` values only apply when running `bunx convex dev`.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
