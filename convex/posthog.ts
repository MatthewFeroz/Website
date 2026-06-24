type CaptureArgs = {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
};

type QueuedEvent = {
  api_key: string;
  event: string;
  distinct_id: string;
  properties?: Record<string, unknown>;
};

/**
 * Minimal PostHog client for Convex's default runtime.
 *
 * Avoid importing `posthog-node` here: that package uses Node built-ins
 * (`path`, `node:fs`, `node:readline`) and breaks Convex functions that run
 * outside the Node.js runtime.
 */
export function getPostHogClient() {
  const key = process.env.POSTHOG_PROJECT_TOKEN;
  const host = process.env.POSTHOG_HOST;

  // Analytics is non-critical. If PostHog isn't configured, return a no-op
  // client instead of throwing — a missing env var must never break the
  // user-facing flow that fired the event (lead capture, auth, checkout, etc.).
  if (!key || !host) {
    if (!key) {
      console.warn("PostHog disabled: missing POSTHOG_PROJECT_TOKEN");
    }
    if (!host) {
      console.warn("PostHog disabled: missing POSTHOG_HOST");
    }
    return {
      capture(_args: CaptureArgs) {},
      async shutdown() {},
    };
  }

  const events: QueuedEvent[] = [];

  return {
    capture({ distinctId, event, properties }: CaptureArgs) {
      events.push({
        api_key: key,
        event,
        distinct_id: distinctId,
        properties,
      });
    },

    async shutdown() {
      await Promise.all(
        events.map(async (payload) => {
          const response = await fetch(`${host.replace(/\/$/, "")}/capture/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            console.warn("PostHog capture failed", response.status, await response.text());
          }
        }),
      );
      events.length = 0;
    },
  };
}
