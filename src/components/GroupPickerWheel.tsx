"use client";

import { useEffect, useRef, useState } from "react";

interface Group {
  id: string;
  name: string;
  color?: string;
}

interface GroupPickerWheelProps {
  groups: Group[];
  selectedGroupId: string;
  onGroupChange: (groupId: string) => void;
}

/**
 * iOS-style vertical picker wheel for group selection.
 * - Default: shows one group card
 * - Press/hold: expands to vertical scrollable wheel
 * - Scroll to select, release to collapse
 */
export default function GroupPickerWheel({
  groups,
  selectedGroupId,
  onGroupChange,
}: GroupPickerWheelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentScrollY, setCurrentScrollY] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef<HTMLDivElement>(null);
  const touchStartTime = useRef<number>(0);
  const longPressTimer = useRef<NodeJS.Timeout | undefined>(undefined);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || groups[0];
  const itemHeight = 80;
  const containerHeight = isExpanded ? 240 : 0;

  // Calculate initial scroll position to center selected item
  useEffect(() => {
    const selectedIndex = groups.findIndex((g) => g.id === selectedGroupId);
    if (selectedIndex !== -1) {
      setScrollPosition(selectedIndex * itemHeight);
    }
  }, [selectedGroupId, groups.length]);

  // Handle press start
  const handlePressStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (isExpanded) return;

    setIsPressed(true);
    touchStartTime.current = Date.now();
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setStartY(clientY);

    // Long press to expand (300ms)
    longPressTimer.current = setTimeout(() => {
      setIsExpanded(true);
      setIsPressed(false);
    }, 300);
  };

  // Handle press end
  const handlePressEnd = () => {
    clearTimeout(longPressTimer.current);
    setIsPressed(false);
    setStartY(0);

    // Collapse after delay if not dragging
    if (!isDragging && isExpanded) {
      setTimeout(() => {
        setIsExpanded(false);
      }, 200);
    }
  };

  // Handle drag in expanded mode
  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isExpanded) return;

    setIsDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = startY - clientY;
    setCurrentScrollY(deltaY);
  };

  // Calculate which item is selected based on scroll position
  useEffect(() => {
    if (!isExpanded) return;

    const totalScroll = scrollPosition + currentScrollY;
    const selectedIndex = Math.round(totalScroll / itemHeight);
    const clampedIndex = Math.max(0, Math.min(groups.length - 1, selectedIndex));

    const selectedGroup = groups[clampedIndex];
    if (selectedGroup && selectedGroup.id !== selectedGroupId) {
      onGroupChange(selectedGroup.id);
    }
  }, [currentScrollY, scrollPosition, groups, selectedGroupId, onGroupChange, isExpanded]);

  // Handle drag end
  const handleDragEnd = () => {
    if (!isExpanded) return;

    setIsDragging(false);
    const totalScroll = scrollPosition + currentScrollY;
    const selectedIndex = Math.round(totalScroll / itemHeight);
    const clampedIndex = Math.max(0, Math.min(groups.length - 1, selectedIndex));

    const newScrollPosition = clampedIndex * itemHeight;
    setScrollPosition(newScrollPosition);
    setCurrentScrollY(0);

    // Collapse after short delay
    setTimeout(() => {
      setIsExpanded(false);
    }, 300);
  };

  const handleGroupClick = (groupId: string) => {
    onGroupChange(groupId);
    setIsExpanded(false);
  };

  if (groups.length === 0) {
    return null;
  }

  const groupColor = selectedGroup?.color || "#3a85c5";

  return (
    <div className="relative mb-4">
      {/* Collapsed state - single group card */}
      {!isExpanded && (
        <div
          onTouchStart={handlePressStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handlePressEnd}
          onMouseDown={handlePressStart}
          onMouseMove={handleDragMove}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          className={`rounded-xl border transition-all duration-200 ${
            isPressed
              ? "border-[var(--primary)] scale-105"
              : "border-gray-200"
          }`}
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
            boxShadow: isPressed
              ? '0 2px 4px rgba(58, 133, 197, 0.15), 0 4px 8px rgba(58, 133, 197, 0.1), 0 8px 16px rgba(58, 133, 197, 0.05)'
              : '0 2px 4px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.04), 0 8px 12px rgba(0,0,0,0.02)'
          }}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Colored circle icon */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${groupColor} 0%, ${groupColor}dd 100%)`,
                boxShadow: '0 2px 4px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.3)'
              }}
            >
              {selectedGroup?.name.charAt(0).toUpperCase()}
            </div>

            {/* Group name */}
            <h3 className="text-sm font-semibold text-gray-900 flex-1">
              {selectedGroup?.name}
            </h3>

            {/* Chevron indicator */}
            <div className={`transition-transform duration-200 ${isPressed ? 'rotate-180' : ''}`}>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Expanded state - vertical scroll wheel */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setIsExpanded(false)}
          />

          {/* Scroll wheel */}
          <div
            ref={expandedRef}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
            style={{ width: '300px' }}
          >
            <div
              className="rounded-3xl border border-gray-200/60 overflow-hidden backdrop-blur-md"
              style={{
                height: `${containerHeight}px`,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(248,250,252,0.3) 100%)',
                boxShadow: '0 4px 8px rgba(0,0,0,0.08), 0 8px 16px rgba(0,0,0,0.06), 0 16px 32px rgba(0,0,0,0.04)'
              }}
            >
              {/* Selection indicator in center */}
              <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-[80px] bg-[var(--primary)]/10 border-y-2 border-[var(--primary)] pointer-events-none z-10" />

              {/* Scrollable items */}
              <div
                className="relative h-full overflow-hidden"
                style={{
                  transform: `translateY(${-scrollPosition - currentScrollY + containerHeight / 2 - itemHeight / 2}px)`,
                  transition: isDragging ? 'none' : 'transform 0.3s ease-out',
                }}
              >
                {groups.map((group, index) => {
                  const isSelected = group.id === selectedGroupId;
                  const itemColor = group.color || "#3a85c5";
                  const distanceFromCenter = Math.abs(index * itemHeight - (scrollPosition + currentScrollY));
                  const isNearCenter = distanceFromCenter < itemHeight / 2;

                  return (
                    <div
                      key={group.id}
                      onClick={() => handleGroupClick(group.id)}
                      className="flex items-center gap-4 px-6 cursor-pointer"
                      style={{
                        height: `${itemHeight}px`,
                        opacity: isNearCenter ? 1 : 0.4,
                        transform: `scale(${isNearCenter ? 1 : 0.9})`,
                        transition: 'opacity 0.2s, transform 0.2s',
                      }}
                    >
                      {/* Colored circle icon */}
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm flex-shrink-0"
                        style={{ backgroundColor: itemColor }}
                      >
                        {group.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Group name */}
                      <span
                        className={`font-medium ${
                          isSelected ? "text-[var(--primary)] text-lg" : "text-gray-600"
                        }`}
                      >
                        {group.name}
                      </span>

                      {/* Checkmark for selected */}
                      {isSelected && (
                        <div className="ml-auto">
                          <svg className="w-6 h-6 text-[var(--primary)]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Instructions */}
            <p className="text-center text-white text-sm mt-4 font-medium">
              Scroll to select, then release
            </p>
          </div>
        </>
      )}
    </div>
  );
}
