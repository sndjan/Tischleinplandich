"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import toast from "react-hot-toast";

// Recipe cards and covers are 4:3; cropping to it means the card shows exactly
// what was chosen here.
export const COVER_ASPECT = 4 / 3;
const OUTPUT_WIDTH = 1600;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    // Covers already uploaded come from Supabase storage, which allows this.
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

/**
 * Draws the chosen area of the (rotated) image into a JPEG of at most
 * OUTPUT_WIDTH pixels wide.
 */
async function cropToFile(src: string, area: Area, rotation: number): Promise<File> {
  const image = await loadImage(src);
  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const rotatedWidth = image.width * cos + image.height * sin;
  const rotatedHeight = image.width * sin + image.height * cos;

  // The whole image, rotated, on one canvas…
  const rotated = document.createElement("canvas");
  rotated.width = rotatedWidth;
  rotated.height = rotatedHeight;
  const rotatedContext = rotated.getContext("2d");
  if (!rotatedContext) throw new Error("Canvas nicht verfügbar");
  rotatedContext.translate(rotatedWidth / 2, rotatedHeight / 2);
  rotatedContext.rotate(radians);
  rotatedContext.drawImage(image, -image.width / 2, -image.height / 2);

  // …then just the chosen area, scaled down to a sensible size.
  const scale = Math.min(1, OUTPUT_WIDTH / area.width);
  const output = document.createElement("canvas");
  output.width = Math.round(area.width * scale);
  output.height = Math.round(area.height * scale);
  output
    .getContext("2d")
    ?.drawImage(rotated, area.x, area.y, area.width, area.height, 0, 0, output.width, output.height);

  const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new Error("Bild konnte nicht erstellt werden");
  return new File([blob], "titelbild.jpg", { type: "image/jpeg" });
}

interface ImageCropperProps {
  src: string;
  onCancel: () => void;
  onDone: (file: File) => void;
}

/**
 * Full-screen cropper in the shape of the recipe cards: drag to move, pinch or
 * use the slider to zoom, rotate in quarter turns.
 */
export function ImageCropper({ src, onCancel, onDone }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKey);
    // The page underneath must not scroll while pinching.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onCancel]);

  const handleCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  const finish = async () => {
    if (!area) return;
    setSaving(true);
    try {
      onDone(await cropToFile(src, area, rotation));
    } catch (error) {
      console.error(error);
      toast.error("Zuschneiden hat nicht geklappt");
      setSaving(false);
    }
  };

  return (
    <div data-overlay role="dialog" aria-modal="true" aria-label="Bild zuschneiden" className="fixed inset-0 z-[60] flex flex-col bg-[#111412] text-white">
      <header className="flex shrink-0 items-center justify-between px-2 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 px-3.5 text-base font-semibold transition-opacity active:opacity-60"
        >
          Abbrechen
        </button>
        <span className="text-base font-bold">Zuschneiden</span>
        <button
          type="button"
          onClick={() => void finish()}
          disabled={!area || saving}
          className="flex h-10 min-w-[84px] items-center justify-center rounded-full bg-brand-accent px-4 text-[15px] font-bold transition-transform active:scale-95 disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Fertig"}
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={COVER_ASPECT}
          minZoom={1}
          maxZoom={4}
          showGrid
          objectFit="contain"
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
          style={{
            containerStyle: { background: "#111412" },
            cropAreaStyle: { border: "2px solid #ffffff", borderRadius: 4, color: "rgba(0,0,0,0.6)" },
          }}
        />
        <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-[13px] text-white/80">
          So erscheint das Bild auf der Karte
        </p>
      </div>

      <footer className="shrink-0 space-y-4 px-5 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Verkleinern" onClick={() => setZoom((value) => Math.max(1, value - 0.25))} className="active:opacity-60">
            <ZoomOut className="size-[18px]" />
          </button>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label="Zoom"
            className="h-1 flex-1 cursor-pointer accent-white"
          />
          <button type="button" aria-label="Vergrößern" onClick={() => setZoom((value) => Math.min(4, value + 0.25))} className="active:opacity-60">
            <ZoomIn className="size-[18px]" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-white/70">Ziehen zum Verschieben · zwei Finger zum Zoomen</span>
          <button
            type="button"
            aria-label="Drehen"
            onClick={() => setRotation((value) => (value + 90) % 360)}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 transition-transform active:scale-90"
          >
            <RotateCw className="size-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
