"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import chroma from "chroma-js";

type Serie = { label: string; total: number };

type RawTipo = { tipo_servicio: string; total: number };

type RawMotivo = { motivo_servicio: string; total: number };

type RawCanal = { canal_oficina: string; total: number };

type RawTiempo = { rango: string; total: number };

export default function GraficosPage() {
  const [mes, setMes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tipos, setTipos] = useState<Serie[]>([]);
  const [motivos, setMotivos] = useState<Serie[]>([]);
  const [canales, setCanales] = useState<Serie[]>([]);
  const [tiempos, setTiempos] = useState<Serie[]>([]);
  const [tab, setTab] = useState<"tipos" | "motivos" | "canales" | "tiempo">("tipos");

  const loadedRef = useRef(false);

  async function load() {
    setLoading(true);
    setError(null);
    const query = mes ? `?mes=${mes}` : "";
    try {
      const [tipRes, motRes, canRes, timeRes] = await Promise.all([
        fetch(`/api/reportes/tiposervicio${query}`),
        fetch(`/api/reportes/motivos${query}`),
        fetch(`/api/reportes/canales${query}`),
        fetch(`/api/reportes/tiempo${query}`),
      ]);

      if (!tipRes.ok || !motRes.ok || !canRes.ok || !timeRes.ok) {
        throw new Error("No se pudieron cargar los reportes");
      }

      const [tipData, motData, canData, timeData] = await Promise.all([
        tipRes.json(),
        motRes.json(),
        canRes.json(),
        timeRes.json(),
      ]);

      setTipos((tipData.items as RawTipo[]).map((i) => ({ label: i.tipo_servicio, total: i.total })));
      setMotivos((motData.items as RawMotivo[]).map((i) => ({ label: i.motivo_servicio, total: i.total })));
      setCanales((canData.items as RawCanal[]).map((i) => ({ label: i.canal_oficina, total: i.total })));
      setTiempos((timeData.items as RawTiempo[]).map((i) => ({ label: i.rango, total: i.total })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar reportes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void load();
  }, []);

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Gráficos</h1>
        <p className="page-subtitle">Reportes por tipo, motivo, canal y tiempo de respuesta.</p>
      </header>

      <section className="card">
        <div className="filters">
          <label className="field">
            <span className="label">Mes</span>
            <input className="input" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button className="button" onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Actualizar"}
          </button>
          <button className="nav-link" onClick={() => setMes("")}>Limpiar</button>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <section className="card">
        <div className="tabs">
          <button className={`tab ${tab === "tipos" ? "active" : ""}`} onClick={() => setTab("tipos")}>
            Tipos de servicio
          </button>
          <button className={`tab ${tab === "motivos" ? "active" : ""}`} onClick={() => setTab("motivos")}>
            Motivos de servicio
          </button>
          <button className={`tab ${tab === "canales" ? "active" : ""}`} onClick={() => setTab("canales")}>
            Canales de atención
          </button>
          <button className={`tab ${tab === "tiempo" ? "active" : ""}`} onClick={() => setTab("tiempo")}>
            Tiempo de respuesta
          </button>
        </div>
      </section>

      {tab === "tipos" && <ChartBlock title="Tipos de servicio" items={tipos} />}
      {tab === "motivos" && <ChartBlock title="Motivos de servicio" items={motivos} />}
      {tab === "canales" && <ChartBlock title="Canales de atención" items={canales} />}
      {tab === "tiempo" && <ChartBlock title="Tiempo de respuesta" items={tiempos} />}
    </main>
  );
}

function ChartBlock({ title, items }: { title: string; items: Serie[] }) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const pieRef = useRef<HTMLDivElement | null>(null);
  const [isExportingBar, setIsExportingBar] = useState(false);
  const [isExportingPie, setIsExportingPie] = useState(false);

  const max = items.reduce((acc, item) => Math.max(acc, item.total), 0);
  const colors = useMemo(() => {
    if (items.length === 0) return [];
    return chroma
      .scale(["#1f3a8a", "#2563eb", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444"])
      .mode("lch")
      .colors(items.length);
  }, [items.length]);

  async function exportPng(target: "bar" | "pie") {
    const ref = target === "bar" ? barRef.current : pieRef.current;
    if (!ref) return;
    const html2canvas = (await import("html2canvas")).default;
    if (target === "bar") setIsExportingBar(true);
    if (target === "pie") setIsExportingPie(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const canvas = await html2canvas(ref, {
      backgroundColor: "#ffffff",
      scale: 2,
    });
    if (target === "bar") setIsExportingBar(false);
    if (target === "pie") setIsExportingPie(false);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `grafico_${title.replace(/\s+/g, "_").toLowerCase()}_${target}.png`;
    link.click();
  }

  return (
    <section className="card">
      <div className="page-header">
        <h2 className="page-title" style={{ fontSize: "1.5rem" }}>{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="muted">Sin datos para mostrar.</p>
      ) : (
        <div className="charts-grid">
          <div className="chart-panel">
            <div className={`bar-chart ${isExportingBar ? "bar-chart--export" : ""}`} ref={barRef}>
              {items.map((item, index) => (
                <div key={item.label} className="bar-row">
                  <div>{item.label}</div>
                  <div className="bar-track">
                    <div
                      className="bar"
                      style={{
                        width: `${max ? Math.round((item.total / max) * 100) : 0}%`,
                        background: colors[index] || "#1f3a8a",
                      }}
                    />
                  </div>
                  <div className="bar-value">{item.total}</div>
                </div>
              ))}
            </div>
            <button className="nav-link" onClick={() => exportPng("bar")}>
              Exportar PNG (Barras)
            </button>
          </div>

          <div className="chart-panel">
            <div className={`pie-chart ${isExportingPie ? "bar-chart--export" : ""}`} ref={pieRef}>
              <PieChart items={items} colors={colors} />
            </div>
            <button className="nav-link" onClick={() => exportPng("pie")}>
              Exportar PNG (Pastel)
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function PieChart({ items, colors }: { items: Serie[]; colors: string[] }) {
  const total = items.reduce((acc, item) => acc + item.total, 0);
  const radius = 90;
  const cx = 110;
  const cy = 110;
  let cumulative = 0;

  const slices = items.map((item, index) => {
    const value = total ? item.total / total : 0;
    const startAngle = cumulative * 2 * Math.PI;
    const endAngle = (cumulative + value) * 2 * Math.PI;
    cumulative += value;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    const d = [
      `M ${cx} ${cy}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      "Z",
    ].join(" ");

    return { d, color: colors[index] || "#1f3a8a", label: item.label, total: item.total };
  });

  return (
    <div className="pie-wrap">
      <svg width={220} height={220} viewBox="0 0 220 220">
        {slices.map((slice, idx) => (
          <path key={idx} d={slice.d} fill={slice.color} />
        ))}
      </svg>
      <div className="pie-legend">
        {slices.map((slice, idx) => (
          <div key={idx} className="pie-legend-row">
            <span className="pie-dot" style={{ background: slice.color }} />
            <span>{slice.label}</span>
            <span className="pie-value">{slice.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
