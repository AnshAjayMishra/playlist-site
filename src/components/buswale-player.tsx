"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { playlists } from "@/data/playlists";

type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  nextVideo: () => void;
  previousVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setShuffle: (shufflePlaylist: boolean) => void;
  setLoop: (loopPlaylist: boolean) => void;
  playVideoAt: (index: number) => void;
  cuePlaylist: (args: {
    listType?: string;
    list: string;
    index?: number;
  }) => void;
  getPlayerState: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  getVideoData: () => { title?: string; author?: string; video_id?: string };
  destroy: () => void;
};

type YTNamespace = {
  Player: new (
    elementId: string,
    options: {
      height?: string | number;
      width?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YTPlayer }) => void;
        onStateChange?: (event: { data: number; target: YTPlayer }) => void;
        onError?: (event: { data: number; target: YTPlayer }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
};

function youtubeErrorMessage(code: number) {
  switch (code) {
    case 2:
      return "Invalid playlist/video id. Paste the full playlist URL.";
    case 5:
      return "HTML5 player error. Try refreshing the page.";
    case 100:
      return "Video not found or private.";
    case 101:
    case 150:
      return "This track blocks embedding — skip to the next song.";
    case 153:
      return "YouTube blocked the embed (Error 153). Refresh once — referrer fix applied.";
    default:
      return `YouTube error ${code}. Check the playlist is public.`;
  }
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("No window"));
  }

  if (window.YT?.Player) {
    return Promise.resolve();
  }

  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise<void>((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve();
      };

      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
      }
    });
  }

  return youtubeApiPromise;
}

const STORAGE_KEY = "siteplaylist:selected-id";

