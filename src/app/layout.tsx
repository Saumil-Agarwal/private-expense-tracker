import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { TelegramProvider } from "@/components/telegram-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Ledgerly",
  description: "Private, flexible expense tracking",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111713",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" /><TelegramProvider>{children}</TelegramProvider></body>
    </html>
  );
}
