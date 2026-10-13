#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

import xlsxwriter
from xlsxwriter.utility import xl_rowcol_to_cell


MONTH_NAMES = (
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
)

FormulaBuilder = Callable[[str, str], str]


def excel_sheet_name(name: str) -> str:
    return f"'{name.replace(chr(39), chr(39) * 2)}'"


def excel_column_range(sheet_name: str, column: str) -> str:
    return f"{excel_sheet_name(sheet_name)}!${column}:${column}"


def countif_formula_builder(sheet_name: str, column: str) -> FormulaBuilder:
    source_range = excel_column_range(sheet_name, column)
    return lambda criteria_cell, _label: f"=COUNTIF({source_range},{criteria_cell})"


def time_bucket_formula_builder(sheet_name: str) -> FormulaBuilder:
    id_range = excel_column_range(sheet_name, "A")
    minutes_range = excel_column_range(sheet_name, "O")

    def build(_criteria_cell: str, label: str) -> str:
        formulas = {
            "Menos de 1 hora": f'=COUNTIFS({minutes_range},">=1",{minutes_range},"<60")',
            "1 - 2 horas": f'=COUNTIFS({minutes_range},">=60",{minutes_range},"<120")',
            "2 - 4 horas": f'=COUNTIFS({minutes_range},">=120",{minutes_range},"<240")',
            "Mas de 4 horas": f'=COUNTIF({minutes_range},">=240")',
            "Sin tiempo": f'=COUNTIFS({id_range},"<>",{minutes_range},"")',
        }
        return formulas[label]

    return build


def normalize_person_name(value: Any) -> str:
    name = " ".join(str(value or "").split())
    comparable = "".join(
        character
        for character in unicodedata.normalize("NFKD", name)
        if not unicodedata.combining(character)
    ).casefold()
    if comparable == "cintia penaloza":
        return "Cintia Peñaloza"
    return name


def normalize_people(items: list[dict[str, Any]]) -> None:
    for item in items:
        for key in ("solicitante", "encargado"):
            if item.get(key) is not None:
                item[key] = normalize_person_name(item[key])


def normalize_minutes(value: int | float | None) -> int | float | None:
    if value is None:
        return None
    return max(1, value)


def format_datetime(date_value: str | None, time_value: str | None) -> str:
    if not date_value:
        return "--"

    date_part = date_value.split("T", 1)[0]
    time_part = ""
    if time_value:
        time_part = time_value.split(".", 1)[0]
    elif "T" in date_value:
        time_part = date_value.split("T", 1)[1].split(".", 1)[0]
    hhmm = time_part[:5] if time_part else "00:00"
    return f"{date_part} {hhmm}"


def build_series(items: list[dict[str, Any]], key: str, fallback: str = "Sin dato") -> list[tuple[str, int]]:
    counter = Counter()
    for item in items:
        value = item.get(key)
        label = str(value).strip() if value is not None else ""
        counter[label or fallback] += 1
    return counter.most_common()


def build_time_series(items: list[dict[str, Any]]) -> list[tuple[str, int]]:
    buckets = [
        ("Menos de 1 hora", 0),
        ("1 - 2 horas", 0),
        ("2 - 4 horas", 0),
        ("Mas de 4 horas", 0),
        ("Sin tiempo", 0),
    ]

    for item in items:
        minutes = normalize_minutes(item.get("tiempo_minutos"))
        if minutes is None:
            buckets[4] = (buckets[4][0], buckets[4][1] + 1)
        elif minutes < 60:
            buckets[0] = (buckets[0][0], buckets[0][1] + 1)
        elif minutes < 120:
            buckets[1] = (buckets[1][0], buckets[1][1] + 1)
        elif minutes < 240:
            buckets[2] = (buckets[2][0], buckets[2][1] + 1)
        else:
            buckets[3] = (buckets[3][0], buckets[3][1] + 1)

    return [bucket for bucket in buckets if bucket[1] > 0]


def average_resolution_minutes(items: list[dict[str, Any]]) -> float:
    values = [normalize_minutes(item["tiempo_minutos"]) for item in items if item.get("tiempo_minutos") is not None]
    if not values:
        return 0.0
    return sum(values) / len(values)


def total_resolution_minutes(items: list[dict[str, Any]]) -> float:
    values = [normalize_minutes(item["tiempo_minutos"]) for item in items if item.get("tiempo_minutos") is not None]
    return sum(values)


def average_kpi_percentage(items: list[dict[str, Any]]) -> float:
    values = [float(item["porcentaje"]) for item in items if item.get("porcentaje") is not None]
    return sum(values) / len(values) if values else 0.0


def percentage(part: int, total: int) -> float:
    return (part / total) * 100 if total else 0.0


def build_monthly_history(
    items: list[dict[str, Any]],
    fecha_hasta: str,
) -> list[tuple[str, int, int]]:
    end_date = datetime.strptime(fecha_hasta[:10], "%Y-%m-%d")
    monthly = {month: {"requested": 0, "resolved": 0} for month in range(1, end_date.month + 1)}

    for item in items:
        raw_date = str(item.get("fecha_reporte") or "")[:10]
        try:
            report_date = datetime.strptime(raw_date, "%Y-%m-%d")
        except ValueError:
            continue
        if report_date.year != end_date.year or report_date.month not in monthly:
            continue
        monthly[report_date.month]["requested"] += 1
        if item.get("estado") == "RESUELTO":
            monthly[report_date.month]["resolved"] += 1

    return [
        (MONTH_NAMES[month - 1], values["requested"], values["resolved"])
        for month, values in monthly.items()
    ]


def align_series(
    current_rows: list[tuple[str, int]],
    previous_rows: list[tuple[str, int]],
) -> list[tuple[str, int, int]]:
    current = dict(current_rows)
    previous = dict(previous_rows)
    labels = set(current) | set(previous)
    return sorted(
        ((label, current.get(label, 0), previous.get(label, 0)) for label in labels),
        key=lambda entry: (-(entry[1] + entry[2]), entry[0].casefold()),
    )


DETAIL_COLUMNS = [
    ("ID", 8),
    ("Tipo registro", 16),
    ("Solicitante", 22),
    ("Tipo servicio", 22),
    ("Canal / Oficina", 18),
    ("Gerencia", 18),
    ("Motivo servicio", 22),
    ("Descripcion", 40),
    ("Encargado", 22),
    ("Reporte", 18),
    ("Toma", 18),
    ("Resolucion", 18),
    ("Accion tomada", 30),
    ("Primer contacto", 16),
    ("Tiempo minutos", 16),
    ("Mes atencion", 14),
    ("Categoria", 16),
    ("Porcentaje", 12),
    ("Estado", 14),
]


