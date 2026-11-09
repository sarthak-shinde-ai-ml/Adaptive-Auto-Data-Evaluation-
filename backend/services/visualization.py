"""Visualization service.
Generates Plotly chart specifications and auto-commentary for various chart types.
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional

from .profiling import _load_file


SUPPORTED_CHARTS = ["bar", "line", "scatter", "pie", "heatmap", "boxplot", "violin"]


def _validate_chart_config(chart_type: str, x: Optional[str], y: Optional[str], df: pd.DataFrame) -> None:
    """Validate that the requested chart type and columns are compatible."""
    if chart_type not in SUPPORTED_CHARTS:
        raise ValueError(f"Unsupported chart type '{chart_type}'. Supported: {SUPPORTED_CHARTS}")
    cols = df.columns.tolist()
    if x and x not in cols:
        raise ValueError(f"Column '{x}' not found in dataset. Available: {cols}")
    if y and y not in cols:
        raise ValueError(f"Column '{y}' not found in dataset. Available: {cols}")
    if chart_type == "pie":
        if not x or not y:
            raise ValueError("Pie chart requires both a categorical column (x) and a numeric column (y).")
        if not pd.api.types.is_numeric_dtype(df[y]):
            raise ValueError(f"Pie chart y-axis column '{y}' must be numeric.")


def _generate_commentary(chart_type: str, df: pd.DataFrame, x: str, y: Optional[str]) -> str:
    """Generate auto-descriptive commentary for a chart."""
    lines: List[str] = []
    lines.append(f"This {chart_type} chart visualizes '{x}'" + (f" against '{y}'" if y else "") + ".")

    if y and pd.api.types.is_numeric_dtype(df[y]):
        series = df[y].dropna()
        if not series.empty:
            lines.append(f"'{y}' ranges from {series.min():.2f} to {series.max():.2f} "
                         f"(mean: {series.mean():.2f}, std: {series.std():.2f}).")
            # Identify outliers
            q1, q3 = series.quantile(0.25), series.quantile(0.75)
            iqr = q3 - q1
            outlier_count = ((series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)).sum()
            if outlier_count > 0:
                lines.append(f"There are {outlier_count} potential outlier(s) detected using the IQR method.")

    if x and pd.api.types.is_numeric_dtype(df[x]):
        series = df[x].dropna()
        skew = series.skew()
        if abs(skew) > 1:
            direction = "positively" if skew > 0 else "negatively"
            lines.append(f"'{x}' is {direction} skewed (skewness: {skew:.2f}).")
    elif x and not pd.api.types.is_numeric_dtype(df[x]):
        n_unique = df[x].nunique()
        lines.append(f"'{x}' has {n_unique} unique categor{'y' if n_unique == 1 else 'ies'}.")

    return " ".join(lines)


def generate_chart_spec(
    file_path: str,
    chart_type: str,
    x: str,
    y: Optional[str] = None,
    color: Optional[str] = None,
    title: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate a Plotly-compatible chart specification and commentary.

    Returns
    -------
    dict with keys: chart_type, plotly_spec, commentary
    """
    df = _load_file(file_path)
    _validate_chart_config(chart_type, x, y, df)

    # Build a simplified Plotly spec (the frontend uses Plotly.js to render)
    spec: Dict[str, Any] = {"data": [], "layout": {"title": title or f"{chart_type.title()} Chart"}}

    if chart_type == "bar":
        if y:
            grouped = df.groupby(x)[y].mean().reset_index()
            spec["data"].append({"type": "bar", "x": grouped[x].tolist(), "y": grouped[y].tolist(), "name": y})
        else:
            counts = df[x].value_counts()
            spec["data"].append({"type": "bar", "x": counts.index.tolist(), "y": counts.values.tolist(), "name": x})
        spec["layout"]["xaxis"] = {"title": x}
        spec["layout"]["yaxis"] = {"title": y or "Count"}

    elif chart_type == "line":
        spec["data"].append({"type": "scatter", "mode": "lines+markers",
                             "x": df[x].tolist(), "y": df[y].tolist() if y else list(range(len(df))), "name": y or x})
        spec["layout"]["xaxis"] = {"title": x}
        spec["layout"]["yaxis"] = {"title": y or "Index"}

    elif chart_type == "scatter":
        trace: Dict[str, Any] = {"type": "scatter", "mode": "markers",
                                  "x": df[x].tolist(), "y": df[y].tolist() if y else list(range(len(df))), "name": y or x}
        if color and color in df.columns:
            trace["marker"] = {"color": df[color].tolist()}
        spec["data"].append(trace)
        spec["layout"]["xaxis"] = {"title": x}
        spec["layout"]["yaxis"] = {"title": y or "Index"}

    elif chart_type == "pie":
        grouped = df.groupby(x)[y].sum().reset_index()
        spec["data"].append({"type": "pie", "labels": grouped[x].tolist(), "values": grouped[y].tolist()})

    elif chart_type == "heatmap":
        numeric = df.select_dtypes(include=[np.number])
        corr = numeric.corr()
        spec["data"].append({
            "type": "heatmap",
            "z": corr.values.tolist(),
            "x": corr.columns.tolist(),
            "y": corr.index.tolist(),
            "colorscale": "Viridis",
        })

    elif chart_type == "boxplot":
        spec["data"].append({"type": "box", "y": df[y].dropna().tolist() if y else df[x].dropna().tolist(), "name": y or x})
        if color and color in df.columns:
            # One box per category
            spec["data"] = []
            for cat in df[color].unique():
                subset = df[df[color] == cat]
                col = y if y else x
                spec["data"].append({"type": "box", "y": subset[col].dropna().tolist(), "name": str(cat)})

    elif chart_type == "violin":
        spec["data"].append({"type": "violin", "y": df[y].dropna().tolist() if y else df[x].dropna().tolist(), "name": y or x})

    commentary = _generate_commentary(chart_type, df, x, y)

    return {
        "chart_type": chart_type,
        "plotly_spec": spec,
        "commentary": commentary,
    }

