"use client";

import { CSSProperties, ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const focusableSelector = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

let scrollLockCount = 0;
let previousBodyOverflow = "";
let previousBodyPaddingRight = "";
let previousHtmlOverflow = "";

interface AccessibleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  dismissible?: boolean;
  role?: "dialog" | "alertdialog";
}

export default function AccessibleDialog({
  isOpen,
  onClose,
  labelledBy,
  describedBy,
  className,
  style,
  children,
  dismissible = true,
  role = "dialog",
}: AccessibleDialogProps) {
  const [portalNode, setPortalNode] = useState<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const node = document.createElement("div");
    node.dataset.accessibleDialogPortal = "true";
    document.body.appendChild(node);
    setPortalNode(node);
    return () => node.remove();
  }, []);

  useEffect(() => {
    if (!isOpen || !portalNode) return;

    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const siblings = Array.from(document.body.children).filter((element) => element !== portalNode) as HTMLElement[];
    const priorStates = siblings.map((element) => ({
      element,
      inert: element.hasAttribute("inert"),
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    siblings.forEach((element) => {
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    });

    if (scrollLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      previousBodyPaddingRight = document.body.style.paddingRight;
      previousHtmlOverflow = document.documentElement.style.overflow;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    scrollLockCount += 1;

    requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const initialFocus = dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]");
      const firstFocusable = dialog.querySelector<HTMLElement>(focusableSelector);
      (initialFocus ?? firstFocusable ?? dialog).focus({ preventScroll: true });
    });

    return () => {
      priorStates.forEach(({ element, inert, ariaHidden }) => {
        if (inert) element.setAttribute("inert", ""); else element.removeAttribute("inert");
        if (ariaHidden === null) element.removeAttribute("aria-hidden"); else element.setAttribute("aria-hidden", ariaHidden);
      });
      scrollLockCount -= 1;
      if (scrollLockCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
        document.body.style.paddingRight = previousBodyPaddingRight;
        document.documentElement.style.overflow = previousHtmlOverflow;
      }
      const trigger = triggerRef.current;
      requestAnimationFrame(() => {
        if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      });
    };
  }, [isOpen, portalNode]);

  if (!isOpen || !portalNode) return null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && dismissible) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      .filter((element) => !element.hasAttribute("hidden") && element.getClientRects().length > 0);
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      ref={dialogRef}
      className={className}
      style={style}
      role={role}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </div>,
    portalNode,
  );
}
