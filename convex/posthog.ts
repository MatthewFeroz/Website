import { PostHog } from "posthog-node";

/**
 * Create a short-lived PostHog client suitable for a single Convex action
 * invocation. Convex actions are serverless-style: each invocation is
 * short-lived, so we set flushAt=1 / flushInterval=0 and always call
 * shutdown() so every event is flushed before the action returns.
 */
export function getPostHogClient(): PostHog {
  const key = process.env.POSTHOG_PROJECT_TOKEN;
  const host = process.env.POSTHOG_HOST;
  if (!key) {
    throw new Error("Missing POSTHOG_PROJECT_TOKEN environment variable");
  }
  if (!host) {
    throw new Error("Missing POSTHOG_HOST environment variable");
  }
  return new PostHog(key, {
    host,
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
  });
}
