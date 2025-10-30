"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type Summary = { income: number; expense: number; balance: number };

export default function Summary() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/transactions/summary/");
        setSummary(res.data as Summary);
      } catch (e: any) {
        setErr(e?.response?.data?.detail || "Failed to load summary");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section className="section">
      <h2 style={{ margin: "0 0 10px", fontSize: 20 }}>Your Summary</h2>
      {loading && <p>Loading summary…</p>}
      {err && <p style={{ color: "crimson" }}>{err}</p>}

      <div className="grid grid-3">
        <div className="card card-pad stat">
          <div className="label">Income</div>
          <div className="value">{(summary?.income ?? 0).toFixed(2)}</div>
        </div>
        <div className="card card-pad stat">
          <div className="label">Expense</div>
          <div className="value">{(summary?.expense ?? 0).toFixed(2)}</div>
        </div>
        <div className="card card-pad stat">
          <div className="label">Balance</div>
          <div className="value">{(summary?.balance ?? 0).toFixed(2)}</div>
        </div>
      </div>
    </section>
  );
}