def allocate_sheet_name(label: str, used_names: set[str]) -> str:
    cleaned = re.sub(r"[\[\]:*?/\\]", "-", label).strip(" '") or "Soporte"
    base = cleaned[:31]
    candidate = base
    suffix = 2
    while candidate.casefold() in used_names:
        marker = f" ({suffix})"
        candidate = f"{base[:31 - len(marker)]}{marker}"
        suffix += 1
    used_names.add(candidate.casefold())
    return candidate


def write_ticket_sheet(
    workbook: xlsxwriter.Workbook,
    worksheet: xlsxwriter.worksheet.Worksheet,
    items: list[dict[str, Any]],
    start_row: int = 0,
    freeze_header: bool = True,
) -> None:
    header_fmt = workbook.add_format({
        "bold": True,
        "bg_color": "#16324F",
        "font_color": "#FFFFFF",
        "border": 1,
        "text_wrap": True,
        "valign": "top",
    })
    text_fmt = workbook.add_format({"border": 1, "valign": "top"})
    center_fmt = workbook.add_format({"border": 1, "align": "center", "valign": "top"})

    if freeze_header:
        worksheet.freeze_panes(start_row + 1, 0)
    worksheet.autofilter(start_row, 0, start_row + max(len(items), 1), len(DETAIL_COLUMNS) - 1)
    worksheet.set_zoom(90)

    for col_index, (label, width) in enumerate(DETAIL_COLUMNS):
        worksheet.write(start_row, col_index, label, header_fmt)
        worksheet.set_column(col_index, col_index, width)

    for row_index, item in enumerate(items, start=start_row + 1):
        minutes = normalize_minutes(item["tiempo_minutos"])
        worksheet.write_number(row_index, 0, item["id"], center_fmt)
        worksheet.write(row_index, 1, item["tipo_registro"], text_fmt)
        worksheet.write(row_index, 2, item["solicitante"], text_fmt)
        worksheet.write(row_index, 3, item["tipo_servicio"], text_fmt)
        worksheet.write(row_index, 4, item["canal_oficina"], text_fmt)
        worksheet.write(row_index, 5, item["gerencia"], text_fmt)
        worksheet.write(row_index, 6, item["motivo_servicio"], text_fmt)
        worksheet.write(row_index, 7, item["descripcion"], text_fmt)
        worksheet.write(row_index, 8, item["encargado"], text_fmt)
        worksheet.write(row_index, 9, format_datetime(item["fecha_reporte"], item["hora_reporte"]), center_fmt)
        worksheet.write(row_index, 10, format_datetime(item["fecha_toma"], item["hora_toma"]), center_fmt)
        worksheet.write(row_index, 11, format_datetime(item["fecha_respuesta"], item["hora_respuesta"]), center_fmt)
        worksheet.write(row_index, 12, item.get("accion_tomada") or "", text_fmt)
        worksheet.write(row_index, 13, "Si" if item["primer_contacto"] else "No", center_fmt)
        worksheet.write(row_index, 14, minutes if minutes is not None else "", center_fmt)
        worksheet.write(row_index, 15, item.get("mes_atencion") or "", center_fmt)
        worksheet.write(row_index, 16, item.get("categoria") or "", center_fmt)
        worksheet.write(row_index, 17, item["porcentaje"] if item["porcentaje"] is not None else "", center_fmt)
        worksheet.write(row_index, 18, item["estado"], center_fmt)


def write_unresolved_ticket_section(
    workbook: xlsxwriter.Workbook,
    worksheet: xlsxwriter.worksheet.Worksheet,
    items: list[dict[str, Any]],
    start_row: int,
) -> int:
    """Write an executive-friendly list of tickets that still require follow-up."""
    section_fmt = workbook.add_format({
        "bold": True,
        "font_size": 13,
        "font_color": "#16324F",
    })
    subtitle_fmt = workbook.add_format({"font_size": 10, "font_color": "#4B5D70"})
    header_fmt = workbook.add_format({
        "bold": True,
        "bg_color": "#16324F",
        "font_color": "#FFFFFF",
        "border": 1,
        "align": "center",
        "valign": "vcenter",
        "text_wrap": True,
    })
    text_fmt = workbook.add_format({"border": 1, "valign": "top", "text_wrap": True})
    center_fmt = workbook.add_format({"border": 1, "align": "center", "valign": "top"})
    empty_fmt = workbook.add_format({
        "bg_color": "#F7FBFE",
        "font_color": "#4B5D70",
        "border": 1,
        "italic": True,
    })

    unresolved_items = [item for item in items if item.get("estado") != "RESUELTO"]
    worksheet.write(start_row, 0, "Tickets pendientes de resolución", section_fmt)
    worksheet.write(
        start_row + 1,
        0,
        f"{len(unresolved_items)} ticket(s) del período aún no se han resuelto.",
        subtitle_fmt,
    )

    header_row = start_row + 3
    columns = [
        "ID",
        "Solicitante",
        "Tipo de servicio",
        "Motivo",
        "Descripción",
        "Encargado",
        "Fecha de reporte",
        "Estado",
    ]
    for column, label in enumerate(columns):
        worksheet.write(header_row, column, label, header_fmt)

    if not unresolved_items:
        worksheet.merge_range(
            header_row + 1,
            0,
            header_row + 1,
            len(columns) - 1,
            "Todos los tickets del período están resueltos.",
            empty_fmt,
        )
        return header_row + 2

    for offset, item in enumerate(unresolved_items, start=1):
        row = header_row + offset
        worksheet.write_number(row, 0, item["id"], center_fmt)
        worksheet.write(row, 1, item.get("solicitante") or "", text_fmt)
        worksheet.write(row, 2, item.get("tipo_servicio") or "", text_fmt)
        worksheet.write(row, 3, item.get("motivo_servicio") or "", text_fmt)
        worksheet.write(row, 4, item.get("descripcion") or "", text_fmt)
        worksheet.write(row, 5, item.get("encargado") or "", text_fmt)
        worksheet.write(
            row,
            6,
            format_datetime(item.get("fecha_reporte"), item.get("hora_reporte")),
            center_fmt,
        )
        worksheet.write(row, 7, item.get("estado") or "Sin estado", center_fmt)

    last_row = header_row + len(unresolved_items)
    worksheet.autofilter(header_row, 0, last_row, len(columns) - 1)
    return last_row + 1


def build_requester_rows(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "resueltos": 0, "abiertos": 0})
    for item in items:
        name = str(item.get("solicitante") or "Sin dato").strip() or "Sin dato"
        grouped[name]["total"] += 1
        if item.get("estado") == "RESUELTO":
            grouped[name]["resueltos"] += 1
        else:
            grouped[name]["abiertos"] += 1

    return [
        {"name": name, **counts}
        for name, counts in sorted(grouped.items(), key=lambda entry: (-entry[1]["total"], entry[0].casefold()))
    ]


