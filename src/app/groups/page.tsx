"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import UserPicker from "@/components/UserPicker";
import ErrorDialog from "@/components/ErrorDialog";
import { getSessionUser } from "@/lib/session";

/**
 * Drag-to-reorder hook with iOS-style physics
 */
function useDragReorder(items: any[], onReorder: (newOrder: any[]) => void) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [liveOrder, setLiveOrder] = useState<any[]>(items);
  const [dragOffset, setDragOffset] = useState(0); // How far the dragged item has moved
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const itemHeight = 74; // Height of each group row (including gap)

  // Update live order when items change
  useEffect(() => {
    if (!isDragging.current) {
      setLiveOrder(items);
    }
  }, [items]);

  const startDrag = useCallback((clientY: number, index: number) => {
    startY.current = clientY;
    setDragOffset(0);

    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      isDragging.current = true;
      setDraggingIndex(index);
      // Provide haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 200);
  }, []);

  const moveDrag = useCallback((clientY: number) => {
    if (!isDragging.current || draggingIndex === null) return;

    const deltaY = clientY - startY.current;
    setDragOffset(deltaY);

    // Calculate new position with item-based snapping
    const newIndex = Math.round(deltaY / itemHeight) + draggingIndex;
    const clampedIndex = Math.max(0, Math.min(items.length - 1, newIndex));

    // Real-time reordering - bump items aside as we drag
    if (clampedIndex !== draggingIndex) {
      const newOrder = [...liveOrder];
      const [draggedItem] = newOrder.splice(draggingIndex, 1);
      newOrder.splice(clampedIndex, 0, draggedItem);
      setLiveOrder(newOrder);
      setDraggingIndex(clampedIndex);
    }
  }, [draggingIndex, liveOrder, items.length, itemHeight]);

  const endDrag = useCallback(async () => {
    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (isDragging.current) {
      // Save the final order
      await onReorder(liveOrder);

      // Provide haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([50, 50, 50]);
      }
    }

    // Reset drag state
    isDragging.current = false;
    setDraggingIndex(null);
    setDragOffset(0);
  }, [liveOrder, onReorder]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent, index: number) => {
    startDrag(e.touches[0].clientY, index);
  }, [startDrag]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    moveDrag(e.touches[0].clientY);
  }, [moveDrag]);

  const handleTouchEnd = useCallback(() => {
    endDrag();
  }, [endDrag]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    startDrag(e.clientY, index);
  }, [startDrag]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    moveDrag(e.clientY);
  }, [moveDrag]);

  const handleMouseUp = useCallback(() => {
    endDrag();
  }, [endDrag]);

  return {
    draggingIndex,
    liveOrder,
    dragOffset,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}

/**
 * Groups tab — overall balance, list of your groups (settled ones hidden
 * behind a toggle), and a create-group form with a member picker.
 */
