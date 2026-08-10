"use client";

import { useEffect, useState } from "react";
import Pusher, { type PresenceChannel } from "pusher-js";

const VISITOR_KEY = "siteplaylist:visitor-id";
const CHANNEL = "presence-site";

function getVisitorId() {
  const existing = window.sessionStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.sessionStorage.setItem(VISITOR_KEY, id);
  return id;
}

export function OnlineCount({ className = "" }: { className?: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) return;

    const visitorId = getVisitorId();
    const pusher = new Pusher(key, {
      cluster,
      authEndpoint: "/api/pusher/auth",
      auth: {
        headers: {
          "x-user-id": visitorId,
        },
      },
    });

    const channel = pusher.subscribe(CHANNEL) as PresenceChannel;

    const sync = () => setCount(channel.members.count);
    channel.bind("pusher:subscription_succeeded", sync);
    channel.bind("pusher:member_added", sync);
    channel.bind("pusher:member_removed", sync);

    return () => {
      channel.unbind("pusher:subscription_succeeded", sync);
      channel.unbind("pusher:member_added", sync);
      channel.unbind("pusher:member_removed", sync);
      pusher.unsubscribe(CHANNEL);
      pusher.disconnect();
    };
  }, []);

  if (count == null) return null;

  return (
    <p
      className={`inline-flex items-center gap-1.5 text-white/75 ${className}`}
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
        <span className="animate-live-dot absolute inset-0 rounded-full bg-emerald-400" />
        <span className="relative h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
      </span>
      <span className="tabular-nums">{count} listening</span>
    </p>
  );
}
