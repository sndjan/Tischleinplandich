import type { Metadata, Viewport } from "next";
import { DM_Sans, Nunito } from "next/font/google";
import { AuthProvider } from "@/lib/auth/context";
import { Toaster } from "react-hot-toast";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-nunito",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Wochen-Essensplaner",
  description:
    "Plane deine wöchentlichen Mahlzeiten und erstelle automatisch Einkaufslisten",
  applicationName: "Essensplaner",
  appleWebApp: {
    capable: true,
    title: "Essensplaner",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4f9c6e",
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
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              success: {
                iconTheme: {
                  primary: "#15803d",
                  secondary: "white",
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
