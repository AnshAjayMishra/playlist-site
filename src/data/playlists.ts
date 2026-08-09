export type Playlist = {
  id: string;
  name: string;
  tagline: string;
  youtubePlaylistId: string;
  backgroundVideo: string;
  posterImage: string;
};

export const playlists: Playlist[] = [
  {
    id: "buswale",
    name: "Buswale Ki Playlist",
    tagline: "Mountain roads, chai stops, and songs that carry the bus.",
    youtubePlaylistId: "PLKbDb5lIKyZ8", // https://music.youtube.com/playlist?list=PLKbDb5lIKyZ8
    backgroundVideo: "/images/bus/1vid.mp4?v=2",
    posterImage: "/images/bus/b1.png",
  },
];

export function getPlaylist(id: string) {
  return playlists.find((playlist) => playlist.id === id);
}
