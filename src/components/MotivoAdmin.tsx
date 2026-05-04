"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ServiceType = {
  id: number;
  name: string;
  active: boolean;
};

type Motivo = {
  id: number;
  name: string;
  active: boolean;
  service_type_id: number;
};

export function MotivoAdmin() {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [items, setItems] = useState<Motivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState<number | "">("");
  const [showInactive, setShowInactive] = useState(false);
  const loadedRef = useRef(false);

  const endpoint = useMemo(() => {
    const base = "/api/catalogos/motivo";
    return showInactive ? `${base}?all=1` : base;
  }, [showInactive]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [motivosRes, tiposRes] = await Promise.all([
        fetch(endpoint),
        fetch("/api/catalogos/tiposervicio"),
      ]);
      if (!motivosRes.ok || !tiposRes.ok) {
        throw new Error("No se pudieron cargar los catálogos");
      }
      const [motivosData, tiposData] = await Promise.all([motivosRes.json(), tiposRes.json()]);
      setItems(motivosData.items || []);
      setServiceTypes(tiposData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar catálogos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loadedRef.current && !showInactive) return;
    loadedRef.current = true;
    async function run() {
      await load();
    }
    void run();
  }, [endpoint, showInactive]);

  async function handleAdd() {
    if (!newName.trim() || !serviceTypeId) return;
    const res = await fetch("/api/catalogos/motivo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), serviceTypeId: Number(serviceTypeId) }),
    });
    if (!res.ok) {
      setError("No se pudo crear el registro");
      return;
    }
    setNewName("");
    void load();
  }

  async function toggleActive(item: Motivo) {
    const res = await fetch("/api/catalogos/motivo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, active: !item.active }),
    });
    if (!res.ok) {
      setError("No se pudo actualizar el registro");
      return;
    }
    void load();
  }

  async function renameItem(item: Motivo) {
    const name = prompt("Nuevo nombre:", item.name);
    if (!name || !name.trim()) return;
    const res = await fetch("/api/catalogos/motivo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, name: name.trim() }),
    });
    if (!res.ok) {
      setError("No se pudo actualizar el registro");
      return;
    }
    void load();
  }

  async function updateServiceType(item: Motivo) {
    const next = prompt("ID del tipo de servicio:", String(item.service_type_id));
    const nextId = Number(next);
    if (!next || !nextId) return;
    const res = await fetch("/api/catalogos/motivo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, serviceTypeId: nextId }),
    });
    if (!res.ok) {
      setError("No se pudo actualizar el registro");
      return;
    }
    void load();
  }

  const serviceTypeName = (id: number) => serviceTypes.find((t) => t.id === id)?.name || "--";

  return (
    <section className="card stack">
      <div className="page-header">
        <span className="page-kicker">Catálogo</span>
        <h2 className="section-title">Motivo de servicio</h2>
        <p className="page-subtitle">Cada motivo debe estar ligado a un tipo de servicio.</p>
      </div>

      <div className="split">
        <div className="field">
          <label className="label">Tipo de servicio *</label>
          <select
            className="select"
            value={serviceTypeId}
            onChange={(e) => setServiceTypeId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Seleccionar...</option>
            {serviceTypes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label">Nuevo motivo</label>
          <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </div>
        <div className="field" style={{ alignSelf: "end" }}>
          <button type="button" className="button" onClick={handleAdd}>
            Agregar
          </button>
        </div>
        <div className="field" style={{ alignSelf: "end" }}>
          <button type="button" className="nav-link" onClick={load}>
            Actualizar
          </button>
        </div>
      </div>

      <label className="field" style={{ maxWidth: 220 }}>
        <span className="label">Mostrar inactivos</span>
        <select
          className="select"
          value={showInactive ? "1" : "0"}
          onChange={(e) => setShowInactive(e.target.value === "1")}
        >
          <option value="0">Solo activos</option>
          <option value="1">Todos</option>
        </select>
      </label>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted">Cargando...</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.length === 0 ? (
            <p className="muted">Sin registros.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="list-card">
                <div>
                  <strong>{item.name}</strong>
                  <span className="muted" style={{ marginLeft: 8 }}>
                    ({serviceTypeName(item.service_type_id)})
                  </span>
                  {!item.active && <span className="muted" style={{ marginLeft: 8 }}>(inactivo)</span>}
                </div>
                <div className="actions-row">
                  <button type="button" className="nav-link" onClick={() => renameItem(item)}>
                    Renombrar
                  </button>
                  <button type="button" className="nav-link" onClick={() => updateServiceType(item)}>
                    Cambiar tipo
                  </button>
                  <button type="button" className="nav-link" onClick={() => toggleActive(item)}>
                    {item.active ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
