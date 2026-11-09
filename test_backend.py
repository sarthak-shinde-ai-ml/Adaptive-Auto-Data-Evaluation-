"""End-to-end verification script for AADES backend."""
import os
import io
import pandas as pd
from fastapi.testclient import TestClient

from backend.main import app

def run_tests():
    client = TestClient(app)
    print("Testing AADES Backend endpoints...\n", flush=True)

    # 1. Create a dummy CSV dataset
    data = {
        "Region": ["North", "South", "East", "West", "North", "South", "East", "West", "North", "South"],
        "Sales": [100.5, 200.0, 150.2, 300.8, 110.0, 210.5, 140.0, 310.2, 105.0, 205.0],
        "Profit": [10.5, 25.0, 15.0, 45.0, 12.0, 27.0, 14.0, 48.0, 11.0, 24.0],
        "Units": [5, 10, 7, 15, 6, 11, 7, 16, 5, 10]
    }
    df = pd.DataFrame(data)
    csv_bytes = io.BytesIO()
    df.to_csv(csv_bytes, index=False)
    csv_bytes.seek(0)

    # 2. Test Upload and Auto-Profiling
    print("1. Testing Upload & Auto-Profiling (POST /api/datasets/)...")
    response = client.post(
        "/api/datasets/",
        files={"file": ("sample_sales.csv", csv_bytes.getvalue(), "text/csv")}
    )
    assert response.status_code == 200, f"Upload failed: {response.text}"
    upload_res = response.json()
    dataset_id = upload_res["dataset_id"]
    profile = upload_res["profile"]
    assert profile["row_count"] == 10
    assert profile["column_count"] == 4
    assert "data_quality_score" in profile
    print(f"   -> Upload successful! Dataset ID: {dataset_id}")
    print(f"   -> Quality score: {profile['data_quality_score']}\n")

    # 3. Test GET Profile
    print(f"2. Testing Get Profile (GET /api/datasets/{dataset_id}/profile)...")
    res_prof = client.get(f"/api/datasets/{dataset_id}/profile")
    assert res_prof.status_code == 200
    assert res_prof.json()["profile"]["row_count"] == 10
    print("   -> Profile verified!\n")

    # 4. Test Comparative Analysis
    print(f"3. Testing Comparative Analysis (POST /api/datasets/{dataset_id}/compare)...")
    compare_payload = {
        "group_by": "Region",
        "metrics": ["Sales", "Profit"]
    }
    res_comp = client.post(f"/api/datasets/{dataset_id}/compare", json=compare_payload)
    assert res_comp.status_code == 200, f"Compare failed: {res_comp.text}"
    comp_data = res_comp.json()["result"]
    assert "grouped_means" in comp_data
    assert "correlation_matrix" in comp_data
    print(f"   -> Grouped means computed for {len(comp_data['grouped_means'])} groups.")
    print(f"   -> Correlation Sales vs Profit: {comp_data['correlation_matrix']['Sales']['Profit']}\n")

    # 5. Test Chart Generation with Auto-Commentary
    print(f"4. Testing Chart Visualizer (POST /api/datasets/{dataset_id}/charts)...")
    chart_payload = {
        "chart_type": "scatter",
        "x": "Sales",
        "y": "Profit",
        "title": "Sales vs Profit Scatter"
    }
    res_chart = client.post(f"/api/datasets/{dataset_id}/charts", json=chart_payload)
    assert res_chart.status_code == 200, f"Chart failed: {res_chart.text}"
    chart_data = res_chart.json()
    assert "plotly_spec" in chart_data
    assert "commentary" in chart_data
    print(f"   -> Commentary: {chart_data['commentary']}\n")

    # 6. Test ML: K-Means Clustering
    print(f"5. Testing ML K-Means (POST /api/datasets/{dataset_id}/ml)...")
    ml_kmeans_payload = {
        "task": "kmeans",
        "columns": ["Sales", "Profit", "Units"],
        "k": 3
    }
    res_km = client.post(f"/api/datasets/{dataset_id}/ml", json=ml_kmeans_payload)
    assert res_km.status_code == 200, f"KMeans failed: {res_km.text}"
    km_data = res_km.json()["result"]
    assert len(km_data["labels"]) == 10
    print(f"   -> K-Means completed! Cluster labels: {km_data['labels']}\n")

    # 7. Test ML: Linear Regression
    print(f"6. Testing ML Linear Regression (POST /api/datasets/{dataset_id}/ml)...")
    ml_reg_payload = {
        "task": "regression",
        "columns": ["Sales", "Units"],
        "target": "Profit",
        "test_size": 0.2
    }
    res_reg = client.post(f"/api/datasets/{dataset_id}/ml", json=ml_reg_payload)
    assert res_reg.status_code == 200, f"Regression failed: {res_reg.text}"
    reg_data = res_reg.json()["result"]
    assert "coefficients" in reg_data
    assert "r2_test" in reg_data
    print(f"   -> Linear Regression completed! R2 test score: {reg_data['r2_test']}\n")

    # 8. Test RAG Help
    print("7. Testing RAG Help (POST /api/rag/chat)...")
    rag_payload = {
        "dataset_id": dataset_id,
        "message": "Why is profit lower in the North region?"
    }
    res_rag = client.post("/api/rag/chat", json=rag_payload)
    assert res_rag.status_code == 200
    rag_data = res_rag.json()
    assert "explanation" in rag_data
    assert "root_cause" in rag_data
    assert "counter_plan" in rag_data
    print(f"   -> RAG confidence: {rag_data['confidence']}")
    print(f"   -> Counter-plan: {rag_data['counter_plan']}\n")

    # 9. Test PDF Report Request & Download
    print("8. Testing PDF Report generation & download (POST /api/reports/ & GET /api/reports/{id}/download)...")
    rep_payload = {"dataset_id": dataset_id}
    res_rep = client.post("/api/reports/", json=rep_payload)
    assert res_rep.status_code == 200
    assert "download_url" in res_rep.json()
    print(f"   -> Report compiled: {res_rep.json()['report_id']}")

    res_down = client.get(f"/api/reports/{dataset_id}/download")
    assert res_down.status_code == 200
    assert res_down.headers["content-type"] == "application/pdf"
    print(f"   -> PDF binary downloaded successfully ({len(res_down.content)} bytes)!\n")

    print("========================================")
    print("ALL 8 ENDPOINT TESTS PASSED COMPLETELY!")
    print("========================================")

if __name__ == "__main__":
    run_tests()
