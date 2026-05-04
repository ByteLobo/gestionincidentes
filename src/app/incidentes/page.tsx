import { IncidentForm } from "@/components/IncidentForm";

export default function IncidentesPage() {
  return (
    <main className="page">
      <div className="page-grid page-grid--aside">
        <section className="card">
          <IncidentForm defaultTipoRegistro="INCIDENTE" />
        </section>
      </div>
    </main>
  );
}
