"use client";

import Script from "next/script";
import { createElement } from "react";

type ProfileCharacterViewerProps = {
  modelSrc: string;
  posterSrc?: string;
  alt: string;
  className?: string;
};

export function ProfileCharacterViewer({ modelSrc, posterSrc, alt, className }: ProfileCharacterViewerProps) {
  return (
    <div className={className}>
      <Script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js" strategy="afterInteractive" />
      <div className="character-shell h-full w-full overflow-hidden rounded-lg">
        {createElement("model-viewer", {
          src: modelSrc,
          poster: posterSrc,
          alt,
          "camera-controls": "",
          "auto-rotate": "",
          "auto-rotate-delay": "0",
          "rotation-per-second": "18deg",
          "interaction-prompt": "none",
          "disable-zoom": "",
          "shadow-intensity": "0.8",
          "camera-orbit": "0deg 75deg 1.8m",
          "field-of-view": "38deg",
          "environment-image": "neutral",
          exposure: "0.95",
          style: { width: "100%", height: "100%", background: "transparent" },
        })}
      </div>
      <style jsx>{`
        .character-shell {
          animation: characterFloat 4.6s ease-in-out infinite;
        }

        @keyframes characterFloat {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-4px);
          }
        }
      `}</style>
    </div>
  );
}

