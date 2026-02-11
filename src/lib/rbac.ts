export type Role = "SOLICITANTE" | "SOPORTE" | "SUPERVISOR" | "ADMIN";

export type Permission =
  | "INCIDENTE_CREAR"
  | "INCIDENTE_VER"
  | "INCIDENTE_EDITAR"
  | "INCIDENTE_CERRAR"
  | "INCIDENTE_EXPORTAR"
  | "SOPORTE_CREAR"
  | "SOPORTE_VER"
  | "SOPORTE_EDITAR"
  | "SOPORTE_CERRAR"
  | "SOPORTE_EXPORTAR"
  | "ADMIN_CATALOGOS"
  | "ADMIN_USUARIOS"
  | "AUDITORIA_VER";

export const rolePermissions: Record<Role, Permission[]> = {
  SOLICITANTE: ["INCIDENTE_CREAR", "INCIDENTE_VER", "SOPORTE_CREAR", "SOPORTE_VER"],
  SOPORTE: [
    "INCIDENTE_VER",
    "INCIDENTE_EDITAR",
    "INCIDENTE_CERRAR",
    "SOPORTE_VER",
    "SOPORTE_EDITAR",
    "SOPORTE_CERRAR",
  ],
  SUPERVISOR: ["INCIDENTE_VER", "SOPORTE_VER", "INCIDENTE_EXPORTAR", "SOPORTE_EXPORTAR", "AUDITORIA_VER"],
  ADMIN: [
    "INCIDENTE_VER",
    "SOPORTE_VER",
    "INCIDENTE_EXPORTAR",
    "SOPORTE_EXPORTAR",
    "AUDITORIA_VER",
    "ADMIN_CATALOGOS",
    "ADMIN_USUARIOS",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}
