"use client";

// One hook for reading the contract, so every page handles a refusal the same
// way: the contract's own sentence, shown where the thing would have been.

import { useCallback, useEffect, useState } from "react";
import type { CalldataEncodable } from "genlayer-js/types";

import { describeRefusal, read } from "./dev";

export type Reading<T> = {
  value: T | null;
  busy: boolean;
  error: string;
  reload: () => void;
};

export function useRead<T>(
  functionName: string | null,
  args: CalldataEncodable[] = [],
): Reading<T> {
  const [value, setValue] = useState<T | null>(null);
  const [busy, setBusy] = useState(functionName !== null);
  const [error, setError] = useState("");
  const [turn, setTurn] = useState(0);
  const key = JSON.stringify(args, (_, held) =>
    typeof held === "bigint" ? held.toString() : held,
  );

  useEffect(() => {
    if (functionName === null) {
      setBusy(false);
      return;
    }
    let live = true;
    setBusy(true);
    setError("");
    read<T>(functionName, JSON.parse(key) as CalldataEncodable[])
      .then((held) => {
        if (live) setValue(held);
      })
      .catch((trouble) => {
        if (live) {
          setValue(null);
          setError(describeRefusal(trouble));
        }
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [functionName, key, turn]);

  const reload = useCallback(() => setTurn((n) => n + 1), []);
  return { value, busy, error, reload };
}
