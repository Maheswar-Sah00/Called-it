import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { themeBootScript } from "@/lib/theme-boot";

// Fonts ship with the app (latin subset from Google Fonts), so the build never depends on fetching them.
const arcade = localFont({ src: "./fonts/bungee.woff2", variable: "--font-arcade", weight: "400", display: "swap" });
const display = localFont({ src: "./fonts/bricolage.woff2", variable: "--font-display", weight: "600 800", display: "swap" });
const body = localFont({ src: "./fonts/dmsans.woff2", variable: "--font-body", weight: "400 800", display: "swap" });
const wm = localFont({ src: "./fonts/shrikhand.woff2", variable: "--font-wm", weight: "400", display: "swap" });
const led = localFont({ src: "./fonts/vt323.woff2", variable: "--font-led", weight: "400", display: "swap" });

export const metadata: Metadata = {
  title: "Called It — watch apart, call it together",
  description:
    "A private room where friends watching the same live match call what happens next. The server locks calls the moment it happens. Points only, never money.",
  openGraph: {
    title: "Called It",
    description: "Watch apart. Call it together.",
    images: ["/art/d2/called-it.webp"],
  },
  icons: { icon: "/art/b3/pumped.webp" },
};

export const viewport: Viewport = { themeColor: "#000000", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="night" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${arcade.variable} ${display.variable} ${body.variable} ${led.variable} ${wm.variable} antialiased`}>{children}</body>
    </html>
  );
}
