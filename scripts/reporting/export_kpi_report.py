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
from typing import Any

import xlsxwriter


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


def write_requester_sheet(
    workbook: xlsxwriter.Workbook,
    worksheet: xlsxwriter.worksheet.Worksheet,
    rows: list[dict[str, Any]],
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
    worksheet.write("A2", "Ranking de demanda según el rango seleccionado", subtitle_fmt)
    worksheet.set_column("A:A", 10)
    worksheet.set_column("B:B", 34)
    worksheet.set_column("C:E", 14)
    worksheet.freeze_panes(4, 0)

    headers = ["Posicion", "Solicitante", "Total", "Resueltos", "Abiertos"]
    for column, label in enumerate(headers):
        worksheet.write(3, column, label, header_fmt)

    for index, item in enumerate(rows, start=1):
        row = index + 3
        worksheet.write_number(row, 0, index, number_fmt)
        worksheet.write(row, 1, item["name"], text_fmt)
        worksheet.write_number(row, 2, item["total"], number_fmt)
        worksheet.write_number(row, 3, item["resueltos"], number_fmt)
        worksheet.write_number(row, 4, item["abiertos"], number_fmt)

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


def write_chart_block(
    worksheet: xlsxwriter.worksheet.Worksheet,
    workbook: xlsxwriter.Workbook,
    title: str,
    start_row: int,
    start_col: int,
    rows: list[tuple[str, int]],
    color: str,
    sheet_name: str | None = None,
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
        worksheet.write(header_row + index, start_col, label, label_fmt)
        worksheet.write_number(header_row + index, start_col + 1, total, value_fmt)

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
        chart = workbook.add_chart({"type": "line"})
        for name, column, color in [
            ("Tickets solicitados", 1, "#1F77B4"),
            ("Tickets resueltos", 2, "#0B6E81"),
        ]:
            chart.add_series({
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
        chart.set_title({"name": title})
        chart.set_legend({"position": "bottom"})
        chart.set_chartarea({"border": {"none": True}})
        chart.set_plotarea({"border": {"none": True}})
        chart.set_x_axis({"name": "Mes"})
        chart.set_y_axis({"name": "Cantidad de tickets", "min": 0, "major_gridlines": {"visible": True}})
        chart.set_size({"width": 700, "height": 320})
        chart.set_style(10)
        worksheet.insert_chart(start_row, 4, chart, {"x_offset": 10, "y_offset": 4})

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
    first_contact_items = sum(1 for item in items if item.get("primer_contacto"))
    avg_minutes = average_resolution_minutes(items)
    avg_percentage_values = [
        float(item["porcentaje"])
        for item in items
        if item.get("porcentaje") is not None
    ]
    avg_percentage = sum(avg_percentage_values) / len(avg_percentage_values) if avg_percentage_values else 0

    cards = [
        ("Tickets atendidos", total_items),
        ("Primer contacto", first_contact_items),
        ("Promedio minutos", int(math.floor(avg_minutes)) if avg_minutes else 0),
        ("KPI promedio", f"{avg_percentage:.1f}%" if avg_percentage_values else "--"),
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
        worksheet.write(row, 0, label, label_fmt)
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
        ("Tickets atendidos", float(current_total), float(previous_total), False),
        (
            "Primer contacto",
            percentage(current_first_contact, current_total) / 100,
            percentage(previous_first_contact, previous_total) / 100,
            True,
        ),
        ("Promedio minutos", average_resolution_minutes(current_items), average_resolution_minutes(previous_items), False),
        ("KPI promedio", average_kpi_percentage(current_items) / 100, average_kpi_percentage(previous_items) / 100, True),
    ]

    for column, label in enumerate(["Indicador", "Actual", "Anterior", "Variacion", "Variacion %"]):
        worksheet.write(5, column, label, header_fmt)
    for index, (label, current, previous, is_percentage) in enumerate(metrics, start=6):
        value_fmt = percent_fmt if is_percentage else number_fmt
        worksheet.write(index, 0, label, label_fmt)
        worksheet.write_number(index, 1, current, value_fmt)
        worksheet.write_number(index, 2, previous, value_fmt)
        worksheet.write_number(index, 3, current - previous, value_fmt)
        if previous:
            worksheet.write_number(index, 4, (current - previous) / previous, percent_fmt)
        else:
            worksheet.write(index, 4, "--", number_fmt)

    chart_specs = [
        (
            "Tickets por usuario de soporte",
            align_series(build_series(current_items, "encargado"), build_series(previous_items, "encargado")),
        ),
        (
            "Tickets por categoria KPI",
            align_series(build_series(current_items, "categoria"), build_series(previous_items, "categoria")),
        ),
        (
            "Tickets por tipo de servicio",
            align_series(build_series(current_items, "tipo_servicio"), build_series(previous_items, "tipo_servicio")),
        ),
        (
            "Tiempo de respuesta",
            align_series(build_time_series(current_items), build_time_series(previous_items)),
        ),
    ]

    next_row = 12
    for title, rows in chart_specs:
        next_row += write_comparison_chart_block(worksheet, workbook, title, next_row, rows)
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
    used_sheet_names = {"detalle", "resumen kpi", "solicitantes", "comparativa", "detalle anterior"}
    support_sheet_names = {
        assignee: allocate_sheet_name(f"Soporte - {assignee}", used_sheet_names)
        for assignee in sorted(support_groups, key=str.casefold)
    }

    workbook = xlsxwriter.Workbook(output_path.as_posix())
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
    card_value_fmt = workbook.add_format({
        "font_size": 16,
        "bold": True,
        "align": "center",
        "valign": "vcenter",
        "border": 1,
        "bg_color": "#F7FBFE",
        "font_color": "#0B4F6C",
    })
    link_header_fmt = workbook.add_format({
        "bold": True,
        "bg_color": "#D9EAF7",
        "border": 1,
        "font_color": "#16324F",
    })
    link_fmt = workbook.add_format({"font_color": "#0B6E81", "underline": True, "border": 1})

    write_ticket_sheet(workbook, detail_sheet, items)
    write_requester_sheet(workbook, requester_sheet, requester_rows)
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
    summary_sheet.set_column(14, 14, 34)

    summary_sheet.write("A1", "Reporte KPI de tickets", title_fmt)
    summary_sheet.write("A2", f"Rango: {meta['fechaDesde']} a {meta['fechaHasta']}", subtitle_fmt)
    summary_sheet.write("A3", "Resumen ejecutivo para seguimiento gerencial", subtitle_fmt)

    total_items = len(items)
    resolved_items = sum(1 for item in items if item.get("estado") == "RESUELTO")
    avg_minutes = average_resolution_minutes(items)
    fulfillment = percentage(resolved_items, total_items)
    avg_hours = avg_minutes / 60

    cards = [
        ("Total de tickets solicitados", total_items),
        ("Tickets resueltos", resolved_items),
        ("Cumplimiento de tickets", f"{fulfillment:.1f}%"),
        ("Promedio de atención (horas)", f"{avg_hours:.1f} h"),
    ]

    for index, (label, value) in enumerate(cards):
        col = index * 3
        summary_sheet.merge_range(4, col, 4, col + 1, label, card_label_fmt)
        summary_sheet.merge_range(5, col, 7, col + 1, value, card_value_fmt)

    service_rows = build_series(items, "tipo_servicio")
    reason_rows = build_series(items, "motivo_servicio")
    channel_rows = build_series(items, "canal_oficina")
    time_rows = build_time_series(items)
    support_rows = sorted(
        ((assignee, len(group_items)) for assignee, group_items in support_groups.items()),
        key=lambda entry: (-entry[1], entry[0].casefold()),
    )
    requester_chart_rows = [(row["name"], row["total"]) for row in requester_rows[:10]]
    history_rows = build_monthly_history(history_items, history_meta["fechaHasta"])

    next_row = 10
    next_row += write_history_chart(summary_sheet, workbook, next_row, history_rows)
    next_row += 1
    next_row += write_chart_block(summary_sheet, workbook, "Tickets por tipo de servicio", next_row, 0, service_rows, "#1F77B4")
    next_row += 1
    next_row += write_chart_block(summary_sheet, workbook, "Tickets por motivo de servicio", next_row, 0, reason_rows, "#FF7F0E")
    next_row += 1
    next_row += write_chart_block(summary_sheet, workbook, "Tickets por canal de atencion", next_row, 0, channel_rows, "#2CA02C")
    next_row += 1
    next_row += write_chart_block(summary_sheet, workbook, "Tiempo de respuesta", next_row, 0, time_rows, "#9467BD")
    next_row += 1
    next_row += write_chart_block(summary_sheet, workbook, "Tickets por usuario de soporte", next_row, 0, support_rows, "#0B6E81")
    next_row += 1
    write_chart_block(summary_sheet, workbook, "Personas que mas tickets solicitan", next_row, 0, requester_chart_rows, "#D08C32")

    summary_sheet.write(0, 14, "Navegacion del reporte", link_header_fmt)
    summary_sheet.write_url(1, 14, "internal:'Solicitantes'!A1", link_fmt, "Ranking de solicitantes")
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
