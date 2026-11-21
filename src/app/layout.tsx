import type { Metadata, Viewport } from "next";
import { Alfa_Slab_One, Bricolage_Grotesque, DM_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const slab = Alfa_Slab_One({ variable: "--font-slab", weight: "400", subsets: ["latin"] });
const display = Bricolage_Grotesque({ variable: "--font-display", weight: ["600", "700", "800"], subsets: ["latin"] });
const body = DM_Sans({ variable: "--font-body", subsets: ["latin"] });
const mono = Space_Mono({ variable: "--font-mono", weight: ["400", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Called It — watch apart, call it together",
  description:
    "A private room where friends watching the same live match call what happens next. The server locks calls the moment the ball is bowled. Points only, never money.",
  openGraph: {
    title: "Called It",
    description: "Watch apart. Call it together.",
    images: ["/art/d2/called-it.webp"],
  },
  icons: { icon: "/art/b3/pumped.webp" },
};

export const viewport: Viewport = { themeColor: "#2f55e4" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${slab.variable} ${display.variable} ${body.variable} ${mono.variable} antialiased`}>{children}</body>
    </html>
  );
}
