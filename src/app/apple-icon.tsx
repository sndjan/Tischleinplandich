import { renderAppIcon } from "@/components/pwa/app-icon";

export const size = { width: 180, height: 180 };
export const runtime = "edge";
export const contentType = "image/png";

export default function AppleIcon() {
  return renderAppIcon(size.width);
}
