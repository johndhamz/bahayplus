import { ImageResponse } from "next/og";
import { SITE } from "@/lib/config/site";

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Plus Jakarta Sans subsets (wordmark 800, tagline 500); null if Google Fonts is unreachable (default font is used). */
async function jakarta(weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@${weight}&text=${encodeURIComponent(text)}`,
        { cache: "force-cache" },
      )
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url, { cache: "force-cache" })).arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** Social share card (Messenger, Facebook, Viber, X): brand-sheet lockup on primary green. */
export default async function OpenGraphImage() {
  const [word, tag] = await Promise.all([jakarta(800, "bahay+"), jakarta(500, SITE.tagline)]);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#153D35",
        gap: 56,
      }}
    >
      <svg width="250" height="238" viewBox="0 0 100 95">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F3DDA6" />
            <stop offset="0.55" stopColor="#E5C584" />
            <stop offset="1" stopColor="#D8A65C" />
          </linearGradient>
        </defs>
        <path
          d="M50 5.6 L90.5 35.4 Q94.4 38.3 94.4 43 V81 Q94.4 89 86.4 89 H13.6 Q5.6 89 5.6 81 V43 Q5.6 38.3 9.5 35.4 Z"
          fill="none"
          stroke="url(#g)"
          strokeWidth="11"
          strokeLinejoin="round"
        />
        <rect x="26.4" y="48.9" width="47.2" height="13" rx="6.5" fill="#ffffff" />
        <rect x="43.5" y="31.8" width="13" height="47.2" rx="6.5" fill="#ffffff" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          style={{
            display: "flex",
            fontSize: 168,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: -6,
            lineHeight: 1,
          }}
        >
          bahay<span style={{ color: "#E5C584" }}>+</span>
        </div>
        <div
          style={{
            fontFamily: tag ? "JakartaTag" : undefined,
            fontSize: 34,
            color: "rgba(255,255,255,0.9)",
            letterSpacing: 8,
          }}
        >
          {SITE.tagline}
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        ...(word ? [{ name: "JakartaWord", data: word, weight: 800 as const, style: "normal" as const }] : []),
        ...(tag ? [{ name: "JakartaTag", data: tag, weight: 500 as const, style: "normal" as const }] : []),
      ],
    },
  );
}
