"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 20;

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

type TicketsMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export default function ResueltosPage() {
  const [items, setItems] = useState<Ticket[]>([]);
  const [meta, setMeta] = useState<TicketsMeta>({
    page: 1,
    pageSize: PAGE_SIZE,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [status, setStatus] = useState("");
  const [tipoServicio, setTipoServicio] = useState("");
  const [canal, setCanal] = useState("");
  const [gerencia, setGerencia] = useState("");
  const [tipoRegistro, setTipoRegistro] = useState("");
  const [mes, setMes] = useState("");
  const [q, setQ] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [encargado, setEncargado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [primerContacto, setPrimerContacto] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [tiempoMinDesde, setTiempoMinDesde] = useState("");
  const [tiempoMinHasta, setTiempoMinHasta] = useState("");

  const [serviceTypes, setServiceTypes] = useState<CatalogItem[]>([]);
  const [channels, setChannels] = useState<CatalogItem[]>([]);
  const [gerencias, setGerencias] = useState<CatalogItem[]>([]);
  const loadedRef = useRef(false);
  const reduceMotion = useReducedMotion();

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
    if (ticketId) params.set("id", ticketId);
    if (solicitante) params.set("solicitante", solicitante);
    if (encargado) params.set("encargado", encargado);
    if (motivo) params.set("motivo", motivo);
    if (categoria) params.set("categoria", categoria);
    if (primerContacto) params.set("primerContacto", primerContacto);
    if (fechaDesde) params.set("fechaDesde", fechaDesde);
    if (fechaHasta) params.set("fechaHasta", fechaHasta);
    if (tiempoMinDesde) params.set("tiempoMinDesde", tiempoMinDesde);
    if (tiempoMinHasta) params.set("tiempoMinHasta", tiempoMinHasta);
    params.set("pageSize", String(PAGE_SIZE));
    return params.toString();
  }, [
    status,
    tipoServicio,
    canal,
    gerencia,
    tipoRegistro,
    mes,
    q,
    ticketId,
    solicitante,
    encargado,
    motivo,
    categoria,
    primerContacto,
    fechaDesde,
    fechaHasta,
    tiempoMinDesde,
    tiempoMinHasta,
  ]);

  async function fetchTickets(page = 1) {
    setLoading(true);
    setError(null);
    const separator = queryString ? "&" : "";
    const res = await fetch(`/api/tickets?${queryString}${separator}page=${page}`);
    if (!res.ok) {
      setError("No se pudieron cargar los tickets");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setItems(data.items || []);
    setMeta(
      data.meta || {
        page,
        pageSize: PAGE_SIZE,
        totalItems: data.items?.length || 0,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      }
    );
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
    void fetchTickets(1);
  }, []);

  const rangeStart = meta.totalItems === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const rangeEnd = meta.totalItems === 0 ? 0 : rangeStart + items.length - 1;
  const resultsKey = `${queryString}:${meta.page}:${items.length}:${loading ? "loading" : "ready"}`;
  const paginationPages = Array.from({ length: meta.totalPages }, (_, index) => index + 1).filter((page) =>
    Math.abs(page - meta.page) <= 2 || page === 1 || page === meta.totalPages
  );

  return (
    <main className="page">
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
        <AnimatePresence initial={false}>
          {advancedOpen && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, height: 0, y: -8 }}
              animate={reduceMotion ? {} : { opacity: 1, height: "auto", y: 0 }}
              exit={reduceMotion ? {} : { opacity: 0, height: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{ overflow: "hidden" }}
            >
              <div className="filters" style={{ marginTop: 16 }}>
                <label className="field">
                  <span className="label">ID</span>
                  <input className="input" inputMode="numeric" value={ticketId} onChange={(e) => setTicketId(e.target.value)} placeholder="Ej. 1245" />
                </label>
                <label className="field">
                  <span className="label">Solicitante</span>
                  <input className="input" value={solicitante} onChange={(e) => setSolicitante(e.target.value)} placeholder="Nombre o parte del nombre" />
                </label>
                <label className="field">
                  <span className="label">Encargado</span>
                  <input className="input" value={encargado} onChange={(e) => setEncargado(e.target.value)} placeholder="Nombre del encargado" />
                </label>
                <label className="field">
                  <span className="label">Motivo</span>
                  <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del servicio" />
                </label>
                <label className="field">
                  <span className="label">Categoría</span>
                  <input className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Categoría KPI" />
                </label>
                <label className="field">
                  <span className="label">Primer contacto</span>
                  <select className="select" value={primerContacto} onChange={(e) => setPrimerContacto(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </label>
                <label className="field">
                  <span className="label">Fecha desde</span>
                  <input className="input" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
                </label>
                <label className="field">
                  <span className="label">Fecha hasta</span>
                  <input className="input" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
                </label>
                <label className="field">
                  <span className="label">Tiempo mín. desde</span>
                  <input className="input" inputMode="numeric" value={tiempoMinDesde} onChange={(e) => setTiempoMinDesde(e.target.value)} placeholder="0" />
                </label>
                <label className="field">
                  <span className="label">Tiempo mín. hasta</span>
                  <input className="input" inputMode="numeric" value={tiempoMinHasta} onChange={(e) => setTiempoMinHasta(e.target.value)} placeholder="240" />
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="actions-row">
          <button className="button" onClick={() => void fetchTickets(1)} disabled={loading}>
            {loading ? "Cargando..." : "Buscar"}
          </button>
          <button className="nav-link" onClick={exportXlsx} disabled={items.length === 0}>
            Exportar XLSX
          </button>
          <button className="nav-link" onClick={() => setAdvancedOpen((value) => !value)}>
            {advancedOpen ? "Ocultar filtros avanzados" : "Mostrar filtros avanzados"}
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
              setTicketId("");
              setSolicitante("");
              setEncargado("");
              setMotivo("");
              setCategoria("");
              setPrimerContacto("");
              setFechaDesde("");
              setFechaHasta("");
              setTiempoMinDesde("");
              setTiempoMinHasta("");
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
            className="toolbar"
            style={{ justifyContent: "space-between", marginBottom: 16 }}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <p className="muted">
              {loading
                ? "Consultando tickets..."
                : `Mostrando ${rangeStart}-${rangeEnd} de ${meta.totalItems} tickets`}
            </p>
            <p className="muted">Filtrado y paginación resueltos en servidor.</p>
          </motion.div>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={resultsKey}
            initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.995 }}
            animate={reduceMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? {} : { opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {items.length === 0 ? (
              <p className="muted">Sin resultados. Usa los filtros y presiona Buscar.</p>
            ) : (
              <div className="table-wrap">
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
          </motion.div>
        </AnimatePresence>
        <div className="actions-row" style={{ justifyContent: "space-between", marginTop: 16 }}>
          <div className="actions-row">
            <button
              className="nav-link"
              onClick={() => void fetchTickets(meta.page - 1)}
              disabled={!meta.hasPreviousPage || loading}
            >
              Anterior
            </button>
            {paginationPages.map((page) => (
              <button
                key={page}
                className={page === meta.page ? "button" : "nav-link"}
                onClick={() => void fetchTickets(page)}
                disabled={loading}
              >
                {page}
              </button>
            ))}
            <button
              className="nav-link"
              onClick={() => void fetchTickets(meta.page + 1)}
              disabled={!meta.hasNextPage || loading}
            >
              Siguiente
            </button>
          </div>
          <p className="muted">Página {meta.page} de {meta.totalPages}</p>
        </div>
      </section>
    </main>
  );
}
