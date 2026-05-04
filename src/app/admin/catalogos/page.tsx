import { CatalogAdmin } from "@/components/CatalogAdmin";
import { MotivoAdmin } from "@/components/MotivoAdmin";

export default function CatalogosPage() {
  return (
    <main className="page">
      <CatalogAdmin
        catalogo="tiposervicio"
        titulo="Tipo de servicio"
        descripcion="Valores para clasificar el tipo de servicio solicitado."
      />
      <CatalogAdmin
        catalogo="canaloficina"
        titulo="Canal / Oficina"
        descripcion="Canales de entrada o sedes físicas."
      />
      <CatalogAdmin
        catalogo="gerencia"
        titulo="Gerencia"
        descripcion="Áreas responsables para análisis y reporte."
      />
      <MotivoAdmin />
      <CatalogAdmin
        catalogo="categoria"
        titulo="Categorías"
        descripcion="Categorías finales para reportes y KPIs."
      />
    </main>
  );
}