def build_top_requester_reason_matrix(
    items: list[dict[str, Any]],
    requester_rows: list[dict[str, Any]],
    limit: int = 5,
) -> tuple[list[str], list[tuple[str, list[int], int]]]:
    top_requesters = [row["name"] for row in requester_rows[:limit]]
    reasons_by_requester: dict[str, Counter[str]] = {
        requester: Counter() for requester in top_requesters
    }

    for item in items:
        requester = str(item.get("solicitante") or "Sin dato").strip() or "Sin dato"
        if requester not in reasons_by_requester:
            continue
        reason = str(item.get("motivo_servicio") or "Sin dato").strip() or "Sin dato"
        reasons_by_requester[requester][reason] += 1

    reason_totals = Counter({
        reason: sum(counter[reason] for counter in reasons_by_requester.values())
        for reason in {
            reason
            for counter in reasons_by_requester.values()
            for reason in counter
        }
    })
    reasons = sorted(reason_totals, key=lambda reason: (-reason_totals[reason], reason.casefold()))
    rows = [
        (
            requester,
            [reasons_by_requester[requester][reason] for reason in reasons],
            sum(reasons_by_requester[requester].values()),
        )
        for requester in top_requesters
    ]
    return reasons, rows


def write_requester_sheet(
    workbook: xlsxwriter.Workbook,
    worksheet: xlsxwriter.worksheet.Worksheet,
    rows: list[dict[str, Any]],
    reason_labels: list[str],
    reason_rows: list[tuple[str, list[int], int]],
) -> None:
    title_fmt = workbook.add_format({"bold": True, "font_size": 18, "font_color": "#16324F"})
    subtitle_fmt = workbook.add_format({"font_size": 10, "font_color": "#4B5D70"})
    header_fmt = workbook.add_format({
        "bold": True,
        "bg_color": "#16324F",
        "font_color": "#FFFFFF",
        "border": 1,
        "align": "center",
    })
    text_fmt = workbook.add_format({"border": 1})
    number_fmt = workbook.add_format({"border": 1, "align": "center"})

    worksheet.write("A1", "Personas que más tickets solicitan", title_fmt)
    worksheet.write("A2", "Los totales se recalculan al corregir la hoja Detalle", subtitle_fmt)
    worksheet.set_column("A:A", 10)
    worksheet.set_column("B:B", 34)
    worksheet.set_column("C:E", 14)
    if reason_labels:
        worksheet.set_column(2, 2 + len(reason_labels), 18)
    worksheet.freeze_panes(4, 0)

    headers = ["Posicion", "Solicitante", "Total", "Resueltos", "Abiertos"]
    for column, label in enumerate(headers):
        worksheet.write(3, column, label, header_fmt)

    for index, item in enumerate(rows, start=1):
        row = index + 3
        excel_row = row + 1
        worksheet.write_number(row, 0, index, number_fmt)
        worksheet.write(row, 1, item["name"], text_fmt)
        worksheet.write_formula(
            row,
            2,
            f"=COUNTIF({excel_column_range('Detalle', 'C')},$B{excel_row})",
            number_fmt,
            item["total"],
        )
        worksheet.write_formula(
            row,
            3,
            (
                f"=COUNTIFS({excel_column_range('Detalle', 'C')},$B{excel_row},"
                f'{excel_column_range("Detalle", "S")},"RESUELTO")'
            ),
            number_fmt,
            item["resueltos"],
        )
        worksheet.write_formula(row, 4, f"=C{excel_row}-D{excel_row}", number_fmt, item["abiertos"])

    if rows:
        chart = workbook.add_chart({"type": "bar"})
        chart_rows = min(len(rows), 10)
        chart.add_series({
            "name": "Total tickets",
            "categories": [worksheet.name, 4, 1, 3 + chart_rows, 1],
            "values": [worksheet.name, 4, 2, 3 + chart_rows, 2],
            "fill": {"color": "#0B6E81"},
            "border": {"color": "#0B6E81"},
            "data_labels": {"value": True},
        })
        chart.set_title({"name": "Top 10 solicitantes"})
        chart.set_legend({"none": True})
        chart.set_y_axis({"reverse": True})
        chart.set_x_axis({"major_gridlines": {"visible": False}})
        chart.set_size({"width": 720, "height": 360})
        worksheet.insert_chart("G4", chart)

    reason_table_row = max(len(rows) + 6, 23)
    write_requester_reason_table(
        workbook,
        worksheet,
        reason_table_row,
        reason_labels,
        reason_rows,
        formula_source_sheet="Detalle",
        start_col=1,
    )


def write_requester_reason_table(
    workbook: xlsxwriter.Workbook,
    worksheet: xlsxwriter.worksheet.Worksheet,
    start_row: int,
    reasons: list[str],
    rows: list[tuple[str, list[int], int]],
    formula_source_sheet: str | None = None,
    start_col: int = 0,
) -> int:
    title_fmt = workbook.add_format({"bold": True, "font_size": 12, "font_color": "#16324F"})
    subtitle_fmt = workbook.add_format({"font_size": 10, "font_color": "#4B5D70"})
    header_fmt = workbook.add_format({
        "bold": True,
        "bg_color": "#D9EAF7",
        "border": 1,
        "font_color": "#16324F",
        "align": "center",
    })
    text_fmt = workbook.add_format({"border": 1, "valign": "vcenter"})
    number_fmt = workbook.add_format({"border": 1, "align": "center", "valign": "vcenter"})
    total_fmt = workbook.add_format({
        "bold": True,
        "border": 1,
        "align": "center",
        "valign": "vcenter",
        "bg_color": "#EAF3F8",
        "font_color": "#16324F",
    })

    worksheet.write(start_row, start_col, "Matriz de motivos de los 5 principales solicitantes", title_fmt)
    worksheet.write(
        start_row + 1,
        start_col,
        "Filas: solicitantes · Columnas: motivos · Celdas: cantidad de tickets.",
        subtitle_fmt,
    )
    header_row = start_row + 2
    headers = ["Solicitante", *reasons, "Total"]
    for offset, label in enumerate(headers):
        worksheet.write(header_row, start_col + offset, label, header_fmt)
    worksheet.set_row(header_row, 42)

    if not rows:
        worksheet.merge_range(
            header_row + 1,
            start_col,
            header_row + 1,
            start_col + max(len(headers) - 1, 1),
            "Sin datos en el rango seleccionado",
            text_fmt,
        )
        return 4

    first_reason_col = start_col + 1
    total_col = first_reason_col + len(reasons)
    for offset, (requester, counts, total) in enumerate(rows, start=1):
        row = header_row + offset
        requester_cell = xl_rowcol_to_cell(row, start_col, col_abs=True)
        worksheet.write(row, start_col, requester, text_fmt)
        for reason_offset, count in enumerate(counts):
            column = first_reason_col + reason_offset
            if formula_source_sheet:
                reason_cell = xl_rowcol_to_cell(header_row, column, row_abs=True)
                formula = (
                    f"=COUNTIFS({excel_column_range(formula_source_sheet, 'C')},{requester_cell},"
                    f"{excel_column_range(formula_source_sheet, 'G')},{reason_cell})"
                )
                worksheet.write_formula(row, column, formula, number_fmt, count)
            else:
                worksheet.write_number(row, column, count, number_fmt)

        if reasons:
            first_count_cell = xl_rowcol_to_cell(row, first_reason_col)
            last_count_cell = xl_rowcol_to_cell(row, total_col - 1)
            worksheet.write_formula(
                row,
                total_col,
                f"=SUM({first_count_cell}:{last_count_cell})",
                total_fmt,
                total,
            )
        else:
            worksheet.write_number(row, total_col, total, total_fmt)

    if reasons:
        worksheet.conditional_format(
            header_row + 1,
            first_reason_col,
            header_row + len(rows),
            total_col - 1,
            {
                "type": "data_bar",
                "bar_color": "#9BC7D4",
                "bar_solid": True,
                "bar_border_color": "#6BA9BA",
            },
        )

    return len(rows) + 4


