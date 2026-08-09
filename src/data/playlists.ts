export type Track = {
  id: string;
  title: string;
  artist: string;
  src: string;
};

export type Playlist = {
  id: string;
  name: string;
  tagline: string;
  images: string[];
  imageIntervalMs: number;
  tracks: Track[];
};

export const playlists: Playlist[] = [
  {
    id: "buswale",
    name: "Buswale Ki Playlist",
    tagline: "Mountain roads, chai stops, and songs that carry the bus.",
    images: [
      "/images/bus/b1.png?v=3",
      "/images/bus/b2.png?v=3",
      "/images/bus/b3.png?v=3",
    ],
    imageIntervalMs: 20_000,
    tracks: [],
  },
];

export function getPlaylist(id: string) {
  return playlists.find((playlist) => playlist.id === id);
}
