"""PDF Report generation and download router."""
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any

from .datasets import get_dataset_context
from ..services.report import generate_pdf_report

router = APIRouter()


class ReportRequest(BaseModel):
    dataset_id: str
    include_filters: bool = True
    include_charts: bool = True
    include_rag_insights: bool = True


@router.post("", summary="Generate PDF report for a dataset")
@router.post("/", summary="Generate PDF report for a dataset")
async def generate_report(req: ReportRequest):
    try:
        ctx = get_dataset_context(req.dataset_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Dataset not found: {exc}")

    filename = os.path.basename(ctx["file_path"])
    profile = ctx["profile"]

    # Generate the actual PDF report
    try:
        pdf_path = generate_pdf_report(
            dataset_id=req.dataset_id,
            filename=filename,
            profile=profile,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}")

    return {
        "status": "ready",
        "message": "PDF report compiled successfully.",
        "report_id": f"report-{req.dataset_id}",
        "download_url": f"/api/reports/{req.dataset_id}/download",
    }


@router.get("/{dataset_id}/download", summary="Download compiled PDF report")
async def download_report(dataset_id: str):
    try:
        ctx = get_dataset_context(dataset_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Dataset not found: {exc}")

    filename = os.path.basename(ctx["file_path"])
    profile = ctx["profile"]

    pdf_path = generate_pdf_report(
        dataset_id=dataset_id,
        filename=filename,
        profile=profile,
    )

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="Generated report file not found.")

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"AADES_Evaluation_Report_{dataset_id}.pdf",
    )
