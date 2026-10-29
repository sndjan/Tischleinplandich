import type { Metadata, Viewport } from "next";
import { DM_Sans, Nunito } from "next/font/google";
import { AuthProvider } from "@/lib/auth/context";
import { Toaster } from "react-hot-toast";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { UpdateBanner } from "@/components/pwa/update-banner";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-nunito",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Tischleinplandich",
  description:
    "Plane deine wöchentlichen Mahlzeiten und erstelle automatisch Einkaufslisten",
  applicationName: "Tischleinplandich",
  appleWebApp: {
    capable: true,
    title: "Tischlein",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={`${nunito.variable} ${dmSans.variable}`}>
      <body>
        <ServiceWorkerRegistration />
        <UpdateBanner />
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-center"
            containerClassName="app-toaster"
            // Above the mobile tab bar and the sticky page footers.
            containerStyle={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
            toastOptions={{
              style: {
                background: "#1c2b22",
                color: "#ffffff",
                borderRadius: "16px",
                fontSize: "14px",
                padding: "10px 14px",
              },
              success: {
                iconTheme: {
                  primary: "#9fe0b7",
                  secondary: "#1c2b22",
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: "#f2a3a3",
                  secondary: "#1c2b22",
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
