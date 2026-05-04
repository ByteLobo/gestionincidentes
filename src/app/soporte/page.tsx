import { SupportRequestForm } from "@/components/SupportRequestForm";

export default function SoportePage() {
  return (
    <main className="page">
      <div className="page-grid page-grid--aside">
        <section className="card">
          <SupportRequestForm />
        </section>
      </div>
    </main>
  );
}
