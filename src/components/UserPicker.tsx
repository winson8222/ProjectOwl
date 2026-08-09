"use client";

import { useState, useEffect } from "react";
import UserAvatar from "./UserAvatar";

interface User {
  id: string;
  name: string;
  email: string;
}

interface UserPickerProps {
  selectedUserIds: string[];
  onChange: (userIds: string[]) => void;
  excludeUserId?: string; // don't show this user (e.g. current user)
  label?: string;
  /** When given, pick from this list instead of fetching all users
   *  (e.g. only a group's members). */
  users?: User[];
}

/**
 * Multi-select participant picker.
 * Shows friend list, toggles on tap.
 * Reused across manual entry, review, and assign flows.
 */
export default function UserPicker({
  selectedUserIds,
  onChange,
  excludeUserId,
  label = "Select participants",
  users: providedUsers,
}: UserPickerProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (providedUsers) {
      setUsers(
        excludeUserId
          ? providedUsers.filter((u) => u.id !== excludeUserId)
          : providedUsers
      );
      setLoading(false);
      return;
    }
    fetch("/api/users")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          let list = json.data as User[];
          if (excludeUserId) {
            list = list.filter((u: User) => u.id !== excludeUserId);
          }
          setUsers(list);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [excludeUserId, providedUsers]);

  const toggle = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onChange(selectedUserIds.filter((id) => id !== userId));
    } else {
      onChange([...selectedUserIds, userId]);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {label && <p className="text-sm font-medium text-ink">{label}</p>}
        <div className="flex gap-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-16 h-16 bg-canvas rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium text-ink">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {users.map((user) => {
          const isSelected = selectedUserIds.includes(user.id);
          return (
            <button
              key={user.id}
              onClick={() => toggle(user.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all min-w-[64px] ${
                isSelected
                  ? "border-[var(--primary)] bg-blueberry-100"
                  : "border-transparent bg-canvas hover:bg-canvas"
              }`}
            >
              <UserAvatar name={user.name} size="sm" />
              <span className="text-xs font-medium text-ink truncate max-w-[60px]">
                {user.name}
              </span>
              {isSelected && (
                <span className="text-[10px] text-[var(--primary)] font-semibold">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