def write_support_workload_block(
    worksheet: xlsxwriter.worksheet.Worksheet,
    workbook: xlsxwriter.Workbook,
    title: str,
    start_row: int,
    rows: list[tuple[str, int, float]],
    color: str,
    formula_source_sheet: str | None = None,
) -> int:
    title_fmt = workbook.add_format({"bold": True, "font_size": 12, "font_color": "#16324F"})
    header_fmt = workbook.add_format({
        "bold": True,
        "bg_color": "#D9EAF7",
        "border": 1,
        "font_color": "#16324F",
    })
    label_fmt = workbook.add_format({"border": 1})
    number_fmt = workbook.add_format({"border": 1, "align": "center"})
    hours_fmt = workbook.add_format({"border": 1, "align": "center", "num_format": '0.00 "h"'})

    worksheet.write(start_row, 0, title, title_fmt)
    header_row = start_row + 1
    for column, label in enumerate(["Usuario de soporte", "Atenciones", "Horas de atención"]):
        worksheet.write(header_row, column, label, header_fmt)

    for index, (assignee, attentions, hours) in enumerate(rows, start=1):
        row = header_row + index
        assignee_cell = xl_rowcol_to_cell(row, 0, row_abs=True, col_abs=True)
        worksheet.write(row, 0, assignee, label_fmt)
        if formula_source_sheet:
            assignee_range = excel_column_range(formula_source_sheet, "I")
            minutes_range = excel_column_range(formula_source_sheet, "O")
            worksheet.write_formula(
                row,
                1,
                f"=COUNTIF({assignee_range},{assignee_cell})",
                number_fmt,
                attentions,
            )
            worksheet.write_formula(
                row,
                2,
                f"=SUMIF({assignee_range},{assignee_cell},{minutes_range})/60",
                hours_fmt,
                hours,
            )
        else:
            worksheet.write_number(row, 1, attentions, number_fmt)
            worksheet.write_number(row, 2, hours, hours_fmt)

    chart_height = max(240, 70 + len(rows) * 28)
    if rows:
        last_data_row = header_row + len(rows)
        chart = workbook.add_chart({"type": "bar"})
        chart.add_series({
            "name": "Atenciones",
            "categories": [worksheet.name, header_row + 1, 0, last_data_row, 0],
            "values": [worksheet.name, header_row + 1, 1, last_data_row, 1],
            "fill": {"color": color},
            "border": {"color": color},
            "data_labels": {"value": True},
        })
        chart.set_title({"name": title})
        chart.set_legend({"none": True})
        chart.set_chartarea({"border": {"none": True}})
        chart.set_plotarea({"border": {"none": True}})
        chart.set_x_axis({"major_gridlines": {"visible": False}})
        chart.set_y_axis({"reverse": True})
        chart.set_size({"width": 620, "height": chart_height})
        chart.set_style(10)
        worksheet.insert_chart(start_row, 4, chart, {"x_offset": 10, "y_offset": 4})
    else:
        worksheet.write(header_row + 1, 0, "Sin datos en el rango seleccionado", label_fmt)
        worksheet.write_blank(header_row + 1, 1, None, number_fmt)
        worksheet.write_blank(header_row + 1, 2, None, hours_fmt)

    return max(len(rows) + 4, math.ceil(chart_height / 20) + 1)


def write_chart_block(
    worksheet: xlsxwriter.worksheet.Worksheet,
    workbook: xlsxwriter.Workbook,
    title: str,
    start_row: int,
    start_col: int,
    rows: list[tuple[str, int]],
    color: str,
    sheet_name: str | None = None,
    formula_builder: FormulaBuilder | None = None,
) -> int:
    title_fmt = workbook.add_format({
        "bold": True,
        "font_size": 12,
        "font_color": "#16324F",
    })
    table_header_fmt = workbook.add_format({
        "bold": True,
        "bg_color": "#D9EAF7",
        "border": 1,
        "font_color": "#16324F",
    })
    label_fmt = workbook.add_format({"border": 1})
    value_fmt = workbook.add_format({"border": 1, "align": "center"})

    worksheet.write(start_row, start_col, title, title_fmt)
    header_row = start_row + 1
    worksheet.write(header_row, start_col, "Categoria", table_header_fmt)
    worksheet.write(header_row, start_col + 1, "Total", table_header_fmt)

    for index, (label, total) in enumerate(rows, start=1):
        row = header_row + index
        worksheet.write(row, start_col, label, label_fmt)
        if formula_builder:
            criteria_cell = xl_rowcol_to_cell(row, start_col, row_abs=True, col_abs=True)
            worksheet.write_formula(
                row,
                start_col + 1,
                formula_builder(criteria_cell, label),
                value_fmt,
                total,
            )
        else:
            worksheet.write_number(row, start_col + 1, total, value_fmt)

    chart_height = max(240, 70 + len(rows) * 28)
    if rows:
        chart = workbook.add_chart({"type": "bar"})
        last_data_row = header_row + len(rows)
        chart.add_series({
            "name": title,
            "categories": [sheet_name or worksheet.name, header_row + 1, start_col, last_data_row, start_col],
            "values": [sheet_name or worksheet.name, header_row + 1, start_col + 1, last_data_row, start_col + 1],
            "fill": {"color": color},
            "border": {"color": color},
            "data_labels": {"value": True},
        })
        chart.set_title({"name": title})
        chart.set_legend({"none": True})
        chart.set_chartarea({"border": {"none": True}})
        chart.set_plotarea({"border": {"none": True}})
        chart.set_x_axis({"major_gridlines": {"visible": False}})
        chart.set_y_axis({"reverse": True})
        chart.set_size({"width": 620, "height": chart_height})
        chart.set_style(10)

        worksheet.insert_chart(start_row, start_col + 3, chart, {"x_offset": 10, "y_offset": 4})
    else:
        worksheet.write(header_row + 1, start_col, "Sin datos en el rango seleccionado", label_fmt)
        worksheet.write_blank(header_row + 1, start_col + 1, None, value_fmt)

    return max(len(rows) + 4, math.ceil(chart_height / 20) + 1)


