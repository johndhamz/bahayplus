import { ImageResponse } from "next/og";

/** App icons generated at build time (no binary assets in the repo): 192, 512 and a maskable 512. */
export function generateImageMetadata() {
  return [
    { id: "192", size: { width: 192, height: 192 }, contentType: "image/png" },
    { id: "512", size: { width: 512, height: 512 }, contentType: "image/png" },
    { id: "maskable", size: { width: 512, height: 512 }, contentType: "image/png" },
  ];
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const key = String(await id);
  const size = key === "192" ? 192 : 512;
  // Maskable icons keep the mark inside the 80% safe zone on a full-bleed background.
  const mark = key === "maskable" ? size * 0.38 : size * 0.5;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#153D35",
        borderRadius: key === "maskable" ? 0 : size * 0.22,
        color: "#E5C58A",
        fontSize: mark,
        fontWeight: 800,
        letterSpacing: -size * 0.02,
      }}
    >
      B+
    </div>,
    { width: size, height: size },
  );
}
