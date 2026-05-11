import type { CSSProperties } from "react";

export type CoverSize = "xs" | "sm" | "md" | "lg";

const DIMS: Record<CoverSize, { w: number; h: number; fs: number }> = {
  xs: { w: 28, h: 42, fs: 9 },
  sm: { w: 44, h: 66, fs: 10 },
  md: { w: 96, h: 144, fs: 13 },
  lg: { w: 140, h: 210, fs: 16 },
};

// Deterministic 0–360 hue from any string id/title.
function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

interface Props {
  book: { id: string; title: string; author: string; cover?: string };
  size?: CoverSize;
}

export function BookCover({ book, size = "md" }: Props) {
  const dims = DIMS[size];
  const hue = hueFromString(book.id || book.title);
  const hasImage = Boolean(book.cover && book.cover.trim().length > 0);

  const style: CSSProperties = {
    width: dims.w,
    height: dims.h,
    fontSize: dims.fs,
    background: hasImage
      ? `url("${book.cover}")`
      : `linear-gradient(155deg, oklch(0.42 0.06 ${hue}) 0%, oklch(0.32 0.08 ${hue}) 100%)`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
  const accent = `oklch(0.78 0.08 ${hue})`;

  const showText = !hasImage && size !== "xs" && size !== "sm";

  return (
    <div className={`irm-cover${hasImage ? " has-image" : ""}`} style={style}>
      <div className="irm-cover__band" style={{ background: accent }}></div>
      {showText && (
        <>
          <div className="irm-cover__title">{book.title}</div>
          <div className="irm-cover__author">{book.author}</div>
        </>
      )}
    </div>
  );
}
