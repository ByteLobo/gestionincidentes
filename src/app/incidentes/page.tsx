import { IncidentForm } from "@/components/IncidentForm";

export default function IncidentesPage() {
  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Gestión de Incidentes</h1>
        <p className="page-subtitle">
          Campos obligatorios, validación anti-error y cálculo automático de tiempo.
        </p>
      </header>
      <section className="card">
        <IncidentForm defaultTipoRegistro="INCIDENTE" />
      </section>
    </main>
  );
}
