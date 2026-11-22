import type { Metadata } from "next";
import Link from "next/link";
import { Art, Brand } from "@/components/ui";

export const metadata: Metadata = { title: "Page not found · Called It" };

/** Branded 404: a mistyped link still lands somewhere friendly. */
export default function NotFound() {
  return (
    <main className="flood relative min-h-screen overflow-hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-5">
        <Brand />
      </div>
      <div className="relative z-10 mx-auto max-w-md px-4 pb-24 pt-12 text-center sm:pt-20">
        <Art src="b3/facepalm" className="floaty mx-auto w-28 sm:w-36" />
        <p className="font-led mt-4 text-2xl text-orange">404 · NOT OUT, NOT FOUND</p>
        <h1 className="font-display mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">This page isn&apos;t on the scorecard</h1>
        <p className="mt-3 text-on-muted">The link may be mistyped. If a friend sent you a room, ask them to share it again.</p>
        <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <Link href="/#live" className="key min-h-14 text-lg">
            Start a room
          </Link>
          <Link href="/" className="key key-paper min-h-14 text-lg">
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
