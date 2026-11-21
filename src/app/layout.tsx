import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Bungee, DM_Sans, Shrikhand, VT323 } from "next/font/google";
import "./globals.css";
import { themeBootScript } from "@/lib/theme-boot";

const arcade = Bungee({ variable: "--font-arcade", weight: "400", subsets: ["latin"] });
const display = Bricolage_Grotesque({ variable: "--font-display", weight: ["600", "700", "800"], subsets: ["latin"] });
const body = DM_Sans({ variable: "--font-body", subsets: ["latin"] });
const wm = Shrikhand({ variable: "--font-wm", weight: "400", subsets: ["latin"] });
const led = VT323({ variable: "--font-led", weight: "400", subsets: ["latin"] });

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

export const viewport: Viewport = { themeColor: "#1f120d" };

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
