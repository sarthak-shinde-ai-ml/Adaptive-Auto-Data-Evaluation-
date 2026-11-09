"""Visualization service.
Generates Plotly chart specifications and auto-commentary for various chart types.
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Union

from .profiling import _load_file


SUPPORTED_CHARTS = ["bar", "line", "scatter", "pie", "heatmap", "boxplot", "violin"]


def _validate_chart_config(chart_type: str, x: Optional[str], y: Optional[str], df: pd.DataFrame) -> None:
    """Validate that the requested chart type and columns are compatible."""
    if chart_type not in SUPPORTED_CHARTS:
        raise ValueError(f"Unsupported chart type '{chart_type}'. Supported: {SUPPORTED_CHARTS}")
    cols = df.columns.tolist()
    if x and x not in cols:
        raise ValueError(f"Column '{x}' not found in dataset. Available: {cols[:10]}...")
    if y and y not in cols:
        raise ValueError(f"Column '{y}' not found in dataset. Available: {cols[:10]}...")
    if chart_type == "pie":
        if not x:
            raise ValueError("Pie chart requires a categorical column (X).")


def _generate_commentary(chart_type: str, df: pd.DataFrame, x: str, y: Optional[str]) -> str:
    """Generate auto-descriptive commentary for a chart."""
    lines: List[str] = []
    lines.append(f"This {chart_type.upper()} chart visualizes distribution of '{x}'" + (f" against '{y}'" if y else "") + ".")

    if y and y in df.columns and pd.api.types.is_numeric_dtype(df[y]):
        series = df[y].dropna()
        if not series.empty:
            lines.append(f"'{y}' ranges from {series.min():.2f} to {series.max():.2f} "
                         f"(mean: {series.mean():.2f}, std: {series.std():.2f}).")
            q1, q3 = series.quantile(0.25), series.quantile(0.75)
            iqr = q3 - q1
            outlier_count = int(((series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)).sum())
            if outlier_count > 0:
                lines.append(f"Detected {outlier_count} potential statistical outlier(s) via IQR method.")

    if x and x in df.columns and pd.api.types.is_numeric_dtype(df[x]):
        series = df[x].dropna()
        skew = float(series.skew())
        if abs(skew) > 1:
            direction = "positively" if skew > 0 else "negatively"
            lines.append(f"'{x}' shows {direction} skewed distribution (skewness: {skew:.2f}).")
    elif x and x in df.columns and not pd.api.types.is_numeric_dtype(df[x]):
        n_unique = df[x].nunique()
        lines.append(f"'{x}' contains {n_unique} distinct categor{'y' if n_unique == 1 else 'ies'}.")

    return " ".join(lines)


def generate_chart_spec(
    file_or_df: Union[str, pd.DataFrame],
    chart_type: str,
    x: str,
    y: Optional[str] = None,
    color: Optional[str] = None,
    title: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate a Plotly-compatible chart specification and commentary."""
    df = file_or_df if isinstance(file_or_df, pd.DataFrame) else _load_file(file_or_df)
    _validate_chart_config(chart_type, x, y, df)

    # For charts with massive rows, downsample to 2000 points for fluid UI rendering
    sample_df = df.sample(2000, random_state=42) if len(df) > 2000 and chart_type in ["scatter", "line"] else df

    spec: Dict[str, Any] = {"data": [], "layout": {"title": title or f"{chart_type.title()} Analysis"}}

    if chart_type == "bar":
        if y and y in df.columns and pd.api.types.is_numeric_dtype(df[y]):
            grouped = df.groupby(x)[y].mean().reset_index().sort_values(by=y, ascending=False).head(25)
            spec["data"].append({
                "type": "bar",
                "x": [str(v) for v in grouped[x].tolist()],
                "y": [float(v) for v in grouped[y].tolist()],
                "name": y,
                "marker": {"color": "#6366f1"}
            })
        else:
            counts = df[x].value_counts().head(25)
            spec["data"].append({
                "type": "bar",
                "x": [str(v) for v in counts.index.tolist()],
                "y": [int(v) for v in counts.values.tolist()],
                "name": x,
                "marker": {"color": "#6366f1"}
            })
        spec["layout"]["xaxis"] = {"title": x}
        spec["layout"]["yaxis"] = {"title": y or "Frequency Count"}

    elif chart_type == "line":
        spec["data"].append({
            "type": "scatter",
            "mode": "lines+markers",
            "x": [str(v) for v in sample_df[x].tolist()],
            "y": [float(v) for v in sample_df[y].tolist()] if y and y in sample_df.columns else list(range(len(sample_df))),
            "name": y or x,
            "line": {"color": "#10b981"}
        })
        spec["layout"]["xaxis"] = {"title": x}
        spec["layout"]["yaxis"] = {"title": y or "Value"}

    elif chart_type == "scatter":
        trace: Dict[str, Any] = {
            "type": "scatter",
            "mode": "markers",
            "x": [float(v) if pd.api.types.is_numeric_dtype(sample_df[x]) else str(v) for v in sample_df[x].tolist()],
            "y": [float(v) for v in sample_df[y].tolist()] if y and y in sample_df.columns else list(range(len(sample_df))),
            "name": f"{x} vs {y}",
            "marker": {"size": 7, "color": "#6366f1", "opacity": 0.8}
        }
        spec["data"].append(trace)
        spec["layout"]["xaxis"] = {"title": x}
        spec["layout"]["yaxis"] = {"title": y or "Index"}

    elif chart_type == "pie":
        if y and y in df.columns and pd.api.types.is_numeric_dtype(df[y]):
            grouped = df.groupby(x)[y].sum().reset_index().sort_values(by=y, ascending=False).head(10)
            spec["data"].append({
                "type": "pie",
                "labels": [str(v) for v in grouped[x].tolist()],
                "values": [float(v) for v in grouped[y].tolist()],
                "hole": 0.35,
            })
        else:
            counts = df[x].value_counts().head(10)
            spec["data"].append({
                "type": "pie",
                "labels": [str(v) for v in counts.index.tolist()],
                "values": [int(v) for v in counts.values.tolist()],
                "hole": 0.35,
            })

    elif chart_type == "heatmap":
        numeric = df.select_dtypes(include=[np.number])
        corr = numeric.corr()
        spec["data"].append({
            "type": "heatmap",
            "z": [[round(float(v), 3) if not pd.isna(v) else 0.0 for v in row] for row in corr.values.tolist()],
            "x": corr.columns.tolist(),
            "y": corr.index.tolist(),
            "colorscale": "Viridis",
        })

    elif chart_type == "boxplot":
        target_col = y if y and y in df.columns else x
        spec["data"].append({
            "type": "box",
            "y": [float(v) for v in df[target_col].dropna().head(1000).tolist()],
            "name": target_col,
            "marker": {"color": "#8b5cf6"}
        })

    elif chart_type == "violin":
        target_col = y if y and y in df.columns else x
        spec["data"].append({
            "type": "violin",
            "y": [float(v) for v in df[target_col].dropna().head(1000).tolist()],
            "name": target_col,
            "marker": {"color": "#06b6d4"}
        })

    commentary = _generate_commentary(chart_type, df, x, y)

    return {
        "chart_type": chart_type,
        "plotly_spec": spec,
        "commentary": commentary,
    }
