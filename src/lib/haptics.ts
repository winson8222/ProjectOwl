/**
 * Haptic feedback.
 *
 * `navigator.vibrate` is a no-op on iOS Safari, so these fire only where the
 * platform supports them (Android/Chrome, and iOS via a PWA install on newer
 * versions). Treated as garnish throughout — nothing branches on whether the
 * buzz actually happened.
 *
 * Patterns are deliberately short. A haptic that outlasts the animation it
 * accompanies reads as a malfunction, not feedback.
 */

function fire(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw when called outside a user gesture. Ignore.
  }
}

/** Selection changed — assigning an item, toggling a participant. */
export const tapLight = () => fire(10);

/** A discrete commit — adding an expense, confirming assignments. */
export const tapMedium = () => fire(25);

/** Destructive confirm — deleting a transaction. */
export const tapHeavy = () => fire(40);

/** Settled up: a debt reached zero. The one celebratory pattern. */
export const tapSuccess = () => fire([18, 60, 18, 60, 45]);

/** Something failed. */
export const tapError = () => fire([40, 90, 40]);
