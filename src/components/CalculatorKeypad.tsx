"use client";

import { useState, useCallback, useEffect } from "react";

interface CalculatorKeypadProps {
  open: boolean;
  initialValue?: number;
  onConfirm: (value: number) => void;
  title?: string;
}

/**
 * Calculator keypad component for numeric input with addition support.
 * Auto-calculates when closed by clicking outside or pressing X.
 * Provides a mobile-friendly, touch-safe interface for entering amounts.
 */
export default function CalculatorKeypad({
  open,
  initialValue = 0,
  onConfirm,
  title = "Enter amount",
}: CalculatorKeypadProps) {
  const [expression, setExpression] = useState<string>("");

  // Initialize expression when component opens with initial value
  useEffect(() => {
    if (open) {
      setExpression(initialValue > 0 ? initialValue.toFixed(2) : "");
    }
  }, [open, initialValue]);

  const evaluateExpression = useCallback((expr: string): number => {
    const cleaned = expr.replace(/\s/g, '');
    if (!cleaned || cleaned === '+' || cleaned === '.') return 0;

    const parts = cleaned.split('+').filter(p => p !== '');
    const sum = parts.reduce((acc, part) => {
      const num = parseFloat(part);
      return acc + (isNaN(num) ? 0 : num);
    }, 0);

    return Math.round(sum * 100) / 100; // Round to 2 decimal places
  }, []);

  const handleKeyPress = useCallback((key: string) => {
    setExpression((prev) => {
      const newExpr = prev + key;

      // Validate: prevent multiple decimals in a single number
      if (key === '.') {
        const parts = prev.split('+');
        const lastPart = parts[parts.length - 1];
        if (lastPart.includes('.')) {
          return prev; // Don't add another decimal
        }
      }

      // Validate: prevent starting with + or having consecutive +
      if (key === '+') {
        if (prev === '' || prev.endsWith('+')) {
          return prev;
        }
      }

      return newExpr;
    });
  }, []);

  const handleBackspace = useCallback(() => {
    setExpression((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setExpression("");
  }, []);

  const handleClose = useCallback(() => {
    const result = evaluateExpression(expression);
    onConfirm(result);
  }, [expression, evaluateExpression, onConfirm]);

  // Handle keyboard input for desktop testing
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === '.') {
        handleKeyPress('.');
      } else if (e.key === '+') {
        handleKeyPress('+');
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'Enter') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyPress, handleBackspace, handleClose]);

  if (!open) return null;

  // Display expression or calculated result preview
  const displayValue = expression || "0";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={handleClose}>
      <div
        className="bg-white rounded-t-3xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Display */}
        <div className="p-6 bg-gray-50">
          <div className="text-right">
            <div className="text-4xl font-bold text-gray-900 tracking-tight">
              ${displayValue}
            </div>
            {expression.includes('+') && (
              <div className="text-sm text-gray-500 mt-2">
                = ${evaluateExpression(expression).toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* Keypad */}
        <div className="p-4 bg-white">
          <div className="grid grid-cols-4 gap-3 max-w-xs mx-auto">
            {/* Row 1 */}
            <button
              onClick={() => handleKeyPress('7')}
              className="h-16 w-16 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 active:scale-95 rounded-2xl text-2xl font-semibold text-gray-900 transition-all touch-manipulation"
              aria-label="7"
            >
              7
            </button>
            <button
              onClick={() => handleKeyPress('8')}
              className="h-16 w-16 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 active:scale-95 rounded-2xl text-2xl font-semibold text-gray-900 transition-all touch-manipulation"
              aria-label="8"
            >
              8
            </button>
            <button
              onClick={() => handleKeyPress('9')}
              className="h-16 w-16 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 active:scale-95 rounded-2xl text-2xl font-semibold text-gray-900 transition-all touch-manipulation"
              aria-label="9"
            >
              9
            </button>
            <button
              onClick={handleClear}
              className="h-16 w-16 bg-[var(--danger)] hover:bg-red-600 active:bg-red-700 active:scale-95 rounded-2xl text-2xl font-semibold text-white transition-all touch-manipulation"
              aria-label="Clear"
            >
              C
            </button>

            {/* Row 2 */}
            <button
              onClick={() => handleKeyPress('4')}
              className="h-16 w-16 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 active:scale-95 rounded-2xl text-2xl font-semibold text-gray-900 transition-all touch-manipulation"
              aria-label="4"
            >
              4
            </button>
            <button
              onClick={() => handleKeyPress('5')}
              className="h-16 w-16 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 active:scale-95 rounded-2xl text-2xl font-semibold text-gray-900 transition-all touch-manipulation"
              aria-label="5"
            >
              5
            </button>
            <button
              onClick={() => handleKeyPress('6')}
              className="h-16 w-16 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 active:scale-95 rounded-2xl text-2xl font-semibold text-gray-900 transition-all touch-manipulation"
              aria-label="6"
            >
              6
            </button>
            <button
              onClick={handleBackspace}
              className="h-16 w-16 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 active:scale-95 rounded-2xl text-2xl font-semibold text-gray-700 transition-all touch-manipulation"
              aria-label="Backspace"
            >
              ⌫
            </button>

            {/* Row 3 */}
            <button
              onClick={() => handleKeyPress('1')}
              className="h-16 w-16 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 active:scale-95 rounded-2xl text-2xl font-semibold text-gray-900 transition-all touch-manipulation"
              aria-label="1"
            >
              1
            </button>
            <button
              onClick={() => handleKeyPress('2')}
              className="h-16 w-16 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 active:scale-95 rounded-2xl text-2xl font-semibold text-gray-900 transition-all touch-manipulation"
              aria-label="2"
            >
              2
            </button>
            <button
              onClick={() => handleKeyPress('3')}
              className="h-16 w-16 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 active:scale-95 rounded-2xl text-2xl font-semibold text-gray-900 transition-all touch-manipulation"
              aria-label="3"
            >
              3
            </button>
            <button
              onClick={() => handleKeyPress('+')}
              className="h-16 w-16 bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:bg-blue-700 active:scale-95 rounded-2xl text-2xl font-semibold text-white transition-all touch-manipulation"
              aria-label="Plus"
            >
              +
            </button>

            {/* Row 4 */}
            <button
              onClick={() => handleKeyPress('0')}
              className="h-16 w-16 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 active:scale-95 rounded-2xl text-2xl font-semibold text-gray-900 transition-all touch-manipulation"
              aria-label="0"
            >
              0
            </button>
            <button
              onClick={() => handleKeyPress('.')}
              className="h-16 w-16 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 active:scale-95 rounded-2xl text-2xl font-semibold text-gray-900 transition-all touch-manipulation"
              aria-label="Decimal point"
            >
              .
            </button>
            <button
              onClick={handleClear}
              className="col-span-2 h-16 bg-gray-300 hover:bg-gray-400 active:bg-gray-500 active:scale-95 rounded-2xl text-lg font-semibold text-gray-700 transition-all touch-manipulation"
              aria-label="Clear all"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="px-4 py-3 bg-gray-50 text-center">
          <p className="text-xs text-gray-500">
            Tap outside or press ✕ to save
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}