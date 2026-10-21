import { renderAppIcon } from "@/components/pwa/app-icon";

export const runtime = "edge";
export const contentType = "image/png";

export function generateImageMetadata() {
  return [192, 512].map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType,
  }));
}

export default function Icon({ id }: { id: string }) {
  return renderAppIcon(Number(id));
}
