import { useEffect } from 'react';

// Shared modal behavior: Escape closes, and the page behind is scroll-locked so
// iOS doesn't drag the dashboard around while you scroll a modal's contents.
export const useModalDismiss = (onClose: () => void): void => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);
};
