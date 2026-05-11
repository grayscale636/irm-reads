import { useCallback, useState } from "react";

const STORAGE_PREFIX = "irm:collapse:";

export function useCollapsible(key: string, defaultOpen = true): {
  open: boolean;
  toggle: () => void;
} {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      if (raw === null) return defaultOpen;
      return raw === "1";
    } catch {
      return defaultOpen;
    }
  });

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_PREFIX + key, next ? "1" : "0");
      } catch {
        // ignore quota / disabled storage
      }
      return next;
    });
  }, [key]);

  return { open, toggle };
}
