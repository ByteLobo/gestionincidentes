import { ChartNoAxesColumn } from "lucide-react";

export default function Home() {
  return (
    <main className="page">
      <section className="hero-panel auth-panel" style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="hero-panel__content">
          <div style={{ display: "grid", justifyItems: "center", gap: 20, textAlign: "center" }}>
            <div
              style={{
                width: 104,
                height: 104,
                display: "grid",
                placeItems: "center",
                borderRadius: 28,
                background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                color: "hsl(var(--primary-foreground))",
                boxShadow: "0 22px 44px rgba(14, 93, 114, 0.22)",
              }}
            >
              <ChartNoAxesColumn style={{ width: 52, height: 52 }} />
            </div>
            <div className="page-header" style={{ justifyItems: "center" }}>
              <h1 className="page-title">Bienvenido al sistema de atencion de tickets MSI</h1>
            </div>
          </div>
          <div className="actions-row" style={{ justifyContent: "center" }}>
            <a className="button" href="/login">
              Iniciar sesión
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
