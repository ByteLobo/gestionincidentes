"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

type User = { id: number; username: string; role: string; roles?: string[] };

type Tab = { label: string; href: string; roles: string[] };

export default function PanelPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error("No se pudo consultar la sesión");
        if (!data?.user) {
          router.replace("/login?from=/panel");
          return;
        }
        setUser(data.user);
      } catch {
        setLoadError(true);
      }
    }
    void load();
  }, [router]);

  const tabs: Tab[] = useMemo(
    () => [
      { label: "Formulario de gestión", href: "/incidentes", roles: ["SOLICITANTE", "SOPORTE", "SUPERVISOR", "ADMIN"] },
      { label: "Solicitud de soporte", href: "/soporte", roles: ["SOLICITANTE", "SOPORTE", "SUPERVISOR", "ADMIN"] },
      { label: "Seguimiento de mis tickets", href: "/seguimiento", roles: ["SOLICITANTE", "SOPORTE", "SUPERVISOR", "ADMIN"] },
      { label: "Documentación API", href: "/docs", roles: ["SOPORTE", "SUPERVISOR", "ADMIN"] },
      { label: "Pendientes de asignación", href: "/admin/en-proceso", roles: ["SOPORTE", "SUPERVISOR", "ADMIN"] },
      { label: "Mis tickets", href: "/admin/mis-tickets", roles: ["SOPORTE", "SUPERVISOR", "ADMIN"] },
      {
        label: "Mis tickets modificaciones",
        href: "/admin/mis-tickets-modificaciones",
        roles: ["SOPORTE", "SUPERVISOR", "ADMIN"],
      },
      { label: "Tickets", href: "/admin/resueltos", roles: ["SOPORTE", "SUPERVISOR", "ADMIN"] },
      { label: "Reportes", href: "/admin/reportes", roles: ["SOPORTE", "SUPERVISOR", "ADMIN"] },
      { label: "Gráficos", href: "/admin/graficos", roles: ["SOPORTE", "SUPERVISOR", "ADMIN"] },
      { label: "Dashboard", href: "/admin/dashboard", roles: ["SOPORTE", "SUPERVISOR", "ADMIN"] },
      { label: "Importar CSV/Excel", href: "/admin/importar", roles: ["ADMIN"] },
      { label: "Catálogos", href: "/admin/catalogos", roles: ["ADMIN"] },
      { label: "Usuarios", href: "/admin/usuarios", roles: ["ADMIN"] },
    ],
    []
  );

  const allowedTabs = user
    ? tabs.filter((t) => t.roles.some((r) => (user.roles && user.roles.length ? user.roles : [user.role]).includes(r)))
    : [];

  return (
    <main className="page">
      <motion.section
        className="card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {loadError ? (
          <p className="error">No se pudo cargar la sesión. Recarga la página o vuelve a iniciar sesión.</p>
        ) : !user ? (
          <p className="muted">Cargando usuario...</p>
        ) : (
          <div className="nav-links">
            {allowedTabs.map((tab) => (
              <a key={tab.href} className="nav-link" href={tab.href}>
                <ArrowRight style={{ width: 16, height: 16 }} />
                {tab.label}
              </a>
            ))}
          </div>
        )}
      </motion.section>
    </main>
  );
}
