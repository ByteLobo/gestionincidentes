import { SupportRequestForm } from "@/components/SupportRequestForm";

export default function SoportePage() {
  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Solicitud de Soporte</h1>
        <p className="page-subtitle">Registra una solicitud para que el equipo de IT la tome en cola.</p>
      </header>
      <section className="card">
        <SupportRequestForm />
      </section>
    </main>
  );
}
