"use client";

import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { cancelLeave, confirmLeave, subscribeDraftGuard } from "@/lib/draft-guard";

/**
 * Hosts the "leave without saving?" prompt.
 *
 * Lives in the app shell rather than inside the wizard: the wizard sits in
 * PageSlider's transformed track, where `position: fixed` is relative to the
 * track instead of the viewport, so a sheet rendered from there would be
 * misplaced. Up here it's a plain fixed overlay.
 */
export default function DraftLeaveGuard() {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => subscribeDraftGuard(setBlocked), []);

  return (
    <ConfirmDialog
      open={blocked}
      title="Leave without saving?"
      message="This expense hasn't been saved. If you go to another page now, the items and split you've entered will be discarded."
      confirmLabel="Discard and leave"
      cancelLabel="Keep editing"
      variant="danger"
      onConfirm={confirmLeave}
      onCancel={cancelLeave}
    />
  );
}
