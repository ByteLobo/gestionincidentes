export function mapExternalStatus(estado: string) {
  switch (estado) {
    case "REGISTRADO":
      return "OPEN";
    case "EN_ATENCION":
      return "IN_PROGRESS";
    case "RESPONDIDO":
      return "ANSWERED";
    case "RESUELTO":
      return "RESOLVED";
    default:
      return "UNKNOWN";
  }
}
