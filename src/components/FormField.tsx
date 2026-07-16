"use client";

import { useState, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

interface FormFieldProps {
  /** Human-readable label above the field. */
  label: string;
  /** Current value of the field — used by `validate` to compute the error. */
  value: unknown;
  /** Validation function: return an error string if invalid, or null if valid. */
  validate?: (value: unknown) => string | null;
  /** Optional suffix rendered next to the label (e.g. "(from items: $12.50)"). */
  labelSuffix?: ReactNode;
  /**
   * When true, forces the error message to display regardless of touched state.
   * Use this on save attempts so every empty field shows its error at once.
   */
  showError?: boolean;
  /** Extra classes on the wrapper div. */
  className?: string;
  children: ReactElement;
}

/**
 * Self-contained form field with inline validation.
 *
 * Tracks its own `touched` state (set when the child input loses focus).
 * When touched (or `showError` is set) and `validate(value)` returns a string,
 * the error message renders in red below the field.
 *
 * Pass `showError={showAllErrors}` to a group of fields so they all reveal
 * their errors when the user tries to save.
 *
 * Usage:
 * ```tsx
 * <FormField label="Description" value={title} validate={(v) => !v ? "Enter a description" : null}>
 *   <input value={title} onChange={...} />
 * </FormField>
 * ```
 */
export default function FormField({
  label,
  value,
  validate,
  labelSuffix,
  showError = false,
  className = "",
  children,
}: FormFieldProps) {
  const [touched, setTouched] = useState(false);

  const error = validate ? validate(value) : null;
  const show = showError || (touched && !!error);

  const child = isValidElement(children)
    ? cloneElement(children, {
        onBlur: (e: FocusEvent) => {
          setTouched(true);
          (children.props as { onBlur?: (e: FocusEvent) => void }).onBlur?.(e);
        },
      } as Record<string, unknown>)
    : children;

  return (
    <div className={className}>
      <label className="text-xs font-medium text-gray-500 mb-1 block">
        {label}
        {labelSuffix && (
          <span className="text-gray-400 font-normal ml-1">{labelSuffix}</span>
        )}
      </label>
      {child}
      {show && error && (
        <p className="text-xs text-[var(--danger)] mt-1">{error}</p>
      )}
    </div>
  );
}
