"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Download, FileSpreadsheet, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { getPreviousReportDateRange } from "@/lib/report-date-range";

type ReportMeta = {
  totalItems: number;
  fechaDesde: string;
  fechaHasta: string;
};

type ComparisonMeta = {
  current: ReportMeta;
  previous: ReportMeta;
};

export default function ReportesPage() {
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [fechaDesdeAnterior, setFechaDesdeAnterior] = useState("");
  const [fechaHastaAnterior, setFechaHastaAnterior] = useState("");
  const [meta, setMeta] = useState<ComparisonMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!fechaDesde || !fechaHasta || fechaDesde > fechaHasta) return;
    const previous = getPreviousReportDateRange({ fechaDesde, fechaHasta });
    setFechaDesdeAnterior(previous.fechaDesde);
    setFechaHastaAnterior(previous.fechaHasta);
  }, [fechaDesde, fechaHasta]);

  async function consultar() {
    if (!fechaDesde || !fechaHasta) {
      setError("Debes seleccionar una fecha inicial y una final.");
      return;
    }
    if (fechaDesde > fechaHasta) {
      setError("La fecha inicial no puede ser mayor a la fecha final.");
      return;
    }
    if (!fechaDesdeAnterior || !fechaHastaAnterior) {
      setError("Debes seleccionar el rango anterior para realizar la comparación.");
      return;
    }
    if (fechaDesdeAnterior > fechaHastaAnterior) {
      setError("La fecha inicial anterior no puede ser mayor a la fecha final anterior.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({
        fechaDesde,
        fechaHasta,
        fechaDesdeAnterior,
        fechaHastaAnterior,
      });
      const res = await fetch(`/api/reportes/resueltos?${query.toString()}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo generar el reporte");
      }

      setMeta(data.meta && data.comparison?.previous?.meta
        ? { current: data.meta, previous: data.comparison.previous.meta }
        : null);
    } catch (err) {
      setMeta(null);
      setError(err instanceof Error ? err.message : "No se pudo generar el reporte");
    } finally {
      setLoading(false);
    }
  }

  async function exportarXlsx() {
    if (!meta) return;
    setExporting(true);
    try {
      const query = new URLSearchParams({
        fechaDesde: meta.current.fechaDesde,
        fechaHasta: meta.current.fechaHasta,
        fechaDesdeAnterior: meta.previous.fechaDesde,
        fechaHastaAnterior: meta.previous.fechaHasta,
      });
      const res = await fetch(`/api/reportes/kpi-export?${query.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "No se pudo exportar el reporte KPI");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `reporte_kpi_${meta.current.fechaDesde}_a_${meta.current.fechaHasta}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo exportar el reporte KPI");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="page">
      <section className="hero-panel hero-panel--compact">
        <div className="hero-panel__content">
          <div className="page-header">
            <span className="page-kicker">Módulo de reportes</span>
            <h1 className="page-title">Exportación XLSX por rango</h1>
            <p className="page-copy">Genera el detalle y la hoja ejecutiva KPI en un Excel por rango de fechas.</p>
          </div>
          <div className="hero-panel__meta">
            <span className="topbar-chip topbar-chip--accent">
              <FileSpreadsheet size={14} />
              {meta
                ? `${meta.current.totalItems} actuales · ${meta.previous.totalItems} anteriores`
                : "Sin consulta ejecutada"}
            </span>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="split">
          <div className="form-section">
            <div className="form-section__header">
              <h2 className="form-section__title">Período actual</h2>
              <p className="form-section__copy">Rango principal del reporte KPI.</p>
            </div>
            <div className="filters">
              <label className="field">
                <span className="label">Fecha desde</span>
                <input className="input" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
              </label>
              <label className="field">
                <span className="label">Fecha hasta</span>
                <input className="input" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
              </label>
            </div>
          </div>
          <div className="form-section">
            <div className="form-section__header">
              <h2 className="form-section__title">Período anterior</h2>
              <p className="form-section__copy">Se calcula automáticamente y puedes modificarlo.</p>
            </div>
            <div className="filters">
              <label className="field">
                <span className="label">Fecha desde</span>
                <input className="input" type="date" value={fechaDesdeAnterior} onChange={(e) => setFechaDesdeAnterior(e.target.value)} />
              </label>
              <label className="field">
                <span className="label">Fecha hasta</span>
                <input className="input" type="date" value={fechaHastaAnterior} onChange={(e) => setFechaHastaAnterior(e.target.value)} />
              </label>
            </div>
          </div>
        </div>
        <div className="actions-row">
          <button className="button" onClick={() => void consultar()} disabled={loading}>
            <Search size={15} />
            {loading ? "Consultando..." : "Generar reporte"}
          </button>
          <button className="nav-link" onClick={() => void exportarXlsx()} disabled={!meta || exporting}>
            <Download size={15} />
            {exporting ? "Exportando..." : "Exportar XLSX KPI"}
          </button>
          <button
            className="nav-link"
            onClick={() => {
              setFechaDesde("");
              setFechaHasta("");
              setFechaDesdeAnterior("");
              setFechaHastaAnterior("");
              setMeta(null);
              setError(null);
            }}
          >
            Limpiar
          </button>
        </div>
      </section>

      <section className="card">
        {error && <p className="error">{error}</p>}
        {!error && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {meta ? (
              <p className="muted">
                Período actual: {meta.current.totalItems} registros entre {meta.current.fechaDesde} y {meta.current.fechaHasta}.{" "}
                Período anterior: {meta.previous.totalItems} registros entre {meta.previous.fechaDesde} y {meta.previous.fechaHasta}.
              </p>
            ) : (
              <p className="muted">Selecciona un rango y genera el reporte para habilitar la exportación.</p>
            )}
          </motion.div>
        )}
      </section>
    </main>
  );
}