function readStoredPlaylistId(): string | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved && playlists.some((item) => item.id === saved)) return saved;
  return null;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function BuswalePlayer() {
  const [hasChosen, setHasChosen] = useState<boolean | null>(null);
  const [playlistId, setPlaylistId] = useState(playlists[0]?.id ?? "buswale");
  const playlist =
    playlists.find((item) => item.id === playlistId) ?? playlists[0];

  const [entered, setEntered] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [title, setTitle] = useState(playlist?.name ?? "Playlist");
  const [artist, setArtist] = useState("YouTube Music");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bgIndex, setBgIndex] = useState(0);
  const [now, setNow] = useState<Date | null>(null);

  const playerRef = useRef<YTPlayer | null>(null);
  const playerMountRef = useRef<HTMLDivElement | null>(null);
  const bgVideoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const lastTrackIdRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const saved = readStoredPlaylistId();
    if (saved) {
      setPlaylistId(saved);
      setHasChosen(true);
    } else {
      setHasChosen(false);
    }
  }, []);

  useEffect(() => {
    if (hasChosen === null) {
      document.title = "musxic";
      return;
    }
    if (!hasChosen || !playlist) {
      document.title = "musxic";
      return;
    }
    document.title = playlist.titleLines.join(" ");
  }, [hasChosen, playlist]);

  useEffect(() => {
    if (!hasChosen) {
      setEntered(false);
      return;
    }
    const enterTimer = window.setTimeout(() => setEntered(true), 40);
    return () => window.clearTimeout(enterTimer);
  }, [hasChosen]);

  function selectPlaylist(id: string) {
    setPlaylistId(id);
    window.localStorage.setItem(STORAGE_KEY, id);
    setHasChosen(true);
  }

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hasChosen || !playlist) return;

    setBgIndex(0);
    setPlaying(false);
    setShuffle(false);
    setPlayerReady(false);
    setVideoId(null);
    setCurrentTime(0);
    setDuration(0);
    setTitle(playlist.name);
    setArtist("YouTube Music");
    setError(
      playlist.youtubePlaylistId
        ? null
        : "Add a YouTube Music playlist link for this collection.",
    );
    lastTrackIdRef.current = null;
    bgVideoRefs.current = [];
  }, [hasChosen, playlist]);

  // One looping bg video per track — switch only when the song changes.
  useEffect(() => {
    if (!hasChosen || !videoId || !playlist) return;

    if (lastTrackIdRef.current == null) {
      lastTrackIdRef.current = videoId;
      return;
    }

    if (lastTrackIdRef.current !== videoId) {
      lastTrackIdRef.current = videoId;
      const bgCount =
        playlist.backgroundVideos.length ||
        playlist.backgroundImages?.length ||
        1;
      setBgIndex((current) => (current + 1) % bgCount);
    }
  }, [hasChosen, videoId, playlist]);

  useEffect(() => {
    if (!hasChosen || !playlist) return;
    const videos = bgVideoRefs.current;

    videos.forEach((video, index) => {
      if (!video) return;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.loop = true;

      if (index === bgIndex) {
        if (video.paused) {
          void video.play().catch(() => {});
        }
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [hasChosen, bgIndex, playlist]);

  useEffect(() => {
    let destroyed = false;

    if (!hasChosen || !playlist?.youtubePlaylistId) {
      playerRef.current?.destroy();
      playerRef.current = null;
      playerMountRef.current?.replaceChildren();
      return;
    }

    function syncTrack(player: YTPlayer) {
      try {
        const data = player.getVideoData();
        if (data?.title) setTitle(data.title);
        if (data?.author) setArtist(data.author);
        if (data?.video_id) setVideoId(data.video_id);
        const nextDuration = player.getDuration();
        if (nextDuration > 0) setDuration(nextDuration);
      } catch {
        // Player may not expose data yet.
      }
    }

    loadYouTubeApi()
      .then(() => {
        if (destroyed || !window.YT || !playerMountRef.current || !playlist) {
          return;
        }

        playerMountRef.current.replaceChildren();
        const host = document.createElement("div");
        host.id = "site-yt-audio";
        playerMountRef.current.appendChild(host);

        playerRef.current?.destroy();
        setError(null);
        playerRef.current = new window.YT.Player(host.id, {
          width: 240,
          height: 135,
          playerVars: {
            listType: "playlist",
            list: playlist.youtubePlaylistId,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (destroyed) return;

              const iframe = playerMountRef.current?.querySelector("iframe");
              iframe?.setAttribute(
                "referrerpolicy",
                "strict-origin-when-cross-origin",
              );

              try {
                event.target.cuePlaylist({
                  listType: "playlist",
                  list: playlist.youtubePlaylistId,
                  index: 0,
                });
                event.target.setLoop(true);
              } catch {
                // cuePlaylist may throw if the list id is invalid
              }
              playerRef.current = event.target;
              setPlayerReady(true);
              syncTrack(event.target);
            },
            onStateChange: (event) => {
              if (destroyed || !window.YT) return;
              setPlaying(event.data === window.YT.PlayerState.PLAYING);
              if (
                event.data === window.YT.PlayerState.PLAYING ||
                event.data === window.YT.PlayerState.PAUSED ||
                event.data === window.YT.PlayerState.CUED ||
                event.data === window.YT.PlayerState.BUFFERING
              ) {
                setError(null);
                syncTrack(event.target);
              }
            },
            onError: (event) => {
              if (destroyed) return;
              setError(youtubeErrorMessage(event.data));
              setPlaying(false);
              if (event.data === 100 || event.data === 101 || event.data === 150) {
                window.setTimeout(() => event.target.nextVideo(), 400);
              }
            },
          },
        });
      })
      .catch(() => {
        if (!destroyed) {
          setError("Could not load YouTube player. Check your network.");
        }
      });

    return () => {
      destroyed = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      playerMountRef.current?.replaceChildren();
    };
  }, [hasChosen, playlist]);

  useEffect(() => {
    if (!playerReady || !playing || seeking) return;

    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        setCurrentTime(player.getCurrentTime() || 0);
        const nextDuration = player.getDuration();
        if (nextDuration > 0) setDuration(nextDuration);
      } catch {
        // ignore transient API errors
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [playerReady, playing, seeking]);

  if (!playlist) {
    return null;
  }

  if (hasChosen === null) {
    return <main className="min-h-dvh bg-[var(--background)]" />;
  }

  if (!hasChosen) {
    return (
      <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 pb-16 pt-10 text-[var(--ink)]">
        <div
          className="absolute inset-0 scale-105 bg-[url('/images/other/image.png')] bg-cover bg-center blur-[4px]"
          aria-hidden
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,18,14,0.45)_0%,rgba(12,18,14,0.58)_55%,rgba(12,18,14,0.78)_100%)]" />

        <div className="relative z-10 w-full max-w-4xl animate-rise">
          <p className="-mt-6 text-center text-xs tracking-[0.22em] text-white/65 uppercase sm:-mt-10">
            Vinyl Crate
          </p>
          <h1
            className="font-playlist-title mt-5 text-center text-[clamp(2rem,8vw,3.4rem)] leading-[1.15] text-white sm:mt-6"
            style={{ fontFamily: "Gotu, sans-serif" }}
          >
            कौन सी प्लेलिस्ट?
          </h1>
          <p className="mx-auto mt-3 max-w-md text-center text-sm text-white/70">
            Record चुनो — drop the needle. Switch anytime from the top right.
          </p>

          <div className="mt-10 flex snap-x snap-mandatory items-start gap-5 overflow-x-auto px-2 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] sm:justify-center sm:gap-8 sm:overflow-visible [&::-webkit-scrollbar]:hidden">
            {playlists.map((item) => {
              const cover =
                item.posterImage ??
                item.backgroundImages?.[0] ??
                "/images/other/image.png";

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectPlaylist(item.id)}
                  className="group flex w-[min(42vw,170px)] shrink-0 snap-center flex-col items-center gap-4 sm:w-[170px]"
                >
                  <span className="playlist-vinyl block overflow-hidden bg-[#14110f]">
                    <span className="playlist-vinyl-grooves absolute inset-0" />
                    <span className="playlist-vinyl-art absolute inset-[18%] overflow-hidden rounded-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cover}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <span className="absolute left-1/2 top-1/2 z-[1] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black ring-2 ring-white/20" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-xl">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          aria-hidden
                        >
                          <path d="M4 2.6v10.8L13.4 8 4 2.6Z" />
                        </svg>
                      </span>
                    </span>
                  </span>

                  <span className="flex w-full flex-col items-center text-center">
                    <span
                      className="font-playlist-title block min-h-[2.5em] w-full text-lg leading-tight text-white sm:text-xl"
                      style={{ fontFamily: "Gotu, sans-serif" }}
                    >
                      {item.titleLines.map((line, index) => (
                        <span key={line}>
                          {index > 0 ? <br /> : null}
                          {line}
                        </span>
                      ))}
                    </span>
                    <span className="mt-1 line-clamp-2 h-[2.6em] w-full overflow-hidden text-xs leading-snug text-white/65">
                      {item.tagline}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="absolute inset-x-0 bottom-0 z-10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-center text-xs text-white/55 sm:text-sm">
          Developed &amp; designed by{" "}
          <a
            href="https://anshajaymishra.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-white/85 underline decoration-white/30 underline-offset-2 transition hover:text-white hover:decoration-white/70"
          >
            अंश अजय मिश्रा
          </a>
        </p>
      </main>
    );
  }

  function togglePlay() {
    const player = playerRef.current;
    if (!player || !playerReady) return;
    if (playing) player.pauseVideo();
    else player.playVideo();
  }

  function playPrevious() {
    playerRef.current?.previousVideo();
  }

  function playNext() {
    playerRef.current?.nextVideo();
  }

  function toggleShuffle() {
    const player = playerRef.current;
    if (!player || !playerReady) return;

    const next = !shuffle;
    player.setShuffle(next);
    if (next) {
      window.setTimeout(() => player.playVideoAt(0), 250);
    }
    setShuffle(next);
  }

  function onSeekInput(value: number) {
    setSeeking(true);
    setCurrentTime(value);
  }

  function onSeekCommit(value: number) {
    const player = playerRef.current;
    if (player) player.seekTo(value, true);
    setCurrentTime(value);
    setSeeking(false);
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const artwork =
    videoId != null
      ? `https://i.ytimg.com/vi/${videoId}/hq720.jpg`
      : null;

  const timeLabel = now
    ? now.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "";
  const dateLabel = now
    ? now.toLocaleDateString([], {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "";

  return (
    <main className="relative min-h-dvh text-[var(--ink)]">
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        {playlist.backgroundVideos.map((src, index) => (
          <video
            key={`${playlist.id}-${src}`}
            ref={(node) => {
              bgVideoRefs.current[index] = node;
            }}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-in-out ${
              index === bgIndex ? "opacity-100" : "opacity-0"
            }`}
            src={src}
            muted
            loop
            playsInline
            preload="auto"
            autoPlay={index === 0}
          />
        ))}
        {(playlist.backgroundImages ?? []).map((src, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${playlist.id}-img-${src}`}
            src={src}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-in-out ${
              playlist.backgroundVideos.length === 0 && index === bgIndex
                ? "opacity-100"
                : "opacity-0"
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,18,14,0.5)_0%,rgba(12,18,14,0.08)_42%,rgba(12,18,14,0.58)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,214,153,0.14),transparent_50%)]" />
      </div>

      <div
        ref={playerMountRef}
        className="pointer-events-none fixed bottom-0 left-0 z-[-1] h-[135px] w-[240px] opacity-[0.01]"
        aria-hidden
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-3 sm:px-5 sm:pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div
          className="playlist-switcher pointer-events-auto flex max-w-[48%] shrink items-baseline gap-1.5 overflow-hidden px-2.5 py-1.5 text-white sm:max-w-none sm:gap-2 sm:px-3.5 sm:py-2"
          aria-live="polite"
        >
          <span className="truncate text-[0.7rem] font-semibold tabular-nums leading-none tracking-wide sm:text-[0.95rem]">
            {timeLabel || "—:—"}
          </span>
          <span className="hidden truncate text-[0.65rem] tracking-wide text-white/70 min-[380px]:inline sm:text-xs">
            {dateLabel || "—"}
          </span>
        </div>

        <div className="playlist-switcher pointer-events-auto flex max-w-[52%] items-center gap-0.5 overflow-x-auto p-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:max-w-none sm:gap-1 sm:p-1 [&::-webkit-scrollbar]:hidden">
          {playlists.map((item) => {
            const active = item.id === playlist.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectPlaylist(item.id)}
                aria-pressed={active}
                className={`shrink-0 rounded-full px-2 py-1 text-[0.65rem] font-medium tracking-wide transition sm:px-3.5 sm:py-1.5 sm:text-sm ${
                  active
                    ? "bg-white text-[var(--soil)]"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={`relative z-10 mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center px-3 pb-[max(2.25rem,calc(env(safe-area-inset-bottom)+1.75rem))] pt-20 sm:px-6 sm:pb-10 sm:pt-24 ${
          entered ? "animate-rise" : "opacity-0 translate-y-4"
        }`}
      >
        <h1 className="px-1 text-center drop-shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
          <span
            className="font-playlist-title mt-2 block text-[clamp(1.85rem,8.5vw,4.75rem)] leading-[1.2] tracking-normal text-white sm:mt-8"
            style={{ fontFamily: "Gotu, sans-serif" }}
          >
            {playlist.titleLines.map((line, index) => (
              <span key={`${playlist.id}-${line}`}>
                {index > 0 ? <br /> : null}
                {line}
              </span>
            ))}
          </span>
        </h1>

        <div className="mt-auto w-full max-w-[600px]">
          {error ? (
            <p className="mb-2.5 px-1 text-center text-xs text-amber-200/90 sm:text-sm">
              {error}
            </p>
          ) : null}
          <div className="capsule-player flex items-center gap-2.5 px-2.5 py-2 sm:gap-3.5 sm:px-3.5 sm:py-3">
            <div className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
              <div
                className={`absolute inset-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/25 ${
                  playing ? "animate-vinyl-spin" : ""
                }`}
              >
                {artwork ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={artwork}
                      alt=""
                      className="absolute left-1/2 top-1/2 h-[130%] w-[130%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover object-center"
                    />
                    <span
                      className="pointer-events-none absolute left-1/2 top-1/2 z-[1] h-[18%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/90 ring-1 ring-white/15"
                      aria-hidden
                    />
                  </>
                ) : null}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8rem] font-semibold leading-tight text-white sm:text-[0.95rem]">
                {title}
              </p>
              <p className="mt-0.5 truncate text-[0.65rem] text-white/60 sm:text-xs">
                {artist}
              </p>

              <div className="mt-1.5 sm:mt-2">
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={Math.min(currentTime, duration || 0)}
                  disabled={!playerReady || duration <= 0}
                  onChange={(event) => onSeekInput(Number(event.target.value))}
                  onMouseUp={(event) =>
                    onSeekCommit(Number((event.target as HTMLInputElement).value))
                  }
                  onTouchEnd={(event) =>
                    onSeekCommit(Number((event.target as HTMLInputElement).value))
                  }
                  onKeyUp={(event) =>
                    onSeekCommit(Number((event.target as HTMLInputElement).value))
                  }
                  aria-label="Seek"
                  className="capsule-seek w-full"
                  style={{ ["--progress" as string]: `${progress}%` }}
                />
                <p className="mt-1 text-[0.6rem] tabular-nums text-white/70 sm:text-[0.7rem]">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
              <button
                type="button"
                onClick={toggleShuffle}
                disabled={!playerReady}
                aria-pressed={shuffle}
                aria-label={shuffle ? "Turn shuffle off" : "Turn shuffle on"}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition sm:h-8 sm:w-8 disabled:opacity-40 ${
                  shuffle ? "text-[var(--amber-bright)]" : "text-white/75 hover:text-white"
                }`}
              >
                <ShuffleIcon />
              </button>

              <button
                type="button"
                onClick={playPrevious}
                disabled={!playerReady}
                aria-label="Previous"
                className="inline-flex h-7 w-7 items-center justify-center text-white/85 transition hover:text-white disabled:opacity-40 sm:h-8 sm:w-8"
              >
                <PrevIcon />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                disabled={!playerReady}
                aria-label={playing ? "Pause" : "Play"}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-black transition hover:bg-white disabled:opacity-40 sm:h-10 sm:w-10"
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </button>

              <button
                type="button"
                onClick={playNext}
                disabled={!playerReady}
                aria-label="Next"
                className="inline-flex h-7 w-7 items-center justify-center text-white/85 transition hover:text-white disabled:opacity-40 sm:h-8 sm:w-8"
              >
                <NextIcon />
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 text-center text-[0.65rem] leading-tight text-white/45 sm:text-[0.7rem]">
        Developed &amp; designed by{" "}
        <a
          href="https://anshajaymishra.tech"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-white/70 underline decoration-white/25 underline-offset-2 transition hover:text-white hover:decoration-white/60"
        >
          अंश अजय मिश्रा
        </a>
      </p>
    </main>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M4 2.6v10.8L13.4 8 4 2.6Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="3.4" y="2.6" width="3.2" height="10.8" rx="0.7" />
      <rect x="9.4" y="2.6" width="3.2" height="10.8" rx="0.7" />
    </svg>
  );
}

function PrevIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6h2.2v12H6V6Zm3.2 6 10.3 6.4V5.6L9.2 12Z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M15.8 6H18v12h-2.2V6ZM4.5 18.4 14.8 12 4.5 5.6v12.8Z" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16 3h5v5M21 3l-7.5 7.5M4 20l6.5-6.5M21 16v5h-5M21 21l-6-6M4 4l4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
