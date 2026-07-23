"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface InvitePreview {
  token: string;
  group: { id: string; name: string; color: string | null };
  invitedBy: string;
  memberCount: number;
  alreadyMember: boolean;
}

/**
 * Invite landing page. Signed-out visitors see the LoginScreen (AppShell)
 * first — the URL survives sign-in in both auth modes — then land here to
 * preview the group and join with one tap.
 */
export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setPreview(json.data);
        else setError(json.error || "This invite link is invalid or has expired");
      })
      .catch(() => setError("Failed to connect to the server"))
      .finally(() => setLoading(false));
  }, [token]);

  const join = async () => {
    if (!preview) return;
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/invites/${token}`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        router.push(`/groups/${json.data.groupId}`);
      } else {
        setError(json.error || "Failed to join the group");
        setJoining(false);
      }
    } catch {
      setError("Failed to connect to the server");
      setJoining(false);
    }
  };

  if (loading) {
    return <main className="min-h-dvh" />;
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 pb-24">
      {preview ? (
        <>
          <div
            className="w-16 h-16 rounded-full mb-4 flex items-center justify-center text-2xl"
            style={{ backgroundColor: preview.group.color ?? "#60a5fa" }}
          >
            👥
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{preview.group.name}</h1>
          <p className="text-sm text-gray-500 mb-8">
            {preview.invitedBy} invited you ·{" "}
            {preview.memberCount} member{preview.memberCount === 1 ? "" : "s"}
          </p>

          {preview.alreadyMember ? (
            <Link
              href={`/groups/${preview.group.id}`}
              className="px-8 py-3 text-sm font-semibold text-white bg-[var(--primary)] rounded-xl hover:bg-[var(--primary-hover)] transition-colors"
            >
              You&apos;re already in — open group
            </Link>
          ) : (
            <button
              onClick={join}
              disabled={joining}
              className="px-8 py-3 text-sm font-semibold text-white bg-[var(--primary)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
            >
              {joining ? "Joining..." : "Join group"}
            </button>
          )}
          {error && <p className="mt-4 text-sm text-red-600">⚠ {error}</p>}
        </>
      ) : (
        <>
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invite not found</h1>
          <p className="text-sm text-gray-500 mb-8 text-center">
            {error ?? "This invite link is invalid or has expired."}
            <br />
            Ask for a fresh link, or get added by email.
          </p>
          <Link
            href="/groups"
            className="px-6 py-2.5 text-sm font-semibold text-[var(--primary)] border border-[var(--border)] rounded-xl hover:bg-gray-50 transition-colors"
          >
            Go to my groups
          </Link>
        </>
      )}
    </main>
  );
}
