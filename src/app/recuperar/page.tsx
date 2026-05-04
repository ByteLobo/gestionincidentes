"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function RecuperarPage() {
  return (
    <Suspense fallback={<div className="page"><section className="card">Cargando...</section></div>}>
      <RecuperarPageContent />
    </Suspense>
  );
}

function RecuperarPageContent() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => Boolean(token) && password.length >= 8 && password === confirmPassword,
    [confirmPassword, password, token]
  );

  return (
    <main className="page">
      <div className="page auth-shell">
        <section className="hero-panel auth-panel">
          <div className="hero-panel__content">
            <div className="page-header">
              <span className="page-kicker">Recuperación</span>
              <h1 className="page-title">Restablece tu acceso de forma segura</h1>
              <p className="page-subtitle">
                Define una nueva contraseña para reactivar tu sesión y volver a la consola operativa.
              </p>
            </div>
            <div className="metric-strip">
              <div className="metric">
                <span>Requisito</span>
                <strong>8 caracteres mínimo</strong>
              </div>
              <div className="metric">
                <span>Control</span>
                <strong>Coincidencia obligatoria</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="card auth-card">
          <div className="page-header">
            <span className="page-kicker">Nueva clave</span>
            <h1 className="page-title">Restablecer contraseña</h1>
            <p className="page-subtitle">Ingresa una nueva contraseña para completar la recuperación.</p>
          </div>

          {!token && <p className="error">El enlace de recuperación no es válido.</p>}

          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!canSubmit) return;

              setLoading(true);
              setError(null);
              setMessage(null);

              const res = await fetch("/api/auth/reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
              });

              const data = await res.json().catch(() => ({}));
              setLoading(false);

              if (!res.ok) {
                setError(data?.error || "No se pudo restablecer la contraseña.");
                return;
              }

              setPassword("");
              setConfirmPassword("");
              setMessage("Contraseña actualizada. Ya puedes iniciar sesión.");
            }}
          >
            <label className="field">
              <span className="label">Nueva contraseña</span>
              <input
                className="input"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span className="label">Confirmar contraseña</span>
              <input
                className="input"
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>

            {confirmPassword && password !== confirmPassword && (
              <p className="error">Las contraseñas no coinciden.</p>
            )}
            {error && <p className="error">{error}</p>}
            {message && <p className="success">{message}</p>}

            <button type="submit" disabled={!canSubmit || loading} className="button">
              {loading ? "Guardando..." : "Guardar nueva contraseña"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
