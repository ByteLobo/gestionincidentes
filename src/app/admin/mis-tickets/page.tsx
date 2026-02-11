"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Ticket = {
  id: number;
  solicitante: string;
  tipo_servicio: string;
  canal_oficina: string;
  gerencia: string;
  descripcion: string;
  encargado: string;
  fecha_reporte: string;
  hora_reporte: string;
  fecha_respuesta: string;
  hora_respuesta: string;
  accion_tomada: string;
  primer_contacto: boolean;
  tiempo_minutos: number;
  categoria: string | null;
  porcentaje: number | null;
  regla_porcentaje: string | null;
  estado: string;
  clasificacion?: string | null;
};

type EditState = {
  descripcion: string;
  clasificacion: string;
  accion_tomada: string;
  fecha_respuesta: string;
  hora_respuesta: string;
  primer_contacto: boolean;
  estado: string;
};

export default function MisTicketsPage() {
  const [items, setItems] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const loadedRef = useRef(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("tipoRegistro", "SOPORTE");
    return params.toString();
  }, []);

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
    const filtered = (data.items || []).filter((t: Ticket) => t.encargado !== "SIN_ASIGNAR");
    setItems(filtered);
    setLoading(false);
  }

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void fetchTickets();
  }, []);

  function openEdit(ticket: Ticket) {
    setSelected(ticket);
    setEdit({
      descripcion: ticket.descripcion,
      clasificacion: ticket.clasificacion ?? "",
      accion_tomada: ticket.accion_tomada ?? "",
      fecha_respuesta: ticket.fecha_respuesta?.slice(0, 10) || "",
      hora_respuesta: ticket.hora_respuesta?.slice(0, 5) || "",
      primer_contacto: Boolean(ticket.primer_contacto),
      estado: ticket.estado,
    });
  }

  async function save() {
    if (!selected || !edit) return;
    const res = await fetch(`/api/tickets/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        descripcion: edit.descripcion,
        classification: edit.clasificacion,
        accionTomada: edit.accion_tomada,
        fechaRespuesta: edit.fecha_respuesta,
        horaRespuesta: edit.hora_respuesta,
        primerContacto: edit.primer_contacto,
        status: edit.estado,
      }),
    });
    if (!res.ok) {
      setError("No se pudieron guardar los cambios");
      return;
    }
    setSelected(null);
    setEdit(null);
    void fetchTickets();
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Mis Tickets</h1>
        <p className="page-subtitle">Gestiona los tickets que tomaste y completa el detalle de atención.</p>
      </header>

      <section className="card">
        <div style={{ display: "flex", gap: 12 }}>
          <button className="button" onClick={fetchTickets} disabled={loading}>
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </div>
      </section>

      <section className="card">
        {error && <p className="error">{error}</p>}
        {items.length === 0 ? (
          <p className="muted">Sin tickets asignados.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Solicitante</th>
                  <th>Tipo servicio</th>
                  <th>Canal</th>
                  <th>Gerencia</th>
                  <th>Estado</th>
                  <th>Clasificación</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.solicitante}</td>
                    <td>{item.tipo_servicio}</td>
                    <td>{item.canal_oficina}</td>
                    <td>{item.gerencia}</td>
                    <td>{item.estado}</td>
                    <td>{item.clasificacion || "--"}</td>
                    <td>
                      <button className="nav-link" onClick={() => openEdit(item)}>
                        Detallar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && edit && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2 className="page-title" style={{ fontSize: "1.4rem" }}>
              Ticket #{selected.id}
            </h2>
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label className="field">
                <span className="label">Descripción</span>
                <textarea
                  className="textarea"
                  value={edit.descripcion}
                  onChange={(e) => setEdit({ ...edit, descripcion: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="label">Clasificación</span>
                <input
                  className="input"
                  value={edit.clasificacion}
                  onChange={(e) => setEdit({ ...edit, clasificacion: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="label">Acción tomada</span>
                <textarea
                  className="textarea"
                  value={edit.accion_tomada}
                  onChange={(e) => setEdit({ ...edit, accion_tomada: e.target.value })}
                />
              </label>
              <div className="split">
                <label className="field">
                  <span className="label">Fecha de respuesta</span>
                  <input
                    className="input"
                    type="date"
                    value={edit.fecha_respuesta}
                    onChange={(e) => setEdit({ ...edit, fecha_respuesta: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="label">Hora de respuesta</span>
                  <input
                    className="input"
                    type="time"
                    value={edit.hora_respuesta}
                    onChange={(e) => setEdit({ ...edit, hora_respuesta: e.target.value })}
                  />
                </label>
              </div>
              <label className="field">
                <span className="label">Primer contacto</span>
                <select
                  className="select"
                  value={edit.primer_contacto ? "SI" : "NO"}
                  onChange={(e) => setEdit({ ...edit, primer_contacto: e.target.value === "SI" })}
                >
                  <option value="NO">No</option>
                  <option value="SI">Sí</option>
                </select>
              </label>
              <label className="field">
                <span className="label">Estado</span>
                <select
                  className="select"
                  value={edit.estado}
                  onChange={(e) => setEdit({ ...edit, estado: e.target.value })}
                >
                  <option value="REGISTRADO">Registrado</option>
                  <option value="EN_ATENCION">En atención</option>
                  <option value="RESPONDIDO">Respondido</option>
                  <option value="RESUELTO">Resuelto</option>
                </select>
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                <button className="button" type="submit">
                  Guardar cambios
                </button>
                <button className="nav-link" type="button" onClick={() => { setSelected(null); setEdit(null); }}>
                  Cerrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
