import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Cross-tab signaling for the notifications inbox.
 *
 * The bell polls every 30 s, which is fine for catching pings
 * from the backend but lags noticeably when the same user
 * marks a notification read in another tab — the badge in this
 * tab would stay stale until the next poll. A ``BroadcastChannel``
 * round-trips intra-browser state between tabs in O(ms), so the
 * tab that fires the mutation pings every other open tab and
 * each one drops its ``["notifications"]`` query immediately.
 *
 * The helpers below degrade to no-ops on browsers without
 * ``BroadcastChannel`` (older Safari, ancient mobile webviews) —
 * the inbox just relies on the poll as before.
 */

const CHANNEL_NAME = "homeflix-notifications";

interface BroadcastPayload {
  /** Discriminator left in place so we can split future
   *  event types (e.g. "deleted") without renaming the channel. */
  kind: "invalidate";
}

/**
 * Lazy-initialised module-level singleton. ``null`` when
 * ``BroadcastChannel`` is unavailable; the publisher / subscriber
 * functions silently no-op in that case.
 */
let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  if (typeof BroadcastChannel === "undefined") {
    channel = null;
    return null;
  }
  channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

/**
 * Broadcast a "the notifications inbox changed" signal to every
 * other tab. Call from any mutation that mutates the inbox so
 * sibling tabs refetch immediately instead of waiting for their
 * 30 s poll.
 */
export function notifyOtherTabs(): void {
  const ch = getChannel();
  if (!ch) return;
  const payload: BroadcastPayload = { kind: "invalidate" };
  // ``postMessage`` is fire-and-forget; failures (e.g. closed
  // channel after navigation) shouldn't break the mutation.
  try {
    ch.postMessage(payload);
  } catch {
    /* swallowed by design — best-effort cross-tab nudge */
  }
}

/**
 * Subscribe the calling component to cross-tab ``["notifications"]``
 * invalidations. Mount once from the bell component (or anywhere
 * that wants live updates without polling); the listener
 * unregisters on unmount.
 *
 * Note: ``BroadcastChannel`` does not fan messages back to the
 * tab that posted them, so the dispatching tab still relies on
 * the mutation's own ``onSuccess`` invalidation for its own
 * refresh.
 */
export function useNotificationsCrossTabSync(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    const ch = getChannel();
    if (!ch) return;
    const handler = (event: MessageEvent<BroadcastPayload>) => {
      if (event.data.kind !== "invalidate") return;
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };
    ch.addEventListener("message", handler);
    return () => {
      ch.removeEventListener("message", handler);
    };
  }, [queryClient]);
}
