export default function Home() {
  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Gestión de Incidentes</h1>
        <p className="page-subtitle">
          Plataforma con autenticación JWT, formularios a prueba de errores y KPIs configurables.
        </p>
      </header>
      <section className="card">
        <h2 style={{ fontSize: "1.25rem", marginBottom: 12 }}>Acceso</h2>
        <div className="nav-links">
          <a className="nav-link" href="/login">
            Iniciar sesión
          </a>
        </div>
      </section>
    </main>
  );
}
