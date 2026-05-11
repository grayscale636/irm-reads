import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "irm:yearly-goal";

interface GoalMap {
  [year: number]: number;
}

function read(): GoalMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function useYearlyGoal(year: number): {
  goal: number | null;
  setGoal: (n: number | null) => void;
} {
  const [map, setMap] = useState<GoalMap>(read);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setMap(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setGoal = useCallback(
    (n: number | null) => {
      setMap((prev) => {
        const next = { ...prev };
        if (n === null || n <= 0) {
          delete next[year];
        } else {
          next[year] = n;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [year],
  );

  return { goal: map[year] ?? null, setGoal };
}
