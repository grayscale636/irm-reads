import { useCallback, useEffect, useRef, useState } from "react";
import { getGoal, setGoal as apiSetGoal } from "@/lib/api";

export function useYearlyGoal(year: number): {
  goal: number | null;
  setGoal: (n: number | null) => Promise<void>;
  loading: boolean;
  error: string | null;
} {
  const [goal, setGoalState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const goalRef = useRef<number | null>(null);
  goalRef.current = goal;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getGoal(year)
      .then((g) => {
        if (mounted) {
          setGoalState(g);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [year]);

  const setGoal = useCallback(
    async (n: number | null) => {
      const previous = goalRef.current;
      // Optimistic update for snappy UI.
      setGoalState(n);
      setError(null);
      try {
        const stored = await apiSetGoal(year, n);
        setGoalState(stored);
      } catch (e) {
        // Roll back so UI matches the server.
        setGoalState(previous);
        setError(e instanceof Error ? e.message : "Failed to save goal");
      }
    },
    [year],
  );

  return { goal, setGoal, loading, error };
}
