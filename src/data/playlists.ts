export type Playlist = {
  id: string;
  name: string;
  shortLabel: string;
  titleLines: string[];
  tagline: string;
  youtubePlaylistId: string;
  backgroundVideos: string[];
  backgroundImages?: string[];
  posterImage?: string;
};

export const playlists: Playlist[] = [
  {
    id: "buswale",
    name: "Buswale Ki Playlist",
    shortLabel: "Bus वाले",
    titleLines: ["Bus वाले", "Ki प्लेलिस्ट"],
    tagline: "Roads, chai stops, and songs for the bus.",
    youtubePlaylistId: "PLKbDb5lIKyZ8", // https://music.youtube.com/playlist?list=PLKbDb5lIKyZ8
    backgroundVideos: [],
    backgroundImages: ["/images/bus/b1.png", "/images/bus/b2.png"],
    posterImage: "/images/other/bus.png",
  },
  {
    id: "ghazal",
    name: "2 AM Ghazal",
    shortLabel: "2 AM ग़ज़ल",
    titleLines: ["2 AM", "ग़ज़ल"],
    tagline: "Late ghazals for quiet night hours.",
    youtubePlaylistId: "PLaiT07hQ03HA", // https://music.youtube.com/playlist?list=PLaiT07hQ03HA
    backgroundVideos: [
      "/images/ghazals/1.mp4",
      "/images/ghazals/2.mp4",
      "/images/ghazals/3.mp4",
      "/images/ghazals/4.mp4",
    ],
    posterImage: "/images/other/ghazal.png",
  },
  {
    id: "desi-hiphop",
    name: "Desi Hip Hop",
    shortLabel: "देसी हिप हॉप",
    titleLines: ["देसी", "हिप हॉप"],
    tagline: "Bars, beats, and late-night energy.",
    youtubePlaylistId: "PLauPiAiig_ng", // https://music.youtube.com/playlist?list=PLauPiAiig_ng
    backgroundVideos: [],
    backgroundImages: ["/images/ihip/1.png", "/images/ihip/2.png"],
    posterImage: "/images/other/hiphop.png",
  },
  {
    id: "mood",
    name: "Hindi Mood",
    shortLabel: "Hindi मूड",
    titleLines: ["Hindi", "मूड"],
    tagline: "Songs that match how you feel.",
    youtubePlaylistId: "PLMQ0Ii3oydYY", // https://music.youtube.com/playlist?list=PLMQ0Ii3oydYY
    backgroundVideos: ["/images/hindi/1.mp4"],
    backgroundImages: ["/images/hindi/1.png"],
    posterImage: "/images/hindi/1.png",
  },
];

export function getPlaylist(id: string) {
  return playlists.find((playlist) => playlist.id === id);
}
