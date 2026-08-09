import { BuswalePlayer } from "@/components/buswale-player";
import { getPlaylist } from "@/data/playlists";

export default function Page() {
  const playlist = getPlaylist("buswale");

  if (!playlist) {
    return null;
  }

  return <BuswalePlayer playlist={playlist} />;
}
