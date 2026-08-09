"use client";

import { useEffect, useState } from "react";
import type { Playlist } from "@/data/playlists";

type BuswalePlayerProps = {
  playlist: Playlist;
};

export function BuswalePlayer({ playlist }: BuswalePlayerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [entered, setEntered] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const enterTimer = window.setTimeout(() => setEntered(true), 40);
    return () => window.clearTimeout(enterTimer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loaded = 0;

    playlist.images.forEach((src) => {
      const img = new window.Image();
      img.onload = img.onerror = () => {
        loaded += 1;
        if (!cancelled && loaded >= playlist.images.length) {
          setReady(true);
        }
      };
      img.src = src;
    });

    return () => {
      cancelled = true;
    };
  }, [playlist.images]);

  useEffect(() => {
    if (!ready || playlist.images.length < 2) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % playlist.images.length);
    }, playlist.imageIntervalMs);

    return () => window.clearInterval(timer);
  }, [ready, playlist.imageIntervalMs, playlist.images.length]);

  return (
    <main className="relative min-h-dvh overflow-hidden text-[var(--ink)]">
      <div className="absolute inset-0" aria-hidden>
        {playlist.images.map((src, index) => {
          const isActive = index === activeIndex;

          return (
            <div
              key={src}
              className={`absolute inset-0 transition-opacity duration-[1800ms] ease-in-out ${
                isActive && ready ? "opacity-100" : "opacity-0"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className={`h-full w-full object-cover ${
                  isActive ? "animate-ken-burns" : ""
                }`}
              />
            </div>
          );
        })}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,18,14,0.62)_0%,rgba(12,18,14,0.12)_42%,rgba(12,18,14,0.45)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,214,153,0.18),transparent_50%)]" />
      </div>

      <div
        className={`relative z-10 flex min-h-dvh items-start justify-center px-5 pt-10 sm:pt-14 ${
          entered ? "animate-rise" : "opacity-0 translate-y-4"
        }`}
      >
        <h1 className="text-center drop-shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
          <span
            className="font-playlist-title block text-[clamp(2.6rem,9vw,5.25rem)] leading-[1.2] tracking-normal text-white mt-12"
            style={{ fontFamily: "Gotu, sans-serif" }}
          >
            Bus वाले <br /> Ki प्लेलिस्ट
          </span>
        </h1>
      </div>
    </main>
  );
}
