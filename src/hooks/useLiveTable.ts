import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Options = {
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  filter?: { column: string; value: string | number };
};

export function useLiveTable<T = any>(table: string, opts: Options = {}) {
  const { orderBy = "created_at", ascending = false, limit = 100, filter } = opts;
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      let q = supabase.from(table as any).select("*").order(orderBy, { ascending }).limit(limit);
      if (filter) q = q.eq(filter.column, filter.value);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as T[]);
      }
    };

    load();

    const channel = supabase
      .channel(`live:${table}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, orderBy, ascending, limit, filter?.column, filter?.value]);

  return { rows: rows ?? [], loading: rows === null, empty: rows !== null && rows.length === 0, error };
}
