export type Playlist = {
  id: string;
  name: string;
  shortLabel: string;
  titleLines: string[];
  tagline: string;
  youtubePlaylistId: string;
  backgroundVideos: string[];
  posterImage?: string;
};

export const playlists: Playlist[] = [
  {
    id: "buswale",
    name: "Buswale Ki Playlist",
    shortLabel: "Bus वाले",
    titleLines: ["Bus वाले", "Ki प्लेलिस्ट"],
    tagline: "Mountain roads, chai stops, and songs that carry the bus.",
    youtubePlaylistId: "PLKbDb5lIKyZ8", // https://music.youtube.com/playlist?list=PLKbDb5lIKyZ8
    backgroundVideos: ["/images/bus/1vid.mp4?v=2", "/images/bus/2vid.mp4"],
    posterImage: "/images/bus/b1.png",
  },
  {
    id: "ghazal",
    name: "2 AM Ghazal",
    shortLabel: "2 AM ग़ज़ल",
    titleLines: ["2 AM", "ग़ज़ल"],
    tagline: "Late-night ghazals for quiet hours.",
    youtubePlaylistId: "PLaiT07hQ03HA", // https://music.youtube.com/playlist?list=PLaiT07hQ03HA
    backgroundVideos: [
      "/images/ghazals/1.mp4",
      "/images/ghazals/2.mp4",
      "/images/ghazals/3.mp4",
      "/images/ghazals/4.mp4",
    ],
  },
  {
    id: "Indi Hip Hop",  
    name: "Indi Hip Hop",
    shortLabel: "Indi Hip Hop",
    titleLines: ["Indi", "Hip Hop"],
    tagline: "Indi Hip Hop songs",
    youtubePlaylistId: "", // https://music.youtube.com/playlist?list=PLKbDb5lIKyZ8
    backgroundVideos: ["", ""],
  },
];

export function getPlaylist(id: string) {
  return playlists.find((playlist) => playlist.id === id);
}
