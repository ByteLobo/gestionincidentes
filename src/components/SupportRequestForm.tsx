"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

type FormValues = {
  solicitante: string;
  tipoServicio: string;
  canalOficina: string;
  gerencia: string;
  descripcion: string;
};

type CatalogItem = {
  id: number;
  name: string;
  active: boolean;
};

export function SupportRequestForm() {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { solicitante: "" },
  });

  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [serviceTypes, setServiceTypes] = useState<CatalogItem[]>([]);
  const [channels, setChannels] = useState<CatalogItem[]>([]);
  const [gerencias, setGerencias] = useState<CatalogItem[]>([]);

  const isReady = useMemo(() => !catalogLoading && Boolean(userName), [catalogLoading, userName]);

  async function onSubmit(values: FormValues) {
    setSubmitMessage(null);
    const res = await fetch("/api/soporte/solicitud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSubmitMessage(data?.error || "No se pudo registrar la solicitud.");
      return;
    }

    setSubmitMessage("Solicitud enviada correctamente.");
    setValue("tipoServicio", "");
    setValue("canalOficina", "");
    setValue("gerencia", "");
    setValue("descripcion", "");
  }

  useEffect(() => {
    async function loadCatalogs() {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const [tipoRes, canalRes, gerRes] = await Promise.all([
          fetch("/api/catalogos/tiposervicio"),
          fetch("/api/catalogos/canaloficina"),
          fetch("/api/catalogos/gerencia"),
        ]);

        if (!tipoRes.ok || !canalRes.ok || !gerRes.ok) {
          throw new Error("No se pudieron cargar los catálogos");
        }

        const [tipoData, canalData, gerData] = await Promise.all([
          tipoRes.json(),
          canalRes.json(),
          gerRes.json(),
        ]);

        setServiceTypes(tipoData.items || []);
        setChannels(canalData.items || []);
        setGerencias(gerData.items || []);
      } catch (err) {
        setCatalogError(err instanceof Error ? err.message : "Error al cargar catálogos");
      } finally {
        setCatalogLoading(false);
      }
    }

    void loadCatalogs();
  }, []);

  useEffect(() => {
    async function loadUser() {
      const res = await fetch("/api/auth/me");
      const data = await res.json().catch(() => ({}));
      const name = data?.user?.full_name || data?.user?.username || "";
      setUserName(name);
      if (name) setValue("solicitante", name);
    }
    void loadUser();
  }, [setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="form">
      {catalogError && <p className="error">{catalogError}</p>}

      <section className="form-section">
        <div className="form-section__header">
          <h2 className="form-section__title">Datos de la solicitud</h2>
          <p className="form-section__copy">Identifica quién reporta y a qué frente operativo debe dirigirse.</p>
        </div>

        <div className="split">
          <div className="field">
            <label className="label">Usuario solicitante *</label>
            <input
              className="input input--readonly"
              readOnly
              value={userName}
              {...register("solicitante", { required: "Requerido" })}
            />
            {errors.solicitante && <span className="error">{errors.solicitante.message}</span>}
          </div>

          <div className="field">
            <label className="label">Tipo de servicio *</label>
            <select
              className="select"
              {...register("tipoServicio", { required: "Requerido" })}
              disabled={catalogLoading}
            >
              <option value="">Seleccionar...</option>
              {serviceTypes.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name}
                </option>
              ))}
            </select>
            {errors.tipoServicio && <span className="error">{errors.tipoServicio.message}</span>}
          </div>

          <div className="field">
            <label className="label">Gerencia *</label>
            <select className="select" {...register("gerencia", { required: "Requerido" })} disabled={catalogLoading}>
              <option value="">Seleccionar...</option>
              {gerencias.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
            {errors.gerencia && <span className="error">{errors.gerencia.message}</span>}
          </div>

          <div className="field">
            <label className="label">Canal / Oficina *</label>
            <select
              className="select"
              {...register("canalOficina", { required: "Requerido" })}
              disabled={catalogLoading}
            >
              <option value="">Seleccionar...</option>
              {channels.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name}
                </option>
              ))}
            </select>
            {errors.canalOficina && <span className="error">{errors.canalOficina.message}</span>}
          </div>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section__header">
          <h2 className="form-section__title">Descripción del problema</h2>
          <p className="form-section__copy">Da al equipo de soporte el contexto necesario para tomar la solicitud.</p>
        </div>

        <div className="field">
          <label className="label">Descripción del problema *</label>
          <textarea className="textarea" {...register("descripcion", { required: "Requerido" })} />
          {errors.descripcion && <span className="error">{errors.descripcion.message}</span>}
        </div>
      </section>

      <div className="actions-row">
        <button type="submit" disabled={!isReady || isSubmitting} className="button">
          {isSubmitting ? "Enviando..." : "Enviar solicitud"}
        </button>
      </div>

      {submitMessage && (
        <p className={submitMessage.includes("correctamente") ? "success" : "error"}>{submitMessage}</p>
      )}
    </form>
  );
}