export default function GroupsPage() {
  const [user, setUser] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [orderedGroups, setOrderedGroups] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettled, setShowSettled] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  // Create-group form state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMembers, setNewMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [dialogError, setDialogError] = useState<{ title: string; message: string } | null>(null);

  const loadData = useCallback((currentUser: any) => {
    fetch(`/api/groups?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setGroups(json.data);
          setOrderedGroups(json.data);
        }
        else setError(json.error || "Failed to load groups");
      })
      .catch(() => setError("Failed to connect to the server"))
      .finally(() => setLoading(false));

    fetch(`/api/balances?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setBalance(json.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const currentUser = getSessionUser();
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setUser(currentUser);
    loadData(currentUser);
  }, [loadData]);

  const createGroup = async () => {
    if (!newName.trim() || !user) return;
    setCreating(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          creatorId: user.id,
          memberIds: newMembers,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowCreate(false);
        setNewName("");
        setNewMembers([]);
        setLoading(true);
        loadData(user);
      } else {
        setDialogError({ title: "Create failed", message: json.error || "Failed to create group" });
      }
    } catch {
      setDialogError({ title: "Create failed", message: "Failed to connect to the server" });
    } finally {
      setCreating(false);
    }
  };

  const handleReorder = async (newOrder: any[]) => {
    setIsReordering(true);
    try {
      const res = await fetch("/api/groups/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          groupIds: newOrder.map((g) => g.id),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setOrderedGroups(newOrder);
        // Update the main groups state too
        setGroups(newOrder);
      }
    } catch {
      setError("Failed to save new order");
    } finally {
      setIsReordering(false);
    }
  };

  const { draggingIndex, liveOrder, dragOffset, handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseDown, handleMouseMove, handleMouseUp } = useDragReorder(orderedGroups, handleReorder);

  // Add global mouse event listeners for drag operations
  useEffect(() => {
    if (draggingIndex !== null) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (handleMouseMove) {
          handleMouseMove(e as any);
        }
      };

      const handleGlobalMouseUp = (e: MouseEvent) => {
        if (handleMouseUp) {
          handleMouseUp(e as any);
        }
      };

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [draggingIndex, handleMouseMove, handleMouseUp]);

  // Update activeGroups to use live order during drag
  const activeGroups = liveOrder.filter((g) => !g.isSettled);
  const settledGroups = liveOrder.filter((g) => g.isSettled);

  if (!user) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4">
        <p className="text-sm text-gray-500">Please select a user from the home page first.</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-4 pt-6 pb-24 max-w-lg mx-auto">
      {/* Overall balance */}
      {balance && (
        <div className="mb-6">
          {/* Hero number card with animated background */}
          <div
            className={`rounded-2xl p-6 text-center mb-4 relative overflow-hidden border ${
              balance.netBalance >= 0 ? 'border-gray-200' : 'border-red-100'
            }`}
            style={{
              background: balance.netBalance >= 0
                ? 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(248,250,252,0.3) 100%)'
                : 'linear-gradient(135deg, rgba(254,226,226,0.4) 0%, rgba(253,242,242,0.3) 100%)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03), 0 4px 8px rgba(0,0,0,0.02)'
            }}
          >
            {/* Animated background */}
            {balance.netBalance > 0 ? (
              <div className="absolute inset-0 pointer-events-none">
                <div className="raining-cash">
                  {Array.from({ length: Math.min(Math.max(Math.floor(balance.netBalance / 2), 6), 30) }).map((_, i) => (
                    <span key={i}>💵</span>
                  ))}
                </div>
              </div>
            ) : balance.netBalance < 0 ? (
              <div className="absolute inset-0 pointer-events-none">
                <div className="falling-gandhi">
                  {Array.from({ length: Math.min(Math.max(Math.floor(Math.abs(balance.netBalance) / 2), 6), 30) }).map((_, i) => (
                    <img key={i} src="/gandhi.png" alt="Gandhi" className="gandhi-icon" />
                  ))}
                </div>
              </div>
            ) : null}

            <p className="text-sm text-gray-400 uppercase tracking-wider mb-2 relative z-10">
              {balance.netBalance >= 0 ? "UP GOOD" : "DOWN BAD"}
            </p>
            <p className={`text-4xl font-bold ${balance.netBalance >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"} relative z-10`}>
              {balance.netBalance >= 0 ? "+" : "-"}${Math.abs(balance.netBalance).toFixed(2)}
            </p>

            {/* Breakdown sentence */}
            <div className="text-center text-sm relative z-10">
              You are owed <span className="text-[var(--success)] font-bold">
                ${balance.totalOwed.toFixed(2)}
              </span>, and you owe <span className="text-[var(--danger)] font-bold">
                ${balance.totalOwe.toFixed(2)}
              </span>.
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Your Groups</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-sm font-semibold text-[var(--primary)] px-3 py-1.5 border border-[var(--primary)] rounded-lg hover:bg-blue-50"
        >
          {showCreate ? "Cancel" : "+ New group"}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          ⚠ {error}
        </div>
      )}

      {/* Create group form */}
      {showCreate && (
        <div
          className="mb-4 rounded-xl p-4 space-y-3 border border-gray-200 backdrop-blur-sm"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)'
          }}
        >
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Group name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Roommates, Japan Trip"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Participants (you&apos;re always included)
            </label>
            <UserPicker
              selectedUserIds={newMembers}
              onChange={setNewMembers}
              excludeUserId={user.id}
              label=""
            />
          </div>
          <button
            onClick={createGroup}
            disabled={creating || !newName.trim()}
            className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating..." : "Create group"}
          </button>
        </div>
      )}

      {/* Group list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full" />
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          No groups yet — create one to start splitting!
        </p>
      ) : (
        <>
          <div className="space-y-2" style={{ position: 'relative' }}>
            {activeGroups.map((g, index) => (
              <GroupRow
                key={g.id}
                group={g}
                index={index}
                isDragging={draggingIndex === index}
                dragOffset={draggingIndex === index ? dragOffset : 0}
                onTouchStart={(e) => handleTouchStart(e, index)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={(e) => handleMouseDown(e, index)}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              />
            ))}
            {activeGroups.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">All your groups are settled 🎉</p>
            )}
          </div>

          {/* Settled groups toggle */}
          {settledGroups.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowSettled(!showSettled)}
                className="w-full px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                {showSettled ? "Hide" : "Show"} settled groups ({settledGroups.length})
              </button>
              {showSettled && (
                <div className="space-y-2 mt-2">
                  {settledGroups.map((g) => <GroupRow key={g.id} group={g} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <ErrorDialog
        open={!!dialogError}
        title={dialogError?.title || "Error"}
        message={dialogError?.message || ""}
        onDismiss={() => setDialogError(null)}
      />
    </main>
  );
}

/** One tappable group row: colored circle, name, your net position. */
function GroupRow({
  group,
  index,
  isDragging = false,
  dragOffset = 0,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onMouseDown,
  onMouseMove,
  onMouseUp,
}: {
  group: any;
  index?: number;
  isDragging?: boolean;
  dragOffset?: number;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
}) {
  const net = group.yourNet ?? 0;

  // If dragging, render as a div instead of Link to prevent navigation
  if (isDragging) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 backdrop-blur-sm relative z-50 cursor-grabbing"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(248,250,252,0.4) 100%)',
          boxShadow: '0 8px 16px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)',
          transform: `translateY(${dragOffset}px) scale(1.05)`,
          opacity: 0.9,
          transition: 'transform 0.1s ease-out, opacity 0.2s ease',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      >
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="5" r="1.5"/>
            <circle cx="15" cy="5" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/>
            <circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="19" r="1.5"/>
            <circle cx="15" cy="19" r="1.5"/>
          </svg>
        </div>
        <div
          className="w-10 h-10 rounded-full shrink-0 ml-4"
          style={{
            background: `linear-gradient(135deg, ${group.color || "#9ca3af"} 0%, ${group.color || "#9ca3af"}dd 100%)`,
            boxShadow: '0 2px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3)'
          }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{group.name}</p>
          <p className="text-xs text-gray-400">
            {group.members.length} member{group.members.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="text-right">
          {Math.abs(net) < 0.005 ? (
            <p className="text-xs text-gray-400">Settled</p>
          ) : (
            <>
              <p className={`text-sm font-semibold ${net > 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                {net > 0 ? "+" : "-"}${Math.abs(net).toFixed(2)}
              </p>
              <p className="text-[10px] text-gray-400">
                {net > 0 ? "you get back" : "you owe"}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/groups/${group.id}`}
      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:scale-[1.02] border border-gray-200 hover:border-gray-300 backdrop-blur-sm"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(248,250,252,0.2) 100%)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      <div
        className="w-10 h-10 rounded-full shrink-0"
        style={{
          background: `linear-gradient(135deg, ${group.color || "#9ca3af"} 0%, ${group.color || "#9ca3af"}dd 100%)`,
          boxShadow: '0 2px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3)'
        }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{group.name}</p>
        <p className="text-xs text-gray-400">
          {group.members.length} member{group.members.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="text-right">
        {Math.abs(net) < 0.005 ? (
          <p className="text-xs text-gray-400">Settled</p>
        ) : (
          <>
            <p className={`text-sm font-semibold ${net > 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
              {net > 0 ? "+" : "-"}${Math.abs(net).toFixed(2)}
            </p>
            <p className="text-[10px] text-gray-400">
              {net > 0 ? "you get back" : "you owe"}
            </p>
          </>
        )}
      </div>
    </Link>
  );
}
