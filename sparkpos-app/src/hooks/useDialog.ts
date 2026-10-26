import { useEffect, useRef } from 'react';

/**
 * Perilaku dialog standar untuk semua modal:
 *  - Esc menutup dialog paling atas
 *  - Tab / Shift+Tab berputar di dalam dialog (focus trap)
 *  - Fokus awal ke elemen [data-autofocus] / [autofocus] / input pertama
 *  - Fokus dikembalikan ke elemen sebelumnya saat dialog ditutup
 *  - Shortcut global (F-key kasir) dinonaktifkan selama ada dialog terbuka (lihat isDialogOpen)
 */
interface DialogEntry {
  close: () => void;
  el: () => HTMLElement | null;
}

const stack: DialogEntry[] = [];

export function isDialogOpen(): boolean {
  return stack.length > 0;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

export function useDialog<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void
) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const entry: DialogEntry = { close: () => closeRef.current(), el: () => ref.current };
    const previouslyFocused = document.activeElement as HTMLElement | null;
    stack.push(entry);

    const focusTimer = window.setTimeout(() => {
      const root = ref.current;
      if (!root || root.contains(document.activeElement)) return;
      const target =
        root.querySelector<HTMLElement>('[data-autofocus], [autofocus]') ||
        root.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]), select, textarea') ||
        focusables(root)[0];
      target?.focus();
      if (target instanceof HTMLInputElement && target.type !== 'checkbox' && target.type !== 'radio') {
        target.select?.();
      }
    }, 30);

    const onKeyDown = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== entry) return; // hanya dialog paling atas

      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;
        e.preventDefault();
        e.stopPropagation();
        entry.close();
        return;
      }

      if (e.key === 'Tab') {
        const root = ref.current;
        if (!root) return;
        const items = focusables(root);
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (!active || !root.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      window.clearTimeout(focusTimer);
      const idx = stack.indexOf(entry);
      if (idx >= 0) stack.splice(idx, 1);
      window.setTimeout(() => {
        if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
      }, 0);
    };
  }, [open]);

  return ref;
}
