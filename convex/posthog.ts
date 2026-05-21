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
  if (!key) {
    throw new Error("Missing POSTHOG_PROJECT_TOKEN environment variable");
  }
  if (!host) {
    throw new Error("Missing POSTHOG_HOST environment variable");
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
