"use client";

import { useCallback, useRef } from "react";

export interface UseTallyNavigationOptions {
  /** Optional callback triggered when validation fails on Enter */
  onValidationError?: (element: HTMLElement, message: string) => void;
}

export function useTallyNavigation(options: UseTallyNavigationOptions = {}) {
  const containerRef = useRef<HTMLFormElement | HTMLDivElement | null>(null);

  const getFocusableFields = useCallback(() => {
    if (!containerRef.current) return [];
    
    // Query all potential focusable form fields inside container
    const candidates = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(
        "input, select, textarea, button"
      )
    );

    return candidates.filter((el) => {
      // Must be visible
      if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.tagName !== "OPTION") {
        return false;
      }
      
      // Hidden inputs, disabled, or readOnly fields are skipped
      if (el.getAttribute("type") === "hidden") return false;
      if ((el as HTMLInputElement).disabled) return false;
      if ((el as HTMLInputElement).readOnly) return false;
      if (el.getAttribute("aria-hidden") === "true") return false;
      if (el.getAttribute("data-tally-skip") === "true") return false;
      if (el.tabIndex === -1) return false;

      return true;
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key !== "Enter") return;

      const activeElement = document.activeElement as HTMLElement | null;
      if (!activeElement || !containerRef.current?.contains(activeElement)) return;

      const tagName = activeElement.tagName.toLowerCase();

      // Textarea special behavior: Plain Enter creates newline; Ctrl+Enter or Alt+Enter advances focus
      if (tagName === "textarea") {
        if (!e.ctrlKey && !e.altKey) {
          // Allow normal newline in textarea
          return;
        }
      }

      // If active element is a button (and not Shift+Enter), allow standard click behavior
      if (tagName === "button" && !e.shiftKey) {
        return;
      }

      // Prevent default form submission on Enter inside input/select controls
      e.preventDefault();

      // Check HTML5 validity on required or numeric fields on Enter
      if ("checkValidity" in activeElement && typeof (activeElement as any).checkValidity === "function") {
        const inputEl = activeElement as HTMLInputElement;
        if (!inputEl.checkValidity()) {
          inputEl.reportValidity();
          if (options.onValidationError) {
            options.onValidationError(inputEl, inputEl.validationMessage);
          }
          return;
        }
      }

      const focusableFields = getFocusableFields();
      const currentIndex = focusableFields.indexOf(activeElement);

      if (currentIndex === -1) return;

      let nextIndex: number;
      if (e.shiftKey) {
        // Move backward
        nextIndex = currentIndex - 1;
      } else {
        // Move forward
        const explicitNextId = activeElement.getAttribute("data-tally-next");
        if (explicitNextId && containerRef.current) {
          const explicitTarget = containerRef.current.querySelector<HTMLElement>(
            `[data-tally-id="${explicitNextId}"], [name="${explicitNextId}"], #${explicitNextId}`
          );
          if (explicitTarget && focusableFields.includes(explicitTarget)) {
            nextIndex = focusableFields.indexOf(explicitTarget);
          } else {
            nextIndex = currentIndex + 1;
          }
        } else {
          nextIndex = currentIndex + 1;
        }
      }

      if (nextIndex >= 0 && nextIndex < focusableFields.length) {
        const nextElement = focusableFields[nextIndex];
        nextElement.focus();

        if (
          nextElement.tagName.toLowerCase() === "input" &&
          typeof (nextElement as HTMLInputElement).select === "function" &&
          (nextElement as HTMLInputElement).type !== "radio" &&
          (nextElement as HTMLInputElement).type !== "checkbox"
        ) {
          (nextElement as HTMLInputElement).select();
        }

        nextElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [getFocusableFields, options]
  );

  return {
    containerRef,
    handleKeyDown,
    getFocusableFields,
  };
}
