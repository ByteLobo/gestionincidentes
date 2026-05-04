"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  username: z.string().min(1, "Usuario requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="page"><section className="card">Cargando...</section></div>}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });
  const [openReset, setOpenReset] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  async function onSubmit(values: FormData) {
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Credenciales inválidas");
      return;
    }

    const from = params.get("from") || "/panel";
    router.push(from);
  }

  return (
    <div className="page auth-shell">
      <section className="hero-panel auth-panel">
        <div className="hero-panel__content">
          <div
            style={{
              minHeight: 320,
              display: "grid",
              placeItems: "center",
              borderRadius: 24,
              background: "rgba(255, 255, 255, 0.34)",
              padding: 24,
            }}
          >
            <img
              src="/images/logos/logo-msi.png"
              alt="MSI"
              style={{ width: "100%", maxWidth: 380, height: "auto", objectFit: "contain" }}
            />
          </div>
        </div>
      </section>

      <section className="card auth-card">
        <form onSubmit={handleSubmit(onSubmit)} className="form">
          <div className="page-header">
            <span className="page-kicker">Sesión</span>
            <h1 className="page-title">Iniciar sesión</h1>
            <p className="page-subtitle">Ingresa con tu usuario operativo y contraseña.</p>
          </div>
          <label className="field">
            <span className="label">Usuario</span>
            <input className="input" {...register("username")} />
            {errors.username && <span className="error">{errors.username.message}</span>}
          </label>
          <label className="field">
            <span className="label">Contraseña</span>
            <input
              className="input"
              type="password"
              {...register("password")}
            />
            {errors.password && <span className="error">{errors.password.message}</span>}
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading} className="button">
            {loading ? "Validando..." : "Entrar"}
          </button>
          <button type="button" className="nav-link" onClick={() => setOpenReset(true)}>
            ¿Olvidaste tu contraseña?
          </button>
        </form>
      </section>

      {openReset && (
        <div className="modal-backdrop">
          <div className="modal modal--nested">
            <div className="page-header">
              <span className="page-kicker">Recuperación</span>
              <h2 className="section-title">Restablecer contraseña</h2>
              <p className="page-subtitle">Solicita un enlace seguro para recuperar tu acceso.</p>
            </div>
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                setResetMessage(null);
                const res = await fetch("/api/auth/forgot", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ identifier: resetIdentifier }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setResetMessage(data?.error || "No se pudo restablecer");
                  return;
                }
                setResetMessage(
                  data?.message || "Si la cuenta existe, se enviaron instrucciones para restablecer la contraseña."
                );
                setResetIdentifier("");
              }}
            >
              <label className="field">
                <span className="label">Usuario o correo</span>
                <input className="input" value={resetIdentifier} onChange={(e) => setResetIdentifier(e.target.value)} required />
              </label>
              {resetMessage && <p className={resetMessage.includes("No se pudo") ? "error" : "success"}>{resetMessage}</p>}
              <div className="actions-row">
                <button className="button" type="submit">Enviar enlace</button>
                <button className="nav-link" type="button" onClick={() => setOpenReset(false)}>Cerrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
