export default function NoAutorizadoPage() {
  return (
    <main className="page">
      <section className="hero-panel auth-panel">
        <div className="hero-panel__content">
          <div className="page-header">
            <span className="page-kicker">Permisos</span>
            <h1 className="page-title">Acceso no autorizado</h1>
            <p className="page-subtitle">
              Tu sesión está activa, pero el rol actual no tiene visibilidad sobre este módulo.
            </p>
          </div>
          <div className="actions-row">
            <a className="nav-link" href="/panel">
              Volver al panel
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
