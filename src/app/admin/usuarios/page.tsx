"use client";

import { useEffect, useState } from "react";

type User = {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  roles?: string[];
  active: boolean;
  created_at: string;
};

export default function UsuariosPage() {
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    username: "",
    full_name: "",
    email: "",
    role: "SOLICITANTE",
    roles: ["SOLICITANTE"],
    password: "",
  });
  const [editing, setEditing] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    username: "",
    full_name: "",
    email: "",
    role: "SOLICITANTE",
    roles: ["SOLICITANTE"],
    password: "",
  });

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/users");
    if (!res.ok) {
      setError("No se pudieron cargar los usuarios");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }

  useEffect(() => {
    async function loadUsers() {
      await load();
    }
    void loadUsers();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "No se pudo crear el usuario");
      return;
    }
    setForm({ username: "", full_name: "", email: "", role: "SOLICITANTE", roles: ["SOLICITANTE"], password: "" });
    void load();
  }

  async function toggleActive(user: User) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, active: !user.active }),
    });
    if (!res.ok) {
      setError("No se pudo actualizar el usuario");
      return;
    }
    void load();
  }

  function openEdit(user: User) {
    setEditing(user);
    setEditForm({
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      roles: user.roles && user.roles.length ? user.roles : [user.role],
      password: "",
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        username: editForm.username,
        full_name: editForm.full_name,
        email: editForm.email,
        role: editForm.role,
        roles: editForm.roles,
        password: editForm.password || undefined,
      }),
    });
    if (!res.ok) {
      setError("No se pudo actualizar el usuario");
      return;
    }
    setEditing(null);
    setEditForm({ username: "", full_name: "", email: "", role: "SOLICITANTE", roles: ["SOLICITANTE"], password: "" });
    void load();
  }

  return (
    <main className="page">
      <section className="hero-panel">
        <div className="hero-panel__content">
          <div className="page-header">
            <span className="page-kicker">Accesos</span>
            <h1 className="page-title">Usuarios y roles</h1>
            <p className="page-subtitle">
              Alta, edición y activación de usuarios con múltiples roles para los distintos flujos del sistema.
            </p>
          </div>
          <div className="metric-strip">
            <div className="metric">
              <span>Usuarios</span>
              <strong>{items.length}</strong>
            </div>
            <div className="metric">
              <span>Control</span>
              <strong>Roles múltiples</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <form className="form" onSubmit={createUser}>
          <div className="form-section">
            <div className="form-section__header">
              <h2 className="form-section__title">Nuevo usuario</h2>
              <p className="form-section__copy">Define identidad, rol base y accesos complementarios.</p>
            </div>
            <div className="split">
              <label className="field">
                <span className="label">Usuario</span>
                <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              </label>
              <label className="field">
                <span className="label">Nombre completo</span>
                <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              </label>
              <label className="field">
                <span className="label">Email</span>
                <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </label>
              <label className="field">
                <span className="label">Rol</span>
                <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="SOLICITANTE">Solicitante</option>
                  <option value="SOPORTE">Soporte</option>
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>
              <label className="field">
                <span className="label">Roles (múltiples)</span>
                <div className="roles-grid">
                  {["SOLICITANTE", "SOPORTE", "SUPERVISOR", "ADMIN"].map((role) => (
                    <label key={role} className="role-chip">
                      <input
                        type="checkbox"
                        checked={form.roles.includes(role)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...form.roles, role]
                            : form.roles.filter((r) => r !== role);
                          const finalRoles = next.length ? next : ["SOLICITANTE"];
                          const baseRole = finalRoles.includes(form.role) ? form.role : finalRoles[0];
                          setForm({ ...form, roles: finalRoles, role: baseRole });
                        }}
                      />
                      <span>{role}</span>
                    </label>
                  ))}
                </div>
              </label>
              <label className="field">
                <span className="label">Contraseña</span>
                <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </label>
            </div>
          </div>
          <button className="button" type="submit">Crear usuario</button>
          {error && <p className="error">{error}</p>}
        </form>
      </section>

      <section className="card">
        {loading ? (
          <p className="muted">Cargando...</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Usuario</th>
                  <th>Nombre completo</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Roles</th>
                  <th>Activo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.username}</td>
                    <td>{user.full_name}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>{(user.roles && user.roles.length ? user.roles : [user.role]).join(", ")}</td>
                    <td>{user.active ? "Sí" : "No"}</td>
                    <td>
                      <div className="actions-row">
                        <button className="nav-link" onClick={() => openEdit(user)}>
                          Editar
                        </button>
                        <button className="nav-link" onClick={() => toggleActive(user)}>
                          {user.active ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <div className="modal-backdrop">
          <div className="modal modal--nested">
            <div className="page-header">
              <span className="page-kicker">Edición</span>
              <h2 className="section-title">Editar usuario</h2>
            </div>
            <form className="form" onSubmit={saveEdit}>
              <label className="field">
                <span className="label">Usuario</span>
                <input
                  className="input"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span className="label">Nombre completo</span>
                <input
                  className="input"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span className="label">Email</span>
                <input
                  className="input"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span className="label">Rol</span>
                <select
                  className="select"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="SOLICITANTE">Solicitante</option>
                  <option value="SOPORTE">Soporte</option>
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>
              <label className="field">
                <span className="label">Roles (múltiples)</span>
                <div className="roles-grid">
                  {["SOLICITANTE", "SOPORTE", "SUPERVISOR", "ADMIN"].map((role) => (
                    <label key={role} className="role-chip">
                      <input
                        type="checkbox"
                        checked={editForm.roles.includes(role)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...editForm.roles, role]
                            : editForm.roles.filter((r) => r !== role);
                          const finalRoles = next.length ? next : ["SOLICITANTE"];
                          const baseRole = finalRoles.includes(editForm.role) ? editForm.role : finalRoles[0];
                          setEditForm({ ...editForm, roles: finalRoles, role: baseRole });
                        }}
                      />
                      <span>{role}</span>
                    </label>
                  ))}
                </div>
              </label>
              <label className="field">
                <span className="label">Nueva contraseña (opcional)</span>
                <input
                  className="input"
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                />
              </label>
              <div className="actions-row">
                <button className="button" type="submit">
                  Guardar
                </button>
                <button className="nav-link" type="button" onClick={() => setEditing(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
