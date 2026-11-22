import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Real usage · Called It",
  description: "Live, real-user numbers for Called It. Demo rooms and bots are excluded.",
};

export default function ImpactLayout({ children }: { children: ReactNode }) {
  return children;
}
