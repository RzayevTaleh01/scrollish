import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BOOT_SCRIPT } from "@/lib/boot";
import { YOUTUBE_API_URL } from "@/lib/youtube-iframe";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Scrollish",
  description: "Learn a language by scrolling short videos. Tap any word or phrase in the subtitles.",
  appleWebApp: { capable: true, title: "Scrollish", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0b12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/*
          The slow part of opening the app is the chain feed, then YouTube's player, then the video.
          Both ends of it are started here, while the app's own code is still being downloaded.
        */}
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://i.ytimg.com" />
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <script async src={YOUTUBE_API_URL} />
      </head>
      <body>{children}</body>
    </html>
  );
}
