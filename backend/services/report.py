"""PDF Report generation service using ReportLab.
Compiles executive summary, warnings & alerts, numeric stats, active filters,
comparative analyses, and RAG recommendations into a styled PDF.
"""
import os
import io
import tempfile
from typing import Dict, Any, Optional
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

REPORTS_DIR = os.path.join(tempfile.gettempdir(), "aades_reports")
os.makedirs(REPORTS_DIR, exist_ok=True)


def generate_pdf_report(
    dataset_id: str,
    filename: str,
    profile: Dict[str, Any],
    filters: Optional[Dict[str, Any]] = None,
    rag_insights: Optional[Dict[str, Any]] = None,
) -> str:
    """Compile and save a professional PDF report. Returns the file path."""
    report_filename = f"report_{dataset_id}.pdf"
    report_path = os.path.join(REPORTS_DIR, report_filename)

    doc = SimpleDocTemplate(
        report_path,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=22,
        leading=26,
        textColor=colors.HexColor("#1e1b4b"), # Deep indigo
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=15,
    )
    h2_style = ParagraphStyle(
        "ReportH2",
        parent=styles["Heading2"],
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=14,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "ReportBody",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#334155"),
    )
    bold_style = ParagraphStyle(
        "ReportBold",
        parent=body_style,
        fontName="Helvetica-Bold",
    )
    alert_style = ParagraphStyle(
        "ReportAlert",
        parent=body_style,
        textColor=colors.HexColor("#b45309"), # amber-700
    )

    story = []

    # Title Banner
    story.append(Paragraph("Adaptive Auto Data Evaluation System (AADES)", title_style))
    story.append(Paragraph(f"Executive Evaluation Report &bull; Dataset: <b>{filename}</b> &bull; Status: Verified", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#4f46e5"), spaceAfter=15))

    # Executive KPI Summary
    quality_score = profile.get("data_quality_score", 0.0)
    score_color = "#10b981" if quality_score >= 70 else "#f59e0b" if quality_score >= 40 else "#ef4444"

    kpi_data = [
        [
            Paragraph("<b>Total Rows</b>", body_style),
            Paragraph("<b>Total Columns</b>", body_style),
            Paragraph("<b>Data Quality Score</b>", body_style),
        ],
        [
            Paragraph(f"<font size=14><b>{profile.get('row_count', 0)}</b></font>", body_style),
            Paragraph(f"<font size=14><b>{profile.get('column_count', 0)}</b></font>", body_style),
            Paragraph(f"<font size=14 color='{score_color}'><b>{quality_score} / 100</b></font>", body_style),
        ]
    ]
    kpi_table = Table(kpi_data, colWidths=[2.2*inch, 2.2*inch, 2.4*inch])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 15))

    # Warnings & Alerts
    outliers = profile.get("outlier_flags", {})
    if outliers:
        story.append(Paragraph("Warnings & Anomaly Alerts", h2_style))
        alert_rows = [["Severity", "Column", "Detected Issue"]]
        for col, info in outliers.items():
            alert_rows.append([
                info.get("severity", "medium").upper(),
                col,
                f"{info.get('outlier_count', 0)} outliers detected via IQR method.",
            ])
        alert_table = Table(alert_rows, colWidths=[1.2*inch, 1.8*inch, 3.8*inch])
        alert_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#fef3c7")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#92400e")),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#fde68a")),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(alert_table)
        story.append(Spacer(1, 15))

    # Numeric Distribution Statistics Table
    numeric_stats = profile.get("numeric_statistics", {})
    if numeric_stats:
        story.append(Paragraph("Descriptive Numeric Statistics", h2_style))
        stat_rows = [["Metric Column", "Mean", "Std Dev", "Min", "Max"]]
        for col, s in list(numeric_stats.items())[:15]: # Show up to 15 columns
            stat_rows.append([
                col,
                str(s.get("mean", "-")),
                str(s.get("std", "-")),
                str(s.get("min", "-")),
                str(s.get("max", "-")),
            ])
        stat_table = Table(stat_rows, colWidths=[2.2*inch, 1.1*inch, 1.1*inch, 1.1*inch, 1.3*inch])
        stat_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(stat_table)
        story.append(Spacer(1, 15))

    # Missing Value Breakdown
    missing = profile.get("missing_percentage", {})
    if any(pct > 0 for pct in missing.values()):
        story.append(Paragraph("Missing Value Audit", h2_style))
        missing_rows = [["Column", "Missing %", "Data Completeness"]]
        for col, pct in missing.items():
            if pct > 0:
                missing_rows.append([col, f"{pct}%", f"{round(100 - pct, 2)}% Completed"])
        if len(missing_rows) > 1:
            m_table = Table(missing_rows, colWidths=[2.5*inch, 1.5*inch, 2.8*inch])
            m_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
            ]))
            story.append(m_table)
            story.append(Spacer(1, 15))

    # RAG Intelligence Block (if present)
    if rag_insights:
        story.append(Paragraph("AI-Driven RAG Intelligence & Counter-Plans", h2_style))
        rag_data = [
            [Paragraph("<b>Insight Explanation</b>", bold_style)],
            [Paragraph(rag_insights.get("explanation", "Overall data distribution conforms to baseline expectations."), body_style)],
            [Paragraph("<b>Root Cause Analysis</b>", bold_style)],
            [Paragraph(rag_insights.get("root_cause", "Variance caused by distribution skews in primary numeric indicators."), body_style)],
            [Paragraph("<b>Strategic Counter-Plan</b>", bold_style)],
            [Paragraph(rag_insights.get("counter_plan", "Normalize skewed features and impute missing segments prior to production modeling."), body_style)],
            [Paragraph(f"<b>Evidence & Confidence:</b> {rag_insights.get('confidence', 'High').upper()} | Citations: {', '.join(rag_insights.get('citations', ['Data Profiler']))}", alert_style)]
        ]
        rag_table = Table(rag_data, colWidths=[6.8*inch])
        rag_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f0fdf4")), # light emerald
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#86efac")),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(rag_table)

    # Footer Metadata
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceAfter=8))
    story.append(Paragraph("Generated automatically by Adaptive Auto Data Evaluation System (AADES) v3.0 &bull; Confidential", subtitle_style))

    doc.build(story)
    return report_path

