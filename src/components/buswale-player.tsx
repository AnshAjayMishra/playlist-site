"use client";

import { useEffect, useRef, useState } from "react";
import type { Playlist } from "@/data/playlists";

type BuswalePlayerProps = {
  playlist: Playlist;
};

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

export function BuswalePlayer({ playlist }: BuswalePlayerProps) {
  const [entered, setEntered] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [title, setTitle] = useState("Bus वाले Ki प्लेलिस्ट");
  const [artist, setArtist] = useState("YouTube Music");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<YTPlayer | null>(null);
  const playerMountRef = useRef<HTMLDivElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const enterTimer = window.setTimeout(() => setEntered(true), 40);
    return () => window.clearTimeout(enterTimer);
  }, []);

  useEffect(() => {
    const video = bgVideoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const tryPlay = () => {
      void video.play().catch(() => {
        // Autoplay can still fail in some browsers; leave muted video ready.
      });
    };

    tryPlay();
    video.addEventListener("canplay", tryPlay);
    return () => video.removeEventListener("canplay", tryPlay);
  }, [playlist.backgroundVideo]);

  useEffect(() => {
    let destroyed = false;

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
        if (destroyed || !window.YT || !playerMountRef.current) return;

        // Fresh host node each mount — YT.Player replaces the div with an iframe.
        playerMountRef.current.replaceChildren();
        const host = document.createElement("div");
        host.id = "buswale-yt-audio";
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
              // Skip blocked/unavailable tracks automatically.
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
  }, [playlist.youtubePlaylistId]);

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
      ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      : playlist.posterImage;

  return (
    <main className="relative min-h-dvh overflow-hidden text-[var(--ink)]">
      <div className="absolute inset-0" aria-hidden>
        <video
          ref={bgVideoRef}
          className="h-full w-full object-cover"
          src={playlist.backgroundVideo}
          poster={playlist.posterImage}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,18,14,0.62)_0%,rgba(12,18,14,0.12)_42%,rgba(12,18,14,0.72)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,214,153,0.18),transparent_50%)]" />
      </div>

      {/* Keep iframe in-viewport — fully off-screen/opacity-0 players often refuse to play */}
      <div
        ref={playerMountRef}
        className="pointer-events-none fixed bottom-0 left-0 z-[-1] h-[135px] w-[240px] opacity-[0.01]"
        aria-hidden
      />

      <div
        className={`relative z-10 mx-auto flex min-h-dvh w-full max-w-4xl flex-col items-center px-4 pb-8 pt-10 sm:px-6 sm:pt-14 ${
          entered ? "animate-rise" : "opacity-0 translate-y-4"
        }`}
      >
        <h1 className="text-center drop-shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
          <span
            className="font-playlist-title mt-12 block text-[clamp(2.4rem,8vw,4.75rem)] leading-[1.2] tracking-normal text-white sm:mt-14"
            style={{ fontFamily: "Gotu, sans-serif" }}
          >
            Bus वाले <br /> Ki प्लेलिस्ट
          </span>
        </h1>

        <div className="mt-auto w-full max-w-[720px]">
          {error ? (
            <p className="mb-3 text-center text-sm text-amber-200/90">{error}</p>
          ) : null}
          <div className="capsule-player flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-3.5">
            <div
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-1 ring-white/20 sm:h-16 sm:w-16 ${
                playing ? "animate-vinyl-spin" : ""
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={artwork} alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.85)_0_9%,transparent_10%)]" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.95rem] font-semibold leading-tight text-white sm:text-base">
                {title}
              </p>
              <p className="mt-0.5 truncate text-xs text-white/65 sm:text-sm">{artist}</p>

              <div className="mt-2.5">
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
                <p className="mt-1 text-[0.7rem] tabular-nums text-white/80 sm:text-xs">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
              <button
                type="button"
                onClick={toggleShuffle}
                disabled={!playerReady}
                aria-pressed={shuffle}
                aria-label={shuffle ? "Turn shuffle off" : "Turn shuffle on"}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition sm:h-9 sm:w-9 disabled:opacity-40 ${
                  shuffle ? "text-[var(--amber-bright)]" : "text-white/85 hover:text-white"
                }`}
              >
                <ShuffleIcon />
              </button>

              <button
                type="button"
                onClick={playPrevious}
                disabled={!playerReady}
                aria-label="Previous"
                className="inline-flex h-9 w-9 items-center justify-center text-white transition hover:text-white/80 disabled:opacity-40"
              >
                <PrevIcon />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                disabled={!playerReady}
                aria-label={playing ? "Pause" : "Play"}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition hover:scale-[1.03] disabled:opacity-40 sm:h-12 sm:w-12"
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </button>

              <button
                type="button"
                onClick={playNext}
                disabled={!playerReady}
                aria-label="Next"
                className="inline-flex h-9 w-9 items-center justify-center text-white transition hover:text-white/80 disabled:opacity-40"
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
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M4 2.6v10.8L13.4 8 4 2.6Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="3.4" y="2.6" width="3.2" height="10.8" rx="0.7" />
      <rect x="9.4" y="2.6" width="3.2" height="10.8" rx="0.7" />
    </svg>
  );
}

function PrevIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6h2.2v12H6V6Zm3.2 6 10.3 6.4V5.6L9.2 12Z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M15.8 6H18v12h-2.2V6ZM4.5 18.4 14.8 12 4.5 5.6v12.8Z" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
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
