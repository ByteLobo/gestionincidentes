"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CatalogItem = { id: number; name: string; active: boolean };

type Ticket = {
  id: number;
  tipo_registro: string;
  solicitante: string;
  tipo_servicio: string;
  canal_oficina: string;
  gerencia: string;
  motivo_servicio: string;
  descripcion: string;
  encargado: string;
  fecha_reporte: string;
  hora_reporte: string;
  fecha_respuesta: string;
  hora_respuesta: string;
  accion_tomada: string;
  primer_contacto: boolean;
  tiempo_minutos: number;
  mes_atencion: string;
  categoria: string | null;
  porcentaje: number | null;
  estado: string;
};

export default function ResueltosPage() {
  const [items, setItems] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState("");
  const [tipoServicio, setTipoServicio] = useState("");
  const [canal, setCanal] = useState("");
  const [gerencia, setGerencia] = useState("");
  const [tipoRegistro, setTipoRegistro] = useState("");
  const [mes, setMes] = useState("");
  const [q, setQ] = useState("");

  const [serviceTypes, setServiceTypes] = useState<CatalogItem[]>([]);
  const [channels, setChannels] = useState<CatalogItem[]>([]);
  const [gerencias, setGerencias] = useState<CatalogItem[]>([]);
  const loadedRef = useRef(false);

  const formatDateTime = (date?: string, time?: string) => {
    if (!date) return "--";
    const datePart = date.includes("T") ? date.split("T")[0] : date;
    const [y, m, d] = datePart.split("-");
    const timePart = time
      ? time.split(".")[0]
      : date.includes("T")
        ? date.split("T")[1] || ""
        : "";
    const hhmm = timePart ? timePart.slice(0, 5) : "00:00";
    return `${y}/${m}/${d} ${hhmm}`;
  };

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    async function loadCatalogs() {
      const [tipoRes, canalRes, gerRes] = await Promise.all([
        fetch("/api/catalogos/tiposervicio"),
        fetch("/api/catalogos/canaloficina"),
        fetch("/api/catalogos/gerencia"),
      ]);
      const [tipoData, canalData, gerData] = await Promise.all([
        tipoRes.json(),
        canalRes.json(),
        gerRes.json(),
      ]);
      setServiceTypes(tipoData.items || []);
      setChannels(canalData.items || []);
      setGerencias(gerData.items || []);
    }
    void loadCatalogs();
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (tipoServicio) params.set("tipoServicio", tipoServicio);
    if (canal) params.set("canal", canal);
    if (gerencia) params.set("gerencia", gerencia);
    if (tipoRegistro) params.set("tipoRegistro", tipoRegistro);
    if (mes) params.set("mes", mes);
    if (q) params.set("q", q);
    return params.toString();
  }, [tipoServicio, canal, gerencia, tipoRegistro, mes, q]);

  async function fetchTickets() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/tickets?${queryString}`);
    if (!res.ok) {
      setError("No se pudieron cargar los tickets");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }

  async function exportXlsx() {
    if (items.length === 0) return;
    const XLSX = await import("xlsx");
    const rows = items.map((item) => ({
      id: item.id,
      tipo_registro: item.tipo_registro,
      solicitante: item.solicitante,
      tipo_servicio: item.tipo_servicio,
      canal_oficina: item.canal_oficina,
      gerencia: item.gerencia,
      motivo_servicio: item.motivo_servicio,
      descripcion: item.descripcion,
      encargado: item.encargado,
      mes_atencion: item.mes_atencion,
      reporte: formatDateTime(item.fecha_reporte, item.hora_reporte),
      respuesta: formatDateTime(item.fecha_respuesta, item.hora_respuesta),
      accion_tomada: item.accion_tomada,
      primer_contacto: item.primer_contacto ? "Sí" : "No",
      tiempo_minutos: item.tiempo_minutos,
      categoria: item.categoria ?? "",
      porcentaje: item.porcentaje ?? "",
      estado: item.estado,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Resueltos");
    XLSX.writeFile(workbook, `tickets_resueltos_${mes || "todos"}.xlsx`);
  }

  useEffect(() => {
    void fetchTickets();
  }, []);

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Tickets</h1>
        <p className="page-subtitle">Consulta y filtra todos los tickets por estado.</p>
      </header>

      <section className="card">
        <div className="filters">
          <label className="field">
            <span className="label">Estado</span>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="REGISTRADO">Registrado</option>
              <option value="EN_ATENCION">En atención</option>
              <option value="RESPONDIDO">Respondido</option>
              <option value="RESUELTO">Resuelto</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Tipo de servicio</span>
            <select className="select" value={tipoServicio} onChange={(e) => setTipoServicio(e.target.value)}>
              <option value="">Todos</option>
              {serviceTypes.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Canal / Oficina</span>
            <select className="select" value={canal} onChange={(e) => setCanal(e.target.value)}>
              <option value="">Todos</option>
              {channels.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Gerencia</span>
            <select className="select" value={gerencia} onChange={(e) => setGerencia(e.target.value)}>
              <option value="">Todas</option>
              {gerencias.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Tipo de registro</span>
            <select className="select" value={tipoRegistro} onChange={(e) => setTipoRegistro(e.target.value)}>
              <option value="">Todos</option>
              <option value="INCIDENTE">Incidente</option>
              <option value="SOPORTE">Soporte</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Mes</span>
            <input className="input" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">Búsqueda</span>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Solicitante o descripción" />
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button className="button" onClick={fetchTickets} disabled={loading}>
            {loading ? "Cargando..." : "Buscar"}
          </button>
          <button className="nav-link" onClick={exportXlsx} disabled={items.length === 0}>
            Exportar XLSX
          </button>
          <button
            className="nav-link"
            onClick={() => {
              setStatus("");
              setTipoServicio("");
              setCanal("");
              setGerencia("");
              setTipoRegistro("");
              setMes("");
              setQ("");
            }}
          >
            Limpiar
          </button>
        </div>
      </section>

      <section className="card">
        {error && <p className="error">{error}</p>}
        {items.length === 0 ? (
          <p className="muted">Sin resultados. Usa los filtros y presiona Buscar.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tipo</th>
                  <th>Solicitante</th>
                  <th>Tipo servicio</th>
                  <th>Canal</th>
                  <th>Gerencia</th>
                  <th>Motivo</th>
                  <th>Descripción</th>
                  <th>Encargado</th>
                  <th>Mes</th>
                  <th>Reporte</th>
                  <th>Respuesta</th>
                  <th>Acción tomada</th>
                  <th>Primer contacto</th>
                  <th>Tiempo (min)</th>
                  <th>Categoría</th>
                  <th>% KPI</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.tipo_registro}</td>
                    <td>{item.solicitante}</td>
                    <td>{item.tipo_servicio}</td>
                    <td>{item.canal_oficina}</td>
                    <td>{item.gerencia}</td>
                    <td>{item.motivo_servicio}</td>
                    <td>{item.descripcion}</td>
                    <td>{item.encargado}</td>
                    <td>{item.mes_atencion}</td>
                    <td>{formatDateTime(item.fecha_reporte, item.hora_reporte)}</td>
                    <td>{formatDateTime(item.fecha_respuesta, item.hora_respuesta)}</td>
                    <td>{item.accion_tomada}</td>
                    <td>{item.primer_contacto ? "Sí" : "No"}</td>
                    <td>{item.tiempo_minutos}</td>
                    <td>{item.categoria ?? "--"}</td>
                    <td>{item.porcentaje ?? "--"}</td>
                    <td>{item.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
