"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import nexusPlusLogo from "./nexus-plus-logo.svg";
import nexusPlusLogoCompact from "./nexus-plus-square.svg"

export default function HeroNavbar() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(([entry]) => {
      // Only compact when the sentinel has scrolled above the viewport.
      setIsCompact(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    // Keep the hero's space reserved when its content becomes viewport-fixed.
    <section aria-labelledby="hero-title" className="relative min-h-svh w-full">
      <div ref={sentinelRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-px w-px" />
      <header
        className={
          isCompact
            ? "fixed inset-x-0 top-0 z-50 border-b border-zinc-200 bg-white/95 shadow-sm backdrop-blur-md dark:border-zinc-800 dark:bg-black/95"
            : "absolute inset-x-0 top-0"
        }
      >
        <div
          className={`mx-auto flex w-full max-w-5xl gap-6 ${
            isCompact
              ? "items-center justify-between px-4 py-4 sm:px-8"
              : "flex-col items-start py-12"
          }`}
        >
          <div className="min-w-0">
            <h1
              id="hero-title"
              className={`relative min-h-8 font-semibold tracking-tight text-zinc-950 transition-[font-size] duration-300 ease-in-out motion-reduce:transition-none dark:text-zinc-50 ${
                isCompact ? "text-lg sm:text-xl" : "break-words text-4xl sm:text-6xl"
              }`}
            >
              <span
                className={`block origin-top-left overflow-hidden transition-[transform,opacity,max-height] duration-300 ease-in-out motion-reduce:transition-none ${
                  isCompact
                    ? "max-h-8 scale-75 opacity-0"
                    : "max-h-96 scale-100 opacity-100"
                }`}
              >
                All Systems <span className="text-[#3C57F0]">Operational</span>
              </span>
              <Image
                src={nexusPlusLogo}
                alt="nexus+"
                aria-hidden={!isCompact}
                className={`pointer-events-none absolute left-0 top-0 h-8 w-auto origin-left transition-[transform,opacity] duration-300 ease-in-out motion-reduce:transition-none ${
                  isCompact ? "scale-100 opacity-100" : "scale-90 opacity-0"
                }`}
              />
            </h1>
          </div>
          <nav aria-label="Main navigation" className="shrink-0">
            <button
              type="button"
              onClick={() =>
                window.scrollTo({
                  top: 0,
                  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                    ? "instant"
                    : "smooth",
                })
              }
              className={`rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-500 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 ${
                isCompact ? "" : "hidden"
              }`}
            >
              Back to top
            </button>
          </nav>
        </div>
      </header>
    </section>
  );
}
