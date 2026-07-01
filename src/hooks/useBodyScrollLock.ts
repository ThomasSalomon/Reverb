import { useEffect } from 'react';

export function useBodyScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isOpen) {
      const originalHtmlStyle = window.getComputedStyle(document.documentElement).overflow;
      const originalBodyStyle = window.getComputedStyle(document.body).overflow;

      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';

      return () => {
        document.documentElement.style.overflow = originalHtmlStyle;
        document.body.style.overflow = originalBodyStyle;
      };
    }
  }, [isOpen]);
}
