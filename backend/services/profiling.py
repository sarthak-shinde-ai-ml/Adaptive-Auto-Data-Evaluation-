"""Profiling service for uploaded datasets.
Provides a lightweight function that reads a CSV/Excel/JSON file with pandas and returns:
- row/column count
- missing value percentages per column
- basic descriptive statistics (mean, std, min, max) for numeric columns
- outlier detection (IQR method) and skewness
"""
import pandas as pd
import numpy as np
from typing import Dict, Any

def _load_file(file_path: str) -> pd.DataFrame:
    """Load a CSV, Excel or JSON file into a DataFrame.
    The function infers the file type from the extension.
    """
    if file_path.lower().endswith('.csv'):
        df = pd.read_csv(file_path)
    elif file_path.lower().endswith(('.xls', '.xlsx')):
        df = pd.read_excel(file_path)
    elif file_path.lower().endswith('.json'):
        df = pd.read_json(file_path)
    else:
        raise ValueError('Unsupported file type')
    return df

def _missing_stats(df: pd.DataFrame) -> Dict[str, float]:
    """Return missing-value percentage per column."""
    total = len(df)
    if total == 0:
        return {}
    return {
        str(col): round(float(df[col].isna().sum() / total * 100), 2)
        for col in df.columns
    }

def _numeric_stats(df: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
    """Basic stats for numeric columns."""
    numeric = df.select_dtypes(include=[np.number])
    stats = {}
    for col in numeric.columns:
        series = numeric[col].dropna()
        if series.empty:
            continue
        stats[str(col)] = {
            "mean": round(float(series.mean()), 3),
            "std": round(float(series.std()), 3) if len(series) > 1 else 0.0,
            "min": round(float(series.min()), 3),
            "max": round(float(series.max()), 3),
        }
    return stats

def _outlier_flags(df: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
    """Detect outliers using the IQR method for numeric columns.
    Returns a dict mapping column -> {"outlier_count": int, "severity": str}
    """
    flags = {}
    numeric = df.select_dtypes(include=[np.number])
    for col in numeric.columns:
        series = numeric[col].dropna()
        if len(series) < 4:
            continue
        q1 = float(series.quantile(0.25))
        q3 = float(series.quantile(0.75))
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        outliers = series[(series < lower) | (series > upper)]
        count = int(outliers.shape[0])
        if count == 0:
            continue
        severity = "high" if count / len(series) > 0.1 else "medium" if count / len(series) > 0.05 else "low"
        flags[str(col)] = {
            "outlier_count": count,
            "severity": severity,
        }
    return flags

def profile_dataset(file_path: str) -> Dict[str, Any]:
    """Execute the full profiling pipeline.
    Returns a dictionary ready to be JSON-serialised.
    """
    df = _load_file(file_path)
    rows, cols = int(df.shape[0]), int(df.shape[1])
    missing = _missing_stats(df)
    numeric_stats = _numeric_stats(df)
    outliers = _outlier_flags(df)
    # Simple data-quality score: 100 - (missing % avg + outlier severity weight)
    missing_avg = float(np.mean(list(missing.values()))) if missing else 0.0
    outlier_sev_weight = 0.0
    sev_map = {"low": 5, "medium": 10, "high": 20}
    for v in outliers.values():
        outlier_sev_weight += sev_map.get(v["severity"], 0)
    quality_score = max(0.0, 100.0 - missing_avg - outlier_sev_weight)
    return {
        "row_count": rows,
        "column_count": cols,
        "missing_percentage": missing,
        "numeric_statistics": numeric_stats,
        "outlier_flags": outliers,
        "data_quality_score": round(float(quality_score), 2),
    }