def write_history_chart(
    worksheet: xlsxwriter.worksheet.Worksheet,
    workbook: xlsxwriter.Workbook,
    start_row: int,
    rows: list[tuple[str, int, int]],
) -> int:
    title_fmt = workbook.add_format({"bold": True, "font_size": 12, "font_color": "#16324F"})
    header_fmt = workbook.add_format({
        "bold": True,
        "bg_color": "#D9EAF7",
        "border": 1,
        "font_color": "#16324F",
        "align": "center",
    })
    label_fmt = workbook.add_format({"border": 1})
    number_fmt = workbook.add_format({"border": 1, "align": "center"})

    title = "Historial de atención de tickets"
    worksheet.write(start_row, 0, title, title_fmt)
    header_row = start_row + 1
    for column, label in enumerate(["Mes", "Solicitados", "Resueltos"]):
        worksheet.write(header_row, column, label, header_fmt)

    for index, (month, requested, resolved) in enumerate(rows, start=1):
        row = header_row + index
        worksheet.write(row, 0, month, label_fmt)
        worksheet.write_number(row, 1, requested, number_fmt)
        worksheet.write_number(row, 2, resolved, number_fmt)

    if rows:
        last_row = header_row + len(rows)
        series = [
            ("Tickets solicitados", 1, "#1F77B4"),
            ("Tickets resueltos", 2, "#2CA02C"),
        ]

        column_chart = workbook.add_chart({"type": "column"})
        for name, column, color in series:
            column_chart.add_series({
                "name": name,
                "categories": [worksheet.name, header_row + 1, 0, last_row, 0],
                "values": [worksheet.name, header_row + 1, column, last_row, column],
                "fill": {"color": color},
                "border": {"color": color},
                "data_labels": {"value": True},
            })
        column_chart.set_title({"name": "Comparación mensual: solicitados vs resueltos"})
        column_chart.set_legend({"position": "bottom"})
        column_chart.set_chartarea({"border": {"none": True}})
        column_chart.set_plotarea({"border": {"none": True}})
        column_chart.set_x_axis({"name": "Mes"})
        column_chart.set_y_axis({
            "name": "Cantidad de tickets",
            "min": 0,
            "major_gridlines": {"visible": True},
        })
        column_chart.set_size({"width": 560, "height": 320})
        column_chart.set_style(10)
        worksheet.insert_chart(start_row, 4, column_chart, {"x_offset": 10, "y_offset": 4})

        line_chart = workbook.add_chart({"type": "line"})
        for name, column, color in series:
            line_chart.add_series({
                "name": name,
                "categories": [worksheet.name, header_row + 1, 0, last_row, 0],
                "values": [worksheet.name, header_row + 1, column, last_row, column],
                "line": {"color": color, "width": 2.25},
                "marker": {
                    "type": "circle",
                    "size": 6,
                    "border": {"color": color},
                    "fill": {"color": "#FFFFFF"},
                },
            })
        line_chart.set_title({"name": "Tendencia mensual: solicitados vs resueltos"})
        line_chart.set_legend({"position": "bottom"})
        line_chart.set_chartarea({"border": {"none": True}})
        line_chart.set_plotarea({"border": {"none": True}})
        line_chart.set_x_axis({"name": "Mes"})
        line_chart.set_y_axis({
            "name": "Cantidad de tickets",
            "min": 0,
            "major_gridlines": {"visible": True},
        })
        line_chart.set_size({"width": 560, "height": 320})
        line_chart.set_style(10)
        worksheet.insert_chart(start_row, 13, line_chart, {"x_offset": 10, "y_offset": 4})

    return max(len(rows) + 4, 18)


def write_support_kpi_sheet(
    workbook: xlsxwriter.Workbook,
    worksheet: xlsxwriter.worksheet.Worksheet,
    assignee: str,
    items: list[dict[str, Any]],
    meta: dict[str, Any],
) -> None:
    title_fmt = workbook.add_format({"bold": True, "font_size": 18, "font_color": "#16324F"})
    subtitle_fmt = workbook.add_format({"font_size": 10, "font_color": "#4B5D70"})
    section_fmt = workbook.add_format({"bold": True, "font_size": 13, "font_color": "#16324F"})
    card_label_fmt = workbook.add_format({
        "bold": True,
        "font_size": 10,
        "bg_color": "#D9EAF7",
        "border": 1,
        "font_color": "#16324F",
        "align": "center",
        "valign": "vcenter",
        "text_wrap": True,
    })
    card_value_fmt = workbook.add_format({
        "font_size": 16,
        "bold": True,
        "align": "center",
        "valign": "vcenter",
        "border": 1,
        "bg_color": "#F7FBFE",
        "font_color": "#0B4F6C",
    })
    link_fmt = workbook.add_format({"font_color": "#0B6E81", "underline": True})

    worksheet.set_zoom(85)
    worksheet.write("A1", f"KPI de soporte: {assignee}", title_fmt)
    worksheet.write("A2", f"Rango: {meta['fechaDesde']} a {meta['fechaHasta']}", subtitle_fmt)
    worksheet.write_url("A3", "internal:'Resumen KPI'!A1", link_fmt, "Volver al resumen general")

    total_items = len(items)
    resolved_items = sum(1 for item in items if item.get("estado") == "RESUELTO")
    avg_minutes = average_resolution_minutes(items)
    total_minutes = total_resolution_minutes(items)
    fulfillment = percentage(resolved_items, total_items)

    cards = [
        ("Total de tickets solicitados", total_items),
        ("Tickets resueltos", resolved_items),
        ("Cumplimiento de tickets", f"{fulfillment:.1f}%"),
        ("Promedio de atención (minutos)", f"{avg_minutes:.1f} min"),
        ("Tiempo total de atención (minutos)", f"{total_minutes:.0f} min"),
    ]
    for index, (label, value) in enumerate(cards):
        col = index * 3
        worksheet.merge_range(4, col, 4, col + 1, label, card_label_fmt)
        worksheet.merge_range(5, col, 7, col + 1, value, card_value_fmt)

    chart_specs = [
        ("Tickets por tipo de servicio", build_series(items, "tipo_servicio"), "#1F77B4"),
        ("Tickets por motivo de servicio", build_series(items, "motivo_servicio"), "#FF7F0E"),
        ("Tickets por canal de atencion", build_series(items, "canal_oficina"), "#2CA02C"),
        ("Tiempo de respuesta", build_time_series(items), "#9467BD"),
        ("Tickets por categoria KPI", build_series(items, "categoria"), "#0B6E81"),
    ]

    next_row = 10
    for title, rows, color in chart_specs:
        next_row += write_chart_block(worksheet, workbook, title, next_row, 0, rows, color)
        next_row += 1

    detail_row = next_row + 1
    worksheet.write(detail_row, 0, "Detalle de tickets y acciones realizadas", section_fmt)
    worksheet.write(detail_row + 1, 0, "La columna 'Accion tomada' muestra qué hizo el usuario en cada atención.", subtitle_fmt)
    write_ticket_sheet(
        workbook,
        worksheet,
        items,
        start_row=detail_row + 3,
        freeze_header=False,
    )


