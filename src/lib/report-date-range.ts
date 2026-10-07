export type ReportDateRange = {
  fechaDesde: string;
  fechaHasta: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function validateReportDateRange(range: ReportDateRange): string | null {
  if (!parseIsoDate(range.fechaDesde) || !parseIsoDate(range.fechaHasta)) {
    return "Las fechas deben tener el formato YYYY-MM-DD";
  }
  if (range.fechaDesde > range.fechaHasta) {
    return "La fecha inicial no puede ser mayor a la fecha final";
  }
  return null;
}

export function getPreviousReportDateRange(current: ReportDateRange): ReportDateRange {
  const currentStart = parseIsoDate(current.fechaDesde);
  const currentEnd = parseIsoDate(current.fechaHasta);
  if (!currentStart || !currentEnd || currentStart > currentEnd) {
    throw new Error("El rango actual no es válido");
  }

  const durationDays = Math.round((currentEnd.getTime() - currentStart.getTime()) / DAY_MS) + 1;
  const previousEnd = new Date(currentStart.getTime() - DAY_MS);
  const previousStart = new Date(previousEnd.getTime() - (durationDays - 1) * DAY_MS);

  return {
    fechaDesde: formatIsoDate(previousStart),
    fechaHasta: formatIsoDate(previousEnd),
  };
}

export function resolvePreviousReportDateRange(
  current: ReportDateRange,
  fechaDesdeAnterior: string | null,
  fechaHastaAnterior: string | null
): { range?: ReportDateRange; error?: string } {
  if ((fechaDesdeAnterior && !fechaHastaAnterior) || (!fechaDesdeAnterior && fechaHastaAnterior)) {
    return { error: "Debes indicar fechaDesdeAnterior y fechaHastaAnterior" };
  }

  const range = fechaDesdeAnterior && fechaHastaAnterior
    ? { fechaDesde: fechaDesdeAnterior, fechaHasta: fechaHastaAnterior }
    : getPreviousReportDateRange(current);
  const error = validateReportDateRange(range);
  return error ? { error } : { range };
}
