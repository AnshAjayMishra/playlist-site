"use client";

import { useEffect, useRef, useState } from "react";
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

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function BuswalePlayer() {
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

  useEffect(() => {
    const enterTimer = window.setTimeout(() => setEntered(true), 40);
    return () => window.clearTimeout(enterTimer);
  }, []);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!playlist) return;

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
  }, [playlist]);

  // One looping bg video per track — switch only when the song changes.
  useEffect(() => {
    if (!videoId || !playlist) return;

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
  }, [videoId, playlist]);

  useEffect(() => {
    if (!playlist) return;
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
  }, [bgIndex, playlist]);

  useEffect(() => {
    let destroyed = false;

    if (!playlist?.youtubePlaylistId) {
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
  }, [playlist]);

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
      : playlist.posterImage;

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
            poster={index === 0 ? playlist.posterImage : undefined}
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
                onClick={() => setPlaylistId(item.id)}
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
        className={`relative z-10 mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-20 sm:px-6 sm:pb-8 sm:pt-24 ${
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

        <div className="mt-auto w-full max-w-[560px]">
          {error ? (
            <p className="mb-2.5 px-1 text-center text-xs text-amber-200/90 sm:text-sm">
              {error}
            </p>
          ) : null}
          <div className="capsule-player flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:gap-3.5 sm:px-3.5 sm:py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 sm:h-12 sm:w-12">
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
                <p className="truncate text-[0.85rem] font-semibold leading-tight text-white sm:text-[0.95rem]">
                  {title}
                </p>
                <p className="mt-0.5 truncate text-[0.65rem] text-white/60 sm:text-xs">
                  {artist}
                </p>

                <div className="mt-2">
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
                  <p className="mt-1 text-[0.65rem] tabular-nums text-white/70 sm:text-[0.7rem]">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-center gap-2 sm:gap-1.5">
              <button
                type="button"
                onClick={toggleShuffle}
                disabled={!playerReady}
                aria-pressed={shuffle}
                aria-label={shuffle ? "Turn shuffle off" : "Turn shuffle on"}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition sm:h-8 sm:w-8 disabled:opacity-40 ${
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
                className="inline-flex h-9 w-9 items-center justify-center text-white/85 transition hover:text-white disabled:opacity-40 sm:h-8 sm:w-8"
              >
                <PrevIcon />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                disabled={!playerReady}
                aria-label={playing ? "Pause" : "Play"}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-black transition hover:bg-white disabled:opacity-40 sm:h-10 sm:w-10"
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </button>

              <button
                type="button"
                onClick={playNext}
                disabled={!playerReady}
                aria-label="Next"
                className="inline-flex h-9 w-9 items-center justify-center text-white/85 transition hover:text-white disabled:opacity-40 sm:h-8 sm:w-8"
              >
                <NextIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
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
