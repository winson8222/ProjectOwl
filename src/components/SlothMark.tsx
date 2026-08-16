"use client";

/**
 * The ItreSplit sloth.
 *
 * Simplified from the illustrated app icon — that version has a calculator,
 * a notepad and a pen, which are lovely at 1024px and unreadable at 30. What
 * survives shrinking is the silhouette: the visor, the wide face, and the two
 * dark eye patches. Everything else was noise at the sizes this actually gets
 * used (22px in the header, 34px on the ItreAI button, 52px in the scan
 * confirmation).
 *
 * Monochrome by design. The body takes currentColor so the mark re-tints with
 * whatever it sits on, and the fixed features are tokens — a full-colour
 * brown-and-green sloth would introduce two hues the palette doesn't have and
 * fight the Blueberry it usually sits on.
 */
export default function SlothMark({
  size = 34,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden
    >
      {/* Head — wide and low, the way a sloth's reads. */}
      <ellipse cx="32" cy="38" rx="21" ry="19" fill="currentColor" />

      {/* Face patch, lighter, so the eye patches have something to sit on. */}
      <ellipse cx="32" cy="40" rx="15" ry="14" className="sloth-face" />

      {/* The eye patches are the whole character — a sloth is unmistakable
          from these two dark wedges alone. Angled down toward the nose. */}
      <ellipse
        cx="24"
        cy="37"
        rx="6.4"
        ry="7.4"
        className="sloth-patch"
        transform="rotate(-16 24 37)"
      />
      <ellipse
        cx="40"
        cy="37"
        rx="6.4"
        ry="7.4"
        className="sloth-patch"
        transform="rotate(16 40 37)"
      />
      <circle cx="24.5" cy="37" r="2.5" className="sloth-eye" />
      <circle cx="39.5" cy="37" r="2.5" className="sloth-eye" />

      {/* Snout */}
      <ellipse cx="32" cy="46" rx="3" ry="2.2" className="sloth-nose" />
      <path
        d="M28.5 49.5c2 2 5 2 7 0"
        className="sloth-smile"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Visor. The one borrowed detail worth keeping: it reads as a shape at
          any size and it's what makes this sloth *this* sloth. */}
      <path
        d="M11 24.5c0-7.5 9.4-13 21-13s21 5.5 21 13c0 1.9-1.6 3-3.6 3H14.6c-2 0-3.6-1.1-3.6-3Z"
        className="sloth-visor"
      />
      <path
        d="M13.5 22.5c3.5-3.4 10.6-5.8 18.5-5.8s15 2.4 18.5 5.8"
        className="sloth-visor-seam"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
