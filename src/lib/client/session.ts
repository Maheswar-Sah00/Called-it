"use client";

import { useCallback, useEffect, useState } from "react";

export type Me = { userId: string; name: string; avatar?: string };
export type SessionInfo = { session: Me | null; token?: string; appKey?: string };

export async function api<T = unknown>(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, status: res.status, data };
}

export function useSession() {
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SessionInfo>("/api/session")
      .then((r) => (r.ok ? setInfo(r.data) : setError(r.data.error ?? "Could not reach the server")))
      .catch(() => setError("Could not reach the server"));
  }, []);

  const join = useCallback(async (name: string, avatar: string, demo = false) => {
    const r = await api<SessionInfo>("/api/session", { name, avatar, demo });
    if (!r.ok) throw new Error(r.data.error ?? "Could not join");
    setInfo(r.data);
    return r.data;
  }, []);

  return { info, loading: info === null && !error, error, join };
}
