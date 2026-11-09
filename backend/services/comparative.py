"""Comparative analysis service.
Provides a function that loads a dataset and, given a grouping column and a list of metric columns,
computes:
- group-wise means
- differences between the first two groups (absolute and percentage)
- correlation matrix for the selected metric columns
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, List

from .profiling import _load_file

def comparative_analysis(file_path: str, group_by: str, metrics: List[str]) -> Dict[str, Any]:
    df = _load_file(file_path)
    # Ensure columns exist
    missing = [col for col in [group_by] + metrics if col not in df.columns]
    if missing:
        raise ValueError(f"Columns not found in dataset: {missing}")

    # Group by and calculate mean for each metric
    grouped = df.groupby(group_by)[metrics].mean().reset_index()
    # Convert numpy records to pure python types
    grouped_records = []
    for row in grouped.to_dict(orient="records"):
        cleaned_row = {}
        for k, v in row.items():
            cleaned_row[k] = float(v) if isinstance(v, (np.floating, float)) else (int(v) if isinstance(v, (np.integer, int)) else str(v))
        grouped_records.append(cleaned_row)

    result: Dict[str, Any] = {
        "grouped_means": grouped_records,
    }

    # If at least two groups, compute diffs between first two
    if len(grouped) >= 2:
        first = grouped.iloc[0][metrics]
        second = grouped.iloc[1][metrics]
        diff_abs = (second - first).to_dict()
        diff_pct = ((second - first) / first.replace({0: np.nan})).replace({np.nan: None}).to_dict()
        result["diff_absolute"] = {str(k): round(float(v), 3) if v is not None else None for k, v in diff_abs.items()}
        result["diff_percentage"] = {str(k): round(float(v * 100), 2) if v is not None and not pd.isna(v) else None for k, v in diff_pct.items()}

    # Correlation matrix for the metric columns (pairwise Pearson)
    corr = df[metrics].corr(method="pearson")
    corr_dict = {}
    for col1 in metrics:
        corr_dict[col1] = {}
        for col2 in metrics:
            val = corr.loc[col1, col2]
            corr_dict[col1][col2] = None if pd.isna(val) else round(float(val), 3)

    result["correlation_matrix"] = corr_dict
    return result
