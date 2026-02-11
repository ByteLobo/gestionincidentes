"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

type FormValues = {
  tipoRegistro: "INCIDENTE" | "SOPORTE";
  solicitante: string;
  tipoServicio: string;
  canalOficina: string;
  gerencia: string;
  motivoServicio: string;
  descripcion: string;
  encargado: string;
  fechaReporte: string;
  horaReporte: string;
  fechaRespuesta: string;
  horaRespuesta: string;
  accionTomada: string;
  primerContacto: "SI" | "NO";
};

type Props = {
  defaultTipoRegistro?: "INCIDENTE" | "SOPORTE";
};

type CatalogItem = {
  id: number;
  name: string;
  active: boolean;
};
type MotivoItem = CatalogItem & { service_type_id: number };

function toDateTime(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function formatDurationMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function IncidentForm({ defaultTipoRegistro = "INCIDENTE" }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      primerContacto: "NO",
      tipoRegistro: defaultTipoRegistro,
    },
  });

  const fechaReporte = watch("fechaReporte");
  const horaReporte = watch("horaReporte");
  const fechaRespuesta = watch("fechaRespuesta");
  const horaRespuesta = watch("horaRespuesta");
  const selectedTipoServicio = watch("tipoServicio");
  const selectedMotivo = watch("motivoServicio");

  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [serviceTypes, setServiceTypes] = useState<CatalogItem[]>([]);
  const [channels, setChannels] = useState<CatalogItem[]>([]);
  const [gerencias, setGerencias] = useState<CatalogItem[]>([]);
  const [motivos, setMotivos] = useState<MotivoItem[]>([]);

  const duration = useMemo(() => {
    const start = toDateTime(fechaReporte, horaReporte);
    const end = toDateTime(fechaRespuesta, horaRespuesta);
    if (!start || !end) return null;
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return "ERROR";
    const minutes = Math.floor(diffMs / 60000);
    return formatDurationMinutes(minutes);
  }, [fechaReporte, horaReporte, fechaRespuesta, horaRespuesta]);

  const durationMinutes = useMemo(() => {
    const start = toDateTime(fechaReporte, horaReporte);
    const end = toDateTime(fechaRespuesta, horaRespuesta);
    if (!start || !end) return null;
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return null;
    return Math.floor(diffMs / 60000);
  }, [fechaReporte, horaReporte, fechaRespuesta, horaRespuesta]);

  const categoriaTiempo = useMemo(() => {
    if (durationMinutes === null) return "--";
    if (durationMinutes < 60) return "Menos de 1 hora";
    if (durationMinutes < 120) return "1 - 2 horas";
    if (durationMinutes < 240) return "2 - 4 horas";
    return "Más de 4 horas";
  }, [durationMinutes]);

  const porcentajeKpi = useMemo(() => {
    if (durationMinutes === null) return "--";
    if (durationMinutes < 60) return "100%";
    if (durationMinutes < 120) return "75%";
    if (durationMinutes < 240) return "50%";
    return "25%";
  }, [durationMinutes]);

  const filteredMotivos = useMemo(() => {
    const selected = serviceTypes.find((s) => s.name === selectedTipoServicio);
    if (!selected) return [];
    return motivos.filter((item) => item.service_type_id === selected.id);
  }, [motivos, serviceTypes, selectedTipoServicio]);

  useEffect(() => {
    if (!selectedTipoServicio) {
      if (selectedMotivo) setValue("motivoServicio", "");
      return;
    }
    if (!selectedMotivo) return;
    if (!filteredMotivos.some((item) => item.name === selectedMotivo)) {
      setValue("motivoServicio", "");
    }
  }, [filteredMotivos, selectedMotivo, selectedTipoServicio, setValue]);

  async function onSubmit(values: FormValues) {
    setSubmitMessage(null);
    const payload = { ...values };
    const res = await fetch("/api/registro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSubmitMessage(data?.error || "No se pudo guardar el registro.");
      return;
    }

    setSubmitMessage("Registro guardado correctamente.");
  }

  useEffect(() => {
    async function loadCatalogs() {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const [tipoRes, canalRes, gerRes, motRes] = await Promise.all([
          fetch("/api/catalogos/tiposervicio"),
          fetch("/api/catalogos/canaloficina"),
          fetch("/api/catalogos/gerencia"),
          fetch("/api/catalogos/motivo"),
        ]);

        if (!tipoRes.ok || !canalRes.ok || !gerRes.ok || !motRes.ok) {
          throw new Error("No se pudieron cargar los catálogos");
        }

        const [tipoData, canalData, gerData, motData] = await Promise.all([
          tipoRes.json(),
          canalRes.json(),
          gerRes.json(),
          motRes.json(),
        ]);

        setServiceTypes(tipoData.items || []);
        setChannels(canalData.items || []);
        setGerencias(gerData.items || []);
        setMotivos(motData.items || []);
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
      if (name) setValue("encargado", name);
    }
    void loadUser();
  }, [setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="form">
      {catalogError && <p className="error">{catalogError}</p>}

      <div className="split">
        <div className="field">
          <label className="label">Tipo de registro *</label>
          <select className="select" {...register("tipoRegistro", { required: "Requerido" })}>
            <option value="INCIDENTE">Incidente</option>
            <option value="SOPORTE">Soporte</option>
          </select>
          {errors.tipoRegistro && <span className="error">{errors.tipoRegistro.message}</span>}
        </div>

        <div className="field">
          <label className="label">Usuario solicitante *</label>
          <input className="input" {...register("solicitante", { required: "Requerido" })} />
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
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          {errors.tipoServicio && <span className="error">{errors.tipoServicio.message}</span>}
        </div>

        <div className="field">
          <label className="label">Canal/Oficina *</label>
          <select
            className="select"
            {...register("canalOficina", { required: "Requerido" })}
            disabled={catalogLoading}
          >
            <option value="">Seleccionar...</option>
            {channels.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          {errors.canalOficina && <span className="error">{errors.canalOficina.message}</span>}
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
          <label className="label">Motivo de servicio *</label>
          <select
            className="select"
            {...register("motivoServicio", { required: "Requerido" })}
            disabled={catalogLoading || !selectedTipoServicio}
          >
            <option value="">
              {selectedTipoServicio ? "Seleccionar..." : "Selecciona un tipo de servicio primero"}
            </option>
            {filteredMotivos.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          {errors.motivoServicio && <span className="error">{errors.motivoServicio.message}</span>}
        </div>

        <div className="field">
          <label className="label">Encargado del incidente *</label>
          <input
            className="input input--readonly"
            readOnly
            value={userName}
            {...register("encargado", { required: "Requerido" })}
          />
          {errors.encargado && <span className="error">{errors.encargado.message}</span>}
        </div>
      </div>

      <div className="field">
        <label className="label">Descripción del incidente *</label>
        <textarea className="textarea" {...register("descripcion", { required: "Requerido" })} />
        {errors.descripcion && <span className="error">{errors.descripcion.message}</span>}
      </div>

      <div className="split">
        <div className="field">
          <label className="label">Fecha de reporte *</label>
          <input className="input" type="date" {...register("fechaReporte", { required: "Requerido" })} />
          {errors.fechaReporte && <span className="error">{errors.fechaReporte.message}</span>}
        </div>

        <div className="field">
          <label className="label">Hora de reporte *</label>
          <input className="input" type="time" {...register("horaReporte", { required: "Requerido" })} />
          {errors.horaReporte && <span className="error">{errors.horaReporte.message}</span>}
        </div>

        <div className="field">
          <label className="label">Fecha de respuesta *</label>
          <input
            className="input"
            type="date"
            {...register("fechaRespuesta", {
              required: "Requerido",
              validate: (value) => {
                const start = toDateTime(fechaReporte, horaReporte);
                const end = toDateTime(value, horaRespuesta);
                if (!start || !end) return true;
                return end.getTime() >= start.getTime() || "La respuesta no puede ser anterior al reporte";
              },
            })}
          />
          {errors.fechaRespuesta && <span className="error">{errors.fechaRespuesta.message}</span>}
        </div>

        <div className="field">
          <label className="label">Hora de respuesta *</label>
          <input
            className="input"
            type="time"
            {...register("horaRespuesta", {
              required: "Requerido",
              validate: (value) => {
                const start = toDateTime(fechaReporte, horaReporte);
                const end = toDateTime(fechaRespuesta, value);
                if (!start || !end) return true;
                return end.getTime() >= start.getTime() || "La respuesta no puede ser anterior al reporte";
              },
            })}
          />
          {errors.horaRespuesta && <span className="error">{errors.horaRespuesta.message}</span>}
        </div>
      </div>

      <div className="field">
        <label className="label">Acción tomada / solución aplicada *</label>
        <textarea className="textarea" {...register("accionTomada", { required: "Requerido" })} />
        {errors.accionTomada && <span className="error">{errors.accionTomada.message}</span>}
      </div>

      <div className="split">
        <div className="field">
          <label className="label">Resuelta en el primer contacto *</label>
          <select className="select" {...register("primerContacto", { required: "Requerido" })}>
            <option value="NO">No</option>
            <option value="SI">Sí</option>
          </select>
        </div>

        <div className="field">
          <label className="label">Tiempo transcurrido (auto)</label>
          <input className="input input--readonly" readOnly value={duration ?? "--"} />
          {duration === "ERROR" && <span className="error">La respuesta no puede ser anterior al reporte.</span>}
        </div>

        <div className="field">
          <label className="label">Categoría por tiempo (auto)</label>
          <input className="input input--readonly" readOnly value={categoriaTiempo} />
        </div>

        <div className="field">
          <label className="label">KPI de cumplimiento (auto)</label>
          <input className="input input--readonly" readOnly value={porcentajeKpi} />
        </div>
      </div>

      <button type="submit" disabled={isSubmitting} className="button">
        Guardar registro
      </button>

      {submitMessage && <p className={submitMessage.includes("correctamente") ? "success" : "error"}>{submitMessage}</p>}
    </form>
  );
}
