"""Dataset router – upload, profiling, filtering, comparison, charts, ML, code export."""
import os
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException, Body
from pydantic import BaseModel
from typing import Dict, Any, List, Optional

router = APIRouter()

# Module-level dict to track uploaded file paths by dataset_id.
# In production, replace with a database or object store.
_file_store: Dict[str, str] = {}

UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "aades_uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _get_file_path(dataset_id: str) -> str:
    """Look up the file path for a dataset_id, or raise 404."""
    path = _file_store.get(dataset_id)
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found. Upload a file first.")
    return path


# ---------- Upload + Auto-Profile ----------

@router.post("", summary="Upload dataset and trigger profiling")
@router.post("/", summary="Upload dataset and trigger profiling")
def upload_dataset(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    # Persist file to temp directory
    save_path = os.path.join(UPLOAD_DIR, file.filename)
    contents = file.file.read()
    with open(save_path, "wb") as f:
        f.write(contents)

    dataset_id = os.path.splitext(file.filename)[0]
    _file_store[dataset_id] = save_path

    # Run profiling immediately
    from ..services.profiling import profile_dataset
    try:
        profile = profile_dataset(save_path)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Profiling failed: {exc}")

    return {
        "dataset_id": dataset_id,
        "filename": file.filename,
        "profile": profile,
    }


# ---------- Profile ----------

@router.get("/{dataset_id}/profile", summary="Get executive summary profile for dataset")
async def get_profile(dataset_id: str):
    file_path = _get_file_path(dataset_id)
    from ..services.profiling import profile_dataset
    try:
        profile = profile_dataset(file_path)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Profiling failed: {exc}")
    return {"dataset_id": dataset_id, "profile": profile}


# ---------- Global Filters ----------

class FilterRequest(BaseModel):
    filters: Dict[str, Any] = {}

@router.post("/{dataset_id}/filter", summary="Apply global filters and return filtered view ID")
async def apply_filters(dataset_id: str, req: FilterRequest):
    _get_file_path(dataset_id)  # validate existence
    # Placeholder: in production, apply filters and store the filtered view
    return {"dataset_id": dataset_id, "filtered_view_id": f"filter-{dataset_id}", "applied_filters": req.filters}


# ---------- Comparative Analysis ----------

class CompareRequest(BaseModel):
    group_by: str
    metrics: List[str]

@router.post("/{dataset_id}/compare", summary="Run comparative analysis")
async def compare(dataset_id: str, req: CompareRequest):
    file_path = _get_file_path(dataset_id)
    from ..services.comparative import comparative_analysis as run_compare
    try:
        result = run_compare(file_path, req.group_by, req.metrics)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"analysis_id": f"compare-{dataset_id}", "result": result}


# ---------- Chart Generation ----------

class ChartRequest(BaseModel):
    chart_type: str
    x: str
    y: Optional[str] = None
    color: Optional[str] = None
    title: Optional[str] = None

@router.post("/{dataset_id}/charts", summary="Generate chart spec and commentary")
async def generate_chart(dataset_id: str, req: ChartRequest):
    file_path = _get_file_path(dataset_id)
    from ..services.visualization import generate_chart_spec
    try:
        result = generate_chart_spec(
            file_path=file_path,
            chart_type=req.chart_type,
            x=req.x,
            y=req.y,
            color=req.color,
            title=req.title,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"chart_id": f"chart-{dataset_id}", **result}


# ---------- ML ----------

class MLRequest(BaseModel):
    task: str  # "kmeans" or "regression"
    columns: List[str]
    target: Optional[str] = None
    k: int = 3
    test_size: float = 0.2

@router.post("/{dataset_id}/ml", summary="Run ML task (K-Means or Linear Regression)")
async def run_ml(dataset_id: str, req: MLRequest):
    file_path = _get_file_path(dataset_id)
    try:
        if req.task == "kmeans":
            from ..services.ml import run_kmeans
            result = run_kmeans(file_path, req.columns, k=req.k)
        elif req.task == "regression":
            if not req.target:
                raise HTTPException(status_code=400, detail="Linear regression requires a 'target' column.")
            from ..services.ml import run_linear_regression
            result = run_linear_regression(file_path, req.columns, req.target, test_size=req.test_size)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown ML task '{req.task}'. Use 'kmeans' or 'regression'.")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"ml_task_id": f"ml-{dataset_id}", "result": result}


# ---------- Code Export ----------

@router.get("/{dataset_id}/code", summary="Retrieve generated Pandas/SQL code for an analysis")
async def get_code(dataset_id: str):
    _get_file_path(dataset_id)  # validate existence
    # Placeholder: in production, generate Pandas/SQL code from the last analysis
    return {"dataset_id": dataset_id, "code": "# Code generation coming soon – placeholder."}
