"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  regla_porcentaje: string | null;
  estado: string;
  created_at: string;
  clasificacion?: string | null;
};

type CatalogItem = { id: number; name: string; active: boolean };
type SupportUser = { id: number; name: string };

export default function EnProcesoPage() {
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
  const [cola, setCola] = useState<"" | "sin_asignar" | "asignados">("sin_asignar");

  const [serviceTypes, setServiceTypes] = useState<CatalogItem[]>([]);
  const [channels, setChannels] = useState<CatalogItem[]>([]);
  const [gerencias, setGerencias] = useState<CatalogItem[]>([]);
  const [supportUsers, setSupportUsers] = useState<SupportUser[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    async function loadCatalogs() {
      const [tipoRes, canalRes, gerRes] = await Promise.all([
        fetch("/api/catalogos/tiposervicio"),
        fetch("/api/catalogos/canaloficina"),
        fetch("/api/catalogos/gerencia"),
      ]);
      const supportRes = await fetch("/api/admin/support-users");
      const [tipoData, canalData, gerData] = await Promise.all([
        tipoRes.json(),
        canalRes.json(),
        gerRes.json(),
      ]);
      setServiceTypes(tipoData.items || []);
      setChannels(canalData.items || []);
      setGerencias(gerData.items || []);
      if (supportRes.ok) {
        const supportData = await supportRes.json();
        setSupportUsers(supportData.items || []);
      }
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
    if (cola) params.set("cola", cola);
    return params.toString();
  }, [status, tipoServicio, canal, gerencia, tipoRegistro, mes, q, cola]);

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
    const filtered = (data.items || []).filter((t: Ticket) => t.estado !== "RESUELTO");
    setItems(filtered);
    setLoading(false);
  }

  async function updateStatus(id: number, next: string) {
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      setError("No se pudo actualizar el estado");
      return;
    }
    void fetchTickets();
  }

  async function takeTicket(id: number) {
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "take" }),
    });
    if (!res.ok) {
      setError("No se pudo tomar el ticket");
      return;
    }
    void fetchTickets();
  }

  async function saveClassification(id: number, classification: string) {
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classification }),
    });
    if (!res.ok) {
      setError("No se pudo guardar la clasificación");
      return;
    }
    void fetchTickets();
  }

  async function reassign(id: number, assignTo: string) {
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reassign", assignTo }),
    });
    if (!res.ok) {
      setError("No se pudo reasignar el ticket");
      return;
    }
    void fetchTickets();
  }

  useEffect(() => {
    void fetchTickets();
  }, []);

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Tickets en Trabajo</h1>
        <p className="page-subtitle">Gestión operativa de tickets para cerrar o avanzar estados.</p>
      </header>

      <section className="card">
        <div className="filters">
          <label className="field">
            <span className="label">Estado</span>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos (excepto resueltos)</option>
              <option value="REGISTRADO">Registrado</option>
              <option value="EN_ATENCION">En atención</option>
              <option value="RESPONDIDO">Respondido</option>
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
          <label className="field">
            <span className="label">Cola</span>
            <select className="select" value={cola} onChange={(e) => setCola(e.target.value as typeof cola)}>
              <option value="sin_asignar">Sin asignar</option>
              <option value="asignados">Asignados</option>
              <option value="">Todos</option>
            </select>
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button className="button" onClick={fetchTickets} disabled={loading}>
            {loading ? "Cargando..." : "Buscar"}
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
                  <th>Estado</th>
                  <th>Tipo</th>
                  <th>Solicitante</th>
                  <th>Tipo servicio</th>
                  <th>Canal</th>
                  <th>Gerencia</th>
                  <th>Motivo</th>
                  <th>Descripción</th>
                  <th>Clasificación</th>
                  <th>Encargado</th>
                  <th>Tiempo (min)</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.estado}</td>
                    <td>{item.tipo_registro}</td>
                    <td>{item.solicitante}</td>
                    <td>{item.tipo_servicio}</td>
                    <td>{item.canal_oficina}</td>
                    <td>{item.gerencia}</td>
                    <td>{item.motivo_servicio}</td>
                    <td style={{ maxWidth: 260 }}>{item.descripcion}</td>
                    <td>
                      <input
                        className="input"
                        defaultValue={item.clasificacion ?? ""}
                        placeholder="Clasificar..."
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value && value !== item.clasificacion) {
                            void saveClassification(item.id, value);
                          }
                        }}
                      />
                    </td>
                    <td>{item.encargado}</td>
                    <td>{item.tiempo_minutos}</td>
                    <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {item.encargado === "SIN_ASIGNAR" && (
                        <button className="button" onClick={() => takeTicket(item.id)}>
                          Tomar
                        </button>
                      )}
                      <button className="nav-link" onClick={() => updateStatus(item.id, "EN_ATENCION")}>
                        En atención
                      </button>
                      <button className="nav-link" onClick={() => updateStatus(item.id, "RESPONDIDO")}>
                        Respondido
                      </button>
                      <button className="button" onClick={() => updateStatus(item.id, "RESUELTO")}>
                        Cerrar
                      </button>
                      <select
                        className="select"
                        value=""
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value) void reassign(item.id, value);
                        }}
                      >
                        <option value="">Reasignar...</option>
                        {supportUsers.map((user) => (
                          <option key={user.id} value={user.name}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </td>
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
