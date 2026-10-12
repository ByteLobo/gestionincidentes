from __future__ import annotations

import tempfile
import unittest
import zipfile
from pathlib import Path

from export_kpi_report import (
    build_requester_rows,
    build_top_requester_reason_rows,
    build_workbook,
    total_resolution_minutes,
)


def make_ticket(
    ticket_id: int,
    requester: str,
    service: str,
    assignee: str,
    minutes: int | None,
    reason: str = "Solicitud",
) -> dict[str, object]:
    return {
        "id": ticket_id,
        "tipo_registro": "SOPORTE",
        "solicitante": requester,
        "tipo_servicio": service,
        "canal_oficina": "Mesa de ayuda",
        "gerencia": "Tecnología",
        "motivo_servicio": reason,
        "descripcion": "Caso de prueba",
        "encargado": assignee,
        "fecha_reporte": "2026-09-01",
        "hora_reporte": "08:00:00",
        "fecha_toma": "2026-09-01",
        "hora_toma": "08:05:00",
        "fecha_respuesta": "2026-09-01",
        "hora_respuesta": "09:00:00",
        "accion_tomada": "Atención validada",
        "primer_contacto": True,
        "tiempo_minutos": minutes,
        "mes_atencion": "2026-09",
        "categoria": "Menos de 1 hora",
        "porcentaje": 100,
        "estado": "RESUELTO",
    }


class ReportCalculationsTest(unittest.TestCase):
    def test_total_minutes_uses_only_recorded_times_and_minimum_one(self) -> None:
        items = [
            {"tiempo_minutos": 30},
            {"tiempo_minutos": 0},
            {"tiempo_minutos": None},
            {"tiempo_minutos": 90},
        ]

        self.assertEqual(total_resolution_minutes(items), 121)

    def test_top_five_requesters_include_their_most_requested_reason(self) -> None:
        items = [
            make_ticket(1, "Ana", "Correo", "Soporte 1", 30, "Contraseña"),
            make_ticket(2, "Ana", "Acceso", "Soporte 1", 30, "Instalación"),
            make_ticket(3, "Ana", "Correo", "Soporte 1", 30, "Contraseña"),
            make_ticket(4, "Bruno", "VPN", "Soporte 2", 60, "Conectividad"),
            make_ticket(5, "Bruno", "Acceso", "Soporte 2", 60, "Actualización"),
        ]

        requester_rows = build_requester_rows(items)
        result = build_top_requester_reason_rows(items, requester_rows)

        self.assertEqual(result[0], (1, "Ana", "Contraseña", 2))
        self.assertEqual(result[1], (2, "Bruno", "Actualización", 1))

    def test_workbook_contains_new_management_metrics_and_tables(self) -> None:
        items = [
            make_ticket(1, "Ana", "Correo", "Soporte 1", 30),
            make_ticket(2, "Ana", "Correo", "Soporte 1", 60),
            make_ticket(3, "Bruno", "VPN", "Soporte 2", 120),
        ]
        payload = {
            "meta": {"fechaDesde": "2026-09-01", "fechaHasta": "2026-09-30", "totalItems": 3},
            "items": items,
            "history": {
                "meta": {"fechaDesde": "2026-01-01", "fechaHasta": "2026-09-30", "totalItems": 3},
                "items": items,
            },
            "supportUsers": ["Soporte 1", "Soporte 2"],
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "reporte.xlsx"
            build_workbook(payload, output_path)

            self.assertTrue(output_path.is_file())
            with zipfile.ZipFile(output_path) as workbook_zip:
                shared_strings = workbook_zip.read("xl/sharedStrings.xml").decode("utf-8")

        self.assertIn("Promedio de atención (minutos)", shared_strings)
        self.assertIn("Tiempo total de atención (minutos)", shared_strings)
        self.assertIn("Horas de atención", shared_strings)
        self.assertIn("Motivo más solicitado por los 5 principales solicitantes", shared_strings)


if __name__ == "__main__":
    unittest.main()
