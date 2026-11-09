"""Machine Learning service.
Provides K-Means clustering and Linear Regression with proper train/test split.
"""
import os
os.environ["LOKY_MAX_CPU_COUNT"] = "2"

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Union

from .profiling import _load_file


def _prepare_numeric(df: pd.DataFrame, columns: List[str]) -> pd.DataFrame:
    """Select and clean numeric columns for ML."""
    missing = [c for c in columns if c not in df.columns]
    if missing:
        raise ValueError(f"Columns not found: {missing}")
    subset = df[columns].copy()
    # Drop rows with any NaN in the selected columns only
    subset = subset.dropna(subset=columns)
    non_numeric = [c for c in columns if not pd.api.types.is_numeric_dtype(subset[c])]
    if non_numeric:
        raise ValueError(f"Non-numeric columns cannot be used for ML: {non_numeric}")
    return subset


def run_kmeans(
    file_or_df: Union[str, pd.DataFrame],
    columns: List[str],
    k: int = 3,
    max_k_elbow: int = 10,
) -> Dict[str, Any]:
    """Run K-Means clustering.

    Returns cluster labels, centroids, and an elbow curve (inertias for k=1..max_k_elbow).
    """
    from sklearn.preprocessing import StandardScaler
    from sklearn.cluster import KMeans

    df = file_or_df if isinstance(file_or_df, pd.DataFrame) else _load_file(file_or_df)
    subset = _prepare_numeric(df, columns)

    scaler = StandardScaler()
    X = scaler.fit_transform(subset[columns].values)

    # Elbow curve – reuse fitted models
    inertias: List[float] = []
    fitted_model: Optional[KMeans] = None
    upper_k = min(max_k_elbow, max(1, len(X) - 1))
    for ki in range(1, upper_k + 1):
        model = KMeans(n_clusters=ki, n_init=1, random_state=42)
        model.fit(X)
        inertias.append(float(model.inertia_))
        if ki == k:
            fitted_model = model

    if fitted_model is None:
        fitted_model = KMeans(n_clusters=k, n_init=1, random_state=42)
        fitted_model.fit(X)

    labels = fitted_model.labels_.tolist()
    centroids = scaler.inverse_transform(fitted_model.cluster_centers_).tolist()

    return {
        "k": k,
        "labels": labels,
        "centroids": centroids,
        "elbow_inertias": inertias,
        "columns_used": columns,
        "n_samples": len(labels),
    }


def run_linear_regression(
    file_or_df: Union[str, pd.DataFrame],
    feature_columns: List[str],
    target_column: str,
    test_size: float = 0.2,
) -> Dict[str, Any]:
    """Run Linear Regression with a proper train/test split.

    Returns coefficients, intercept, R² scores for both train and test sets,
    and residuals for the test set.
    """
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
    from sklearn.linear_model import LinearRegression
    from sklearn.metrics import r2_score, mean_squared_error

    df = file_or_df if isinstance(file_or_df, pd.DataFrame) else _load_file(file_or_df)
    all_cols = feature_columns + [target_column]
    subset = _prepare_numeric(df, all_cols)

    X = subset[feature_columns].values
    y = subset[target_column].values

    if len(X) < 5:
        raise ValueError("Not enough data points for regression (need at least 5 rows after cleaning).")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42
    )

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    model = LinearRegression()
    model.fit(X_train_s, y_train)

    y_pred_train = model.predict(X_train_s)
    y_pred_test = model.predict(X_test_s)

    residuals = (y_test - y_pred_test).tolist()

    return {
        "feature_columns": feature_columns,
        "target_column": target_column,
        "coefficients": dict(zip(feature_columns, [round(c, 4) for c in model.coef_.tolist()])),
        "intercept": round(float(model.intercept_), 4),
        "r2_train": round(float(r2_score(y_train, y_pred_train)), 4),
        "r2_test": round(float(r2_score(y_test, y_pred_test)), 4),
        "mse_test": round(float(mean_squared_error(y_test, y_pred_test)), 4),
        "test_size": test_size,
        "n_train": len(y_train),
        "n_test": len(y_test),
        "residuals": residuals,
    }

