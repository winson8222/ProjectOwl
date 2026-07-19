"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import { getSessionUser } from "@/lib/session";

/**
 * Activity tab — a feed of everything that happened across all groups the
 * user belongs to (transactions, settlements, groups created, members added).
 */
export default function ActivityPage() {
  const [user, setUser] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const currentUser = getSessionUser();
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setUser(currentUser);

    fetch(`/api/activities?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setActivities(json.data);
        else setError(json.error || "Failed to load activity");
      })
      .catch(() => setError("Failed to connect to the server"))
      .finally(() => setLoading(false));
  }, []);

  if (!user) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4">
        <p className="text-sm text-gray-500">Please select a user from the home page first.</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-4 pt-6 pb-24 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Activity</h1>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full" />
        </div>
      ) : activities.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No activity yet</p>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => (
            <ActivityRow key={a.id} activity={a} currentUserId={user.id} />
          ))}
        </div>
      )}
    </main>
  );
}

/** One activity feed entry. */
function ActivityRow({ activity, currentUserId }: { activity: any; currentUserId: string }) {
  const a = activity;
  const actor = a.userId === currentUserId ? "You" : a.userName;
  const related =
    a.relatedUserId === currentUserId ? "you" : a.relatedUserName ?? "someone";

  const date = new Date(a.createdAt.replace(" ", "T")).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  let icon = "📝";
  let body: React.ReactNode = null;
  switch (a.type) {
    case "transaction":
      icon = "🧾";
      body = (
        <>
          <span className="font-medium">{actor}</span> added{" "}
          <span className="font-medium">
            {a.transactionTitle ? `“${a.transactionTitle}”` : "a transaction"}
          </span>
          {a.amount != null && <> · ${a.amount.toFixed(2)}</>}
        </>
      );
      break;
    case "payment":
    case "settlement":
      icon = "💸";
      body = (
        <>
          <span className="font-medium">{actor}</span> paid{" "}
          <span className="font-medium">{related}</span>
          {a.amount != null && <> ${a.amount.toFixed(2)}</>}
        </>
      );
      break;
    case "group_created":
      icon = "✨";
      body = (
        <>
          <span className="font-medium">{actor}</span> created the group
        </>
      );
      break;
    case "member_added":
      icon = "➕";
      body = (
        <>
          <span className="font-medium">{actor}</span> added{" "}
          <span className="font-medium">{related}</span>
        </>
      );
      break;
    default:
      body = <span className="font-medium">{actor}</span>;
  }

  // Transaction and payment rows deep-link to the transaction, everything
  // else to the group.
  const href =
    (a.type === "transaction" || a.type === "payment") && a.transactionId
      ? `/transactions/${a.transactionId}`
      : `/groups/${a.groupId}`;

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:bg-gray-50 transition-colors"
    >
      <span className="text-lg shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900">{body}</p>
        <p className="text-xs text-gray-400">
          in <span className="text-[var(--primary)]">{a.groupName}</span> · {date}
        </p>
      </div>
      {a.userId !== currentUserId && <UserAvatar name={a.userName} size="sm" />}
    </Link>
  );
}