def write_comparison_chart_block(
    worksheet: xlsxwriter.worksheet.Worksheet,
    workbook: xlsxwriter.Workbook,
    title: str,
    start_row: int,
    rows: list[tuple[str, int, int]],
    current_formula_builder: FormulaBuilder | None = None,
    previous_formula_builder: FormulaBuilder | None = None,
) -> int:
    title_fmt = workbook.add_format({"bold": True, "font_size": 12, "font_color": "#16324F"})
    header_fmt = workbook.add_format({
        "bold": True,
        "bg_color": "#D9EAF7",
        "border": 1,
        "font_color": "#16324F",
    })
    label_fmt = workbook.add_format({"border": 1})
    number_fmt = workbook.add_format({"border": 1, "align": "center"})

    worksheet.write(start_row, 0, title, title_fmt)
    header_row = start_row + 1
    for column, label in enumerate(["Categoria", "Actual", "Anterior", "Variacion"]):
        worksheet.write(header_row, column, label, header_fmt)

    for index, (label, current, previous) in enumerate(rows, start=1):
        row = header_row + index
        criteria_cell = xl_rowcol_to_cell(row, 0, row_abs=True, col_abs=True)
        excel_row = row + 1
        worksheet.write(row, 0, label, label_fmt)
        if current_formula_builder and previous_formula_builder:
            worksheet.write_formula(
                row, 1, current_formula_builder(criteria_cell, label), number_fmt, current
            )
            worksheet.write_formula(
                row, 2, previous_formula_builder(criteria_cell, label), number_fmt, previous
            )
            worksheet.write_formula(row, 3, f"=B{excel_row}-C{excel_row}", number_fmt, current - previous)
        else:
            worksheet.write_number(row, 1, current, number_fmt)
            worksheet.write_number(row, 2, previous, number_fmt)
            worksheet.write_number(row, 3, current - previous, number_fmt)

    chart_height = max(260, 80 + len(rows) * 28)
    if rows:
        last_row = header_row + len(rows)
        chart = workbook.add_chart({"type": "bar"})
        for name, column, color in [
            ("Periodo actual", 1, "#0B6E81"),
            ("Periodo anterior", 2, "#A9B7C3"),
        ]:
            chart.add_series({
                "name": name,
                "categories": [worksheet.name, header_row + 1, 0, last_row, 0],
                "values": [worksheet.name, header_row + 1, column, last_row, column],
                "fill": {"color": color},
                "border": {"color": color},
                "data_labels": {"value": True},
            })
        chart.set_title({"name": title})
        chart.set_legend({"position": "bottom"})
        chart.set_chartarea({"border": {"none": True}})
        chart.set_plotarea({"border": {"none": True}})
        chart.set_x_axis({"major_gridlines": {"visible": False}})
        chart.set_y_axis({"reverse": True})
        chart.set_size({"width": 720, "height": chart_height})
        chart.set_style(10)
        worksheet.insert_chart(start_row, 5, chart, {"x_offset": 10, "y_offset": 4})
    else:
        worksheet.write(header_row + 1, 0, "Sin datos en ambos periodos", label_fmt)

    return max(len(rows) + 4, math.ceil(chart_height / 20) + 1)


def write_comparison_sheet(
    workbook: xlsxwriter.Workbook,
    worksheet: xlsxwriter.worksheet.Worksheet,
    current_items: list[dict[str, Any]],
    current_meta: dict[str, Any],
    previous_items: list[dict[str, Any]],
    previous_meta: dict[str, Any],
) -> None:
    title_fmt = workbook.add_format({"bold": True, "font_size": 18, "font_color": "#16324F"})
    subtitle_fmt = workbook.add_format({"font_size": 10, "font_color": "#4B5D70"})
    header_fmt = workbook.add_format({
        "bold": True,
        "bg_color": "#16324F",
        "font_color": "#FFFFFF",
        "border": 1,
        "align": "center",
    })
    label_fmt = workbook.add_format({"border": 1, "bold": True})
    number_fmt = workbook.add_format({"border": 1, "align": "center", "num_format": "0.0"})
    percent_fmt = workbook.add_format({"border": 1, "align": "center", "num_format": "0.0%"})
    link_fmt = workbook.add_format({"font_color": "#0B6E81", "underline": True})

    worksheet.set_zoom(90)
    worksheet.set_column("A:A", 30)
    worksheet.set_column("B:D", 16)
    worksheet.set_column("E:E", 18)
    worksheet.write("A1", "Comparativa KPI: periodo actual vs anterior", title_fmt)
    worksheet.write(
        "A2",
        f"Actual: {current_meta['fechaDesde']} a {current_meta['fechaHasta']}",
        subtitle_fmt,
    )
    worksheet.write(
        "A3",
        f"Anterior: {previous_meta['fechaDesde']} a {previous_meta['fechaHasta']}",
        subtitle_fmt,
    )
    worksheet.write_url("A4", "internal:'Resumen KPI'!A1", link_fmt, "Volver al resumen general")

    current_total = len(current_items)
    previous_total = len(previous_items)
    current_first_contact = sum(1 for item in current_items if item.get("primer_contacto"))
    previous_first_contact = sum(1 for item in previous_items if item.get("primer_contacto"))
    metrics = [
        (
            "Tickets atendidos",
            float(current_total),
            float(previous_total),
            False,
            f"=COUNTA({excel_column_range('Detalle', 'A')})-1",
            f"=COUNTA({excel_column_range('Detalle anterior', 'A')})-1",
        ),
        (
            "Primer contacto",
            percentage(current_first_contact, current_total) / 100,
            percentage(previous_first_contact, previous_total) / 100,
            True,
            (
                f'=IFERROR(COUNTIF({excel_column_range("Detalle", "N")},"Si")/'
                f'(COUNTA({excel_column_range("Detalle", "A")})-1),0)'
            ),
            (
                f'=IFERROR(COUNTIF({excel_column_range("Detalle anterior", "N")},"Si")/'
                f'(COUNTA({excel_column_range("Detalle anterior", "A")})-1),0)'
            ),
        ),
        (
            "Promedio minutos",
            average_resolution_minutes(current_items),
            average_resolution_minutes(previous_items),
            False,
            f"=IFERROR(AVERAGE({excel_column_range('Detalle', 'O')}),0)",
            f"=IFERROR(AVERAGE({excel_column_range('Detalle anterior', 'O')}),0)",
        ),
        (
            "Total minutos",
            total_resolution_minutes(current_items),
            total_resolution_minutes(previous_items),
            False,
            f"=SUM({excel_column_range('Detalle', 'O')})",
            f"=SUM({excel_column_range('Detalle anterior', 'O')})",
        ),
        (
            "KPI promedio",
            average_kpi_percentage(current_items) / 100,
            average_kpi_percentage(previous_items) / 100,
            True,
            f"=IFERROR(AVERAGE({excel_column_range('Detalle', 'R')})/100,0)",
            f"=IFERROR(AVERAGE({excel_column_range('Detalle anterior', 'R')})/100,0)",
        ),
    ]

    for column, label in enumerate(["Indicador", "Actual", "Anterior", "Variacion", "Variacion %"]):
        worksheet.write(5, column, label, header_fmt)
    for index, (label, current, previous, is_percentage, current_formula, previous_formula) in enumerate(metrics, start=6):
        value_fmt = percent_fmt if is_percentage else number_fmt
        excel_row = index + 1
        worksheet.write(index, 0, label, label_fmt)
        worksheet.write_formula(index, 1, current_formula, value_fmt, current)
        worksheet.write_formula(index, 2, previous_formula, value_fmt, previous)
        worksheet.write_formula(index, 3, f"=B{excel_row}-C{excel_row}", value_fmt, current - previous)
        if previous:
            worksheet.write_formula(
                index,
                4,
                f"=IFERROR((B{excel_row}-C{excel_row})/C{excel_row},0)",
                percent_fmt,
                (current - previous) / previous,
            )
        else:
            worksheet.write_formula(index, 4, "=0", percent_fmt, 0)

    chart_specs = [
        (
            "Tickets por usuario de soporte",
            align_series(build_series(current_items, "encargado"), build_series(previous_items, "encargado")),
            countif_formula_builder("Detalle", "I"),
            countif_formula_builder("Detalle anterior", "I"),
        ),
        (
            "Tickets por categoria KPI",
            align_series(build_series(current_items, "categoria"), build_series(previous_items, "categoria")),
            countif_formula_builder("Detalle", "Q"),
            countif_formula_builder("Detalle anterior", "Q"),
        ),
        (
            "Tickets por tipo de servicio",
            align_series(build_series(current_items, "tipo_servicio"), build_series(previous_items, "tipo_servicio")),
            countif_formula_builder("Detalle", "D"),
            countif_formula_builder("Detalle anterior", "D"),
        ),
        (
            "Tiempo de respuesta",
            align_series(build_time_series(current_items), build_time_series(previous_items)),
            time_bucket_formula_builder("Detalle"),
            time_bucket_formula_builder("Detalle anterior"),
        ),
    ]

    next_row = 12
    for title, rows, current_formula_builder, previous_formula_builder in chart_specs:
        next_row += write_comparison_chart_block(
            worksheet,
            workbook,
            title,
            next_row,
            rows,
            current_formula_builder,
            previous_formula_builder,
        )
        next_row += 1


