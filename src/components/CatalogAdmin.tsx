"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CatalogItem = {
  id: number;
  name: string;
  active: boolean;
};

type Props = {
  catalogo: string;
  titulo: string;
  descripcion?: string;
};

export function CatalogAdmin({ catalogo, titulo, descripcion }: Props) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const loadedRef = useRef(false);

  const endpoint = useMemo(() => {
    const base = `/api/catalogos/${catalogo}`;
    return showInactive ? `${base}?all=1` : base;
  }, [catalogo, showInactive]);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch(endpoint);
    if (!res.ok) {
      setError("No se pudo cargar el catálogo");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
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
    if (!newName.trim()) return;
    const res = await fetch(`/api/catalogos/${catalogo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (!res.ok) {
      setError("No se pudo crear el registro");
      return;
    }
    setNewName("");
    void load();
  }

  async function toggleActive(item: CatalogItem) {
    const res = await fetch(`/api/catalogos/${catalogo}`, {
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

  async function renameItem(item: CatalogItem) {
    const name = prompt("Nuevo nombre:", item.name);
    if (!name || !name.trim()) return;
    const res = await fetch(`/api/catalogos/${catalogo}`, {
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

  return (
    <section className="card stack">
      <div className="page-header">
        <span className="page-kicker">Catálogo</span>
        <h2 className="section-title">{titulo}</h2>
        {descripcion && <p className="page-subtitle">{descripcion}</p>}
      </div>

      <div className="split">
        <div className="field">
          <label className="label">Nuevo valor</label>
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
                  {!item.active && <span className="muted" style={{ marginLeft: 8 }}>(inactivo)</span>}
                </div>
                <div className="actions-row">
                  <button type="button" className="nav-link" onClick={() => renameItem(item)}>
                    Renombrar
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
