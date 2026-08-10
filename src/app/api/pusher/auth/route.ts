import Pusher from "pusher";
import { NextRequest, NextResponse } from "next/server";

function getPusher() {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    return null;
  }

  return new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });
}

export async function POST(request: NextRequest) {
  const pusher = getPusher();
  if (!pusher) {
    return NextResponse.json(
      { error: "Pusher is not configured" },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const socketId = String(formData.get("socket_id") ?? "");
  const channelName = String(formData.get("channel_name") ?? "");

  if (!socketId || !channelName.startsWith("presence-")) {
    return NextResponse.json({ error: "Invalid presence request" }, { status: 400 });
  }

  const headerId = request.headers.get("x-user-id");
  const userId =
    headerId && /^[a-zA-Z0-9_-]{8,64}$/.test(headerId)
      ? headerId
      : crypto.randomUUID();

  const auth = pusher.authorizeChannel(socketId, channelName, {
    user_id: userId,
    user_info: { role: "listener" },
  });

  return NextResponse.json(auth);
}
