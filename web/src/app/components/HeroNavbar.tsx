"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import nexusPlusLogo from "./nexus-plus-logo.svg";
import nexusPlusOrange from "./nexus-plus-orange.svg";
import nexusPlusRed from "./nexus-plus-red.svg";

const healthStates = {
  unknown: {
    firstLine: "System Status",
    secondLine: "Unknown",
    label: "Status unknown",
    color: "text-zinc-500",
    logo: nexusPlusLogo,
  },
  operational: {
    firstLine: "All Systems",
    secondLine: "Operational",
    label: "Operational",
    color: "text-nexus-blue",
    logo: nexusPlusLogo,
  },
  partial: {
    firstLine: "Partial",
    secondLine: "Outage",
    label: "Partial outage",
    color: "text-nexus-yellow",
    logo: nexusPlusOrange,
  },
  critical: {
    firstLine: "Critical",
    secondLine: "Outage",
    label: "Critical outage",
    color: "text-nexus-red",
    logo: nexusPlusRed,
  },
} as const;

export type HeroStatus = keyof typeof healthStates;

export default function HeroNavbar({ status = "operational" }: { status?: HeroStatus }) {
  const health = healthStates[status];
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
    <section aria-labelledby="hero-title" className="relative w-full shrink-0">
      {/* Reserve the full title height, including wrapping, in both header modes. */}
      <div aria-hidden="true" className="invisible break-words py-12 text-4xl font-semibold tracking-tight sm:text-7xl">
        {health.firstLine} <span className="block">{health.secondLine}</span>
      </div>
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
              ? "items-center justify-between px-6 py-3 sm:px-16"
              : "flex-col items-start py-12"
          }`}
        >
          <div className="min-w-0">
            <h1
              id="hero-title"
              className={`relative min-h-8 break-words text-4xl font-semjbold tracking-tight text-zinc-950 sm:text-7xl dark:text-zinc-50 ${isCompact ? "h-8" : ""}`}
            >
              <span
                className={`block origin-top-left transition-[translate,opacity] duration-300 ease-in-out motion-reduce:transition-none ${
                  isCompact
                    ? "pointer-events-none translate-y-12 opacity-0"
                    : "translate-y-0 opacity-100"
                }`}
              >
                <span className={`font-light`}>{health.firstLine}</span> <span className={`block ${health.color} font-bold`}>{health.secondLine}</span>
              </span>
              <Image
                src={health.logo}
                alt="nexus+"
                aria-hidden={!isCompact}
                className={`pointer-events-none absolute left-0 top-0 h-8 w-auto origin-left transition-[translate,opacity] duration-300 ease-in-out motion-reduce:transition-none ${
                  isCompact ? "translate-y-0 opacity-100" : "-translate-y-8 opacity-0"
                }`} 
              />
            </h1>
          </div>
          <nav aria-label="Main navigation" className={isCompact ? "shrink-0" : "hidden"}>
            <button
              type="button"
              aria-label={`${health.firstLine} ${health.secondLine}. Back to top`}
              onClick={() =>
                window.scrollTo({
                  top: 0,
                  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                    ? "instant"
                    : "smooth",
                })
              }
              className={`py-2 text-xl font-medium ${health.color} transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current ${
                isCompact ? "" : "hidden"
              }`}
            >
              {health.label}
            </button>
          </nav>
        </div>
      </header>
    </section>
  );
}
