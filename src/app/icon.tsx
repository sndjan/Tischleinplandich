import { renderAppIcon } from "@/components/pwa/app-icon";

export const contentType = "image/png";

export function generateImageMetadata() {
  return [192, 512].map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType,
  }));
}

// Not on the edge runtime: Next.js prerenders the sizes above at build time,
// which the edge runtime can't do.
export default async function Icon({ id }: { id: Promise<string> }) {
  return renderAppIcon(Number(await id));
}