def build_workbook(payload: dict[str, Any], output_path: Path) -> None:
    meta = payload["meta"]
    items = payload["items"]
    comparison = payload.get("comparison")
    previous_meta = comparison.get("meta", {}) if comparison else None
    previous_items = comparison.get("items", []) if comparison else []
    history = payload.get("history") or {"meta": meta, "items": items}
    history_meta = history.get("meta") or meta
    history_items = history.get("items") or []

    normalize_people(items)
    normalize_people(previous_items)
    normalize_people(history_items)

    configured_support_users = list(dict.fromkeys(
        normalize_person_name(name)
        for name in payload.get("supportUsers", [])
        if str(name).strip()
    ))
    if configured_support_users:
        support_groups: dict[str, list[dict[str, Any]]] = {
            name: [] for name in configured_support_users
        }
        for item in items:
            assignee = str(item.get("encargado") or "").strip()
            if assignee in support_groups:
                support_groups[assignee].append(item)
    else:
        fallback_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for item in items:
            assignee = str(item.get("encargado") or "").strip()
            if assignee and assignee.upper() != "SIN_ASIGNAR":
                fallback_groups[assignee].append(item)
        support_groups = dict(fallback_groups)

    requester_rows = build_requester_rows(items)
    requester_reason_labels, requester_reason_rows = build_top_requester_reason_matrix(items, requester_rows)
    used_sheet_names = {"detalle", "resumen kpi", "solicitantes", "comparativa", "detalle anterior"}
    support_sheet_names = {
        assignee: allocate_sheet_name(f"Soporte - {assignee}", used_sheet_names)
        for assignee in sorted(support_groups, key=str.casefold)
    }

    workbook = xlsxwriter.Workbook(output_path.as_posix())
    workbook.set_calc_mode("auto")
    summary_sheet = workbook.add_worksheet("Resumen KPI")
    detail_sheet = workbook.add_worksheet("Detalle")
    requester_sheet = workbook.add_worksheet("Solicitantes")
    comparison_sheet = workbook.add_worksheet("Comparativa") if previous_meta else None
    previous_detail_sheet = workbook.add_worksheet("Detalle anterior") if previous_meta else None

    title_fmt = workbook.add_format({
        "bold": True,
        "font_size": 18,
        "font_color": "#16324F",
    })
    subtitle_fmt = workbook.add_format({
        "font_size": 10,
        "font_color": "#4B5D70",
    })
    card_label_fmt = workbook.add_format({
        "bold": True,
        "font_size": 10,
        "bg_color": "#D9EAF7",
        "border": 1,
        "font_color": "#16324F",
        "align": "center",
        "valign": "vcenter",
        "text_wrap": True,
    })
    card_value_style = {
        "font_size": 16,
        "bold": True,
        "align": "center",
        "valign": "vcenter",
        "border": 1,
        "bg_color": "#F7FBFE",
        "font_color": "#0B4F6C",
    }
    card_value_fmt = workbook.add_format(card_value_style)
    card_percent_fmt = workbook.add_format({**card_value_style, "num_format": "0.0%"})
    card_average_minutes_fmt = workbook.add_format({**card_value_style, "num_format": '0.0 "min"'})
    card_total_hours_fmt = workbook.add_format({**card_value_style, "num_format": '0.0 "h"'})
    link_header_fmt = workbook.add_format({
        "bold": True,
        "bg_color": "#D9EAF7",
        "border": 1,
        "font_color": "#16324F",
    })
    link_fmt = workbook.add_format({"font_color": "#0B6E81", "underline": True, "border": 1})

    write_ticket_sheet(workbook, detail_sheet, items)
    write_requester_sheet(
        workbook,
        requester_sheet,
        requester_rows,
        requester_reason_labels,
        requester_reason_rows,
    )
    if comparison_sheet is not None and previous_detail_sheet is not None and previous_meta is not None:
        write_comparison_sheet(
            workbook,
            comparison_sheet,
            items,
            meta,
            previous_items,
            previous_meta,
        )
        write_ticket_sheet(workbook, previous_detail_sheet, previous_items)
    summary_sheet.set_zoom(90)

    summary_sheet.set_column(0, 1, 18)
    summary_sheet.set_column(3, 4, 18)
    summary_sheet.set_column(6, 7, 18)
    summary_sheet.set_column(9, 10, 18)
    summary_sheet.set_column(12, 13, 18)
    summary_sheet.set_column(14, 14, 34)

    summary_sheet.write("A1", "Reporte KPI de tickets", title_fmt)
    summary_sheet.write("A2", f"Rango: {meta['fechaDesde']} a {meta['fechaHasta']}", subtitle_fmt)
    summary_sheet.write("A3", "Corrige la hoja Detalle y Excel recalculará las tablas y gráficos", subtitle_fmt)

    total_items = len(items)
    resolved_items = sum(1 for item in items if item.get("estado") == "RESUELTO")
    avg_minutes = average_resolution_minutes(items)
    total_minutes = total_resolution_minutes(items)
    fulfillment = percentage(resolved_items, total_items)

    cards = [
        (
            "Total de tickets solicitados",
            f"=COUNTA({excel_column_range('Detalle', 'A')})-1",
            total_items,
            card_value_fmt,
        ),
        (
            "Tickets resueltos",
            f'=COUNTIF({excel_column_range("Detalle", "S")},"RESUELTO")',
            resolved_items,
            card_value_fmt,
        ),
        (
            "Cumplimiento de tickets",
            (
                f'=IFERROR(COUNTIF({excel_column_range("Detalle", "S")},"RESUELTO")/'
                f'(COUNTA({excel_column_range("Detalle", "A")})-1),0)'
            ),
            fulfillment / 100,
            card_percent_fmt,
        ),
        (
            "Promedio de atención (minutos)",
            f"=IFERROR(AVERAGE({excel_column_range('Detalle', 'O')}),0)",
            avg_minutes,
            card_average_minutes_fmt,
        ),
        (
            "Tiempo total de atención (horas)",
            f"=SUM({excel_column_range('Detalle', 'O')})/60",
            total_minutes / 60,
            card_total_hours_fmt,
        ),
    ]

    for index, (label, formula, cached_value, value_format) in enumerate(cards):
        col = index * 3
        summary_sheet.merge_range(4, col, 4, col + 1, label, card_label_fmt)
        summary_sheet.merge_range(5, col, 7, col + 1, "", value_format)
        summary_sheet.write_formula(5, col, formula, value_format, cached_value)

    service_rows = build_series(items, "tipo_servicio")
    reason_rows = build_series(items, "motivo_servicio")
    channel_rows = build_series(items, "canal_oficina")
    time_rows = build_time_series(items)
    support_rows = sorted(
        (
            (assignee, len(group_items), total_resolution_minutes(group_items) / 60)
            for assignee, group_items in support_groups.items()
        ),
        key=lambda entry: (-entry[1], entry[0].casefold()),
    )
    requester_chart_rows = [(row["name"], row["total"]) for row in requester_rows[:10]]
    history_rows = build_monthly_history(history_items, history_meta["fechaHasta"])

    next_row = 10
    next_row += write_history_chart(summary_sheet, workbook, next_row, history_rows)
    next_row += 1
    next_row += write_chart_block(
        summary_sheet,
        workbook,
        "Tickets por tipo de servicio",
        next_row,
        0,
        service_rows,
        "#1F77B4",
        formula_builder=countif_formula_builder("Detalle", "D"),
    )
    next_row += 1
    next_row += write_chart_block(
        summary_sheet,
        workbook,
        "Tickets por motivo de servicio",
        next_row,
        0,
        reason_rows,
        "#FF7F0E",
        formula_builder=countif_formula_builder("Detalle", "G"),
    )
    next_row += 1
    next_row += write_chart_block(
        summary_sheet,
        workbook,
        "Tickets por canal de atencion",
        next_row,
        0,
        channel_rows,
        "#2CA02C",
        formula_builder=countif_formula_builder("Detalle", "E"),
    )
    next_row += 1
    next_row += write_chart_block(
        summary_sheet,
        workbook,
        "Tiempo de respuesta",
        next_row,
        0,
        time_rows,
        "#9467BD",
        formula_builder=time_bucket_formula_builder("Detalle"),
    )
    next_row += 1
    next_row += write_support_workload_block(
        summary_sheet,
        workbook,
        "Tickets por usuario de soporte",
        next_row,
        support_rows,
        "#0B6E81",
        formula_source_sheet="Detalle",
    )
    next_row += 1
    next_row += write_chart_block(
        summary_sheet,
        workbook,
        "Personas que mas tickets solicitan",
        next_row,
        0,
        requester_chart_rows,
        "#D08C32",
        formula_builder=countif_formula_builder("Detalle", "C"),
    )
    next_row += 1
    next_row += write_requester_reason_table(
        workbook,
        summary_sheet,
        next_row,
        requester_reason_labels,
        requester_reason_rows,
        formula_source_sheet="Detalle",
    )
    next_row += 1
    unresolved_section_row = next_row
    write_unresolved_ticket_section(workbook, summary_sheet, items, unresolved_section_row)

    summary_sheet.write(0, 14, "Navegacion del reporte", link_header_fmt)
    summary_sheet.write_url(1, 14, "internal:'Solicitantes'!A1", link_fmt, "Ranking de solicitantes")
    summary_sheet.write_url(
        4,
        14,
        f"internal:'Resumen KPI'!A{unresolved_section_row + 1}",
        link_fmt,
        "Tickets pendientes de resolución",
    )
    if previous_meta:
        summary_sheet.write_url(2, 14, "internal:'Comparativa'!A1", link_fmt, "Actual vs periodo anterior")
        summary_sheet.write_url(3, 14, "internal:'Detalle anterior'!A1", link_fmt, "Detalle del periodo anterior")
    summary_sheet.write(5, 14, "Hojas por usuario de soporte", link_header_fmt)

    for index, (assignee, sheet_name) in enumerate(support_sheet_names.items(), start=6):
        escaped_sheet_name = sheet_name.replace("'", "''")
        summary_sheet.write_url(index, 14, f"internal:'{escaped_sheet_name}'!A1", link_fmt, assignee)

    for assignee, sheet_name in support_sheet_names.items():
        support_sheet = workbook.add_worksheet(sheet_name)
        write_support_kpi_sheet(
            workbook,
            support_sheet,
            assignee,
            support_groups[assignee],
            meta,
        )

    workbook.close()


def main() -> int:
    if len(sys.argv) != 3:
        print("Uso: export_kpi_report.py <input.json> <output.xlsx>", file=sys.stderr)
        return 1

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    payload = json.loads(input_path.read_text(encoding="utf-8"))
    build_workbook(payload, output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
