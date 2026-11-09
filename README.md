# Adaptive Auto Data Evaluation System (AADES) – v3.0

**A no‑code analytics platform** that enables business analysts, recruiters, and data‑curious users to upload a dataset (CSV, Excel, JSON) and instantly obtain:
- Automated profiling and data‑quality scoring
- Anomaly & outlier alerts
- Comparative analysis & custom visualizations with auto‑generated commentary
- An AI‑driven RAG insight assistant ("RAG Help")
- Professional PDF reports that faithfully capture the UI view

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Core Features](#core-features)
3. [User Workflows](#user-workflows)
4. [Tech Stack](#tech-stack)
5. [Getting Started](#getting-started)
6. [Development & Contribution](#development--contribution)
7. [Roadmap](#roadmap)
8. [License](#license)

---

## Architecture Overview
| Layer                | Responsibility                                                                                                 | Technology                                                                                           |
|----------------------|----------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| **Presentation**     | Dashboard workspace, tabs, RAG Help drawer, action bar                                                       | **Next.js** (React + TypeScript) • Tailwind CSS • shadcn/ui • Lucide icons                            |
| **Ingestion & Validation** | Parse CSV/XLSX/JSON, validate schema, infer column types                                                   | `pandas`, `openpyxl`                                                                                 |
| **Profiling Engine** | Compute schema, missing‑value %, distributions, summary statistics, data‑quality score, outlier/skew detection | `pandas`, `numpy`, `scipy`                                                                           |
| **Filter Layer**     | Global filters (date range, category, numeric range) applied before every downstream analysis                | `pandas` query layer, FastAPI session/state                                                         |
| **Comparative Engine**| Cross‑variable differentials, percentage change, correlations                                             | `pandas`, `scipy`                                                                                    |
| **Visualization Engine**| Chart spec generation + Plotly rendering, static export for PDF                                           | `plotly`, `kaleido`                                                                                  |
| **ML Engine**        | K‑Means clustering, Linear Regression (train/test split)                                                    | `scikit‑learn`                                                                                       |
| **RAG Insight Layer**| Indexes profile, analysis, filters; retrieval + LLM generation                                            | Embedding model (sentence‑transformers) • Vector store (`FAISS` or `Chroma`) • LangChain / LlamaIndex |
| **Code Export**      | Template‑based generator that produces Pandas/SQL snippets for any analysis                                 | Jinja2 templates                                                                                    |
| **Reporting**        | PDF compilation with chart captions, RAG insights, filter metadata                                           | `ReportLab` or `WeasyPrint` • `Kaleido` for Plotly image export                                    |

---

## Core Features

### 1️⃣ Automated Ingestion & Initial Profiling
- Upload triggers **instant** parsing, schema inference, and a full profiling pipeline.
- Generates an *Executive Summary* (row/col count, data‑quality score, warnings & alerts).
- Detects outliers (IQR & z‑score), high skew, missing‑value columns, constant columns, duplicate rows, and mixed‑type columns. Each alert includes severity, metric value, and plain‑language description.

### 2️⃣ Dynamic Comparative Analysis Engine
- Users select variables & grouping criteria; the engine computes differentials, percentage changes, and correlation matrices in real time.
- Results respect the **global filter state**.
- A *View Code* button surfaces the exact Pandas/SQL used, including active filters.

### 3️⃣ Chart‑Driven Custom Visualizer
- Supports Bar, Line, Scatter, Pie, Heatmap, Boxplot, Violin, etc. via **Plotly.js**.
- Field‑to‑axis mapping is validated (e.g., Pie needs one categorical + one numeric field).
- Auto‑generated textual commentary explains the chart, highlights outliers, and notes trends.
- *View Code* provides the corresponding Pandas/Plotly snippet.

### 4️⃣ RAG Insight Assistant ("RAG Help")
- Launched from a floating action button; appears as a slide‑over drawer.
- Retrieves context from the **Analysis Context** (profile, filters, analysis results) using a vector store.
- Generates **structured** responses:
  1. **Explanation** – plain language summary of the current analysis.
  2. **Root Cause** – why a metric is low / why an anomaly appears.
  3. **Counter‑Plan** – actionable recommendations with citations.
- Each recommendation shows a **confidence badge** (high/medium/low) and cites the underlying metric(s).

### 5️⃣ Professional PDF Reporting
- One‑click *Download Report* compiles:
  - Executive Summary & data‑quality score
  - Warnings & Alerts
  - All active filters (as chips)
  - Selected comparative tables / custom charts (static images via Kaleido)
  - RAG‑generated insights with citations
- PDF generation is performed server‑side via **FastAPI** and **ReportLab** (or **WeasyPrint**).

---

## User Workflows

| Workflow | Steps |
|----------|-------|
| **A – Instant Overview** | 1. Open the app, upload a CSV/Excel/JSON file.<br>2. Profiling runs automatically; Executive Summary & Alerts appear.<br>3. Click *Download PDF* for a PDF of the overall analysis. |
| **B – Drill‑down Comparison** | 1. Apply global filters (e.g., last quarter, region = West).<br>2. Open *Comparative Analysis* tab, choose variables & grouping column.<br>3. Review differentials, % changes, correlations.<br>4. Click *View Code* to copy the Pandas/SQL snippet. |
| **C – Custom Visualization** | 1. Open *Custom Visualizer* tab.<br>2. Select chart type and map fields to axes.<br>3. Chart renders instantly with auto‑commentary.<br>4. Export the chart in the PDF or copy its code. |
| **D – Insight & Counter‑Plans** | 1. Click the *RAG Help* FAB to open the chat drawer.<br>2. Ask a question (e.g., *Why is conversion low in the South segment?*).<br>3. Receive structured response with explanation, root cause, confidence‑rated counter‑plan, and citations.<br>4. Include the insight in the next PDF export. |

---

## Tech Stack

| Area | Technology |
|------|------------|
| **Frontend (v3.0)** | Next.js (React + TypeScript), Tailwind CSS, shadcn/ui, Lucide icons, Plotly.js, TanStack Table & Query, Zustand for global state |
| **Backend API** | FastAPI (Python), pandas, scikit‑learn, LangChain/LlamaIndex, FAISS or Chroma, ReportLab / WeasyPrint, Kaleido |
| **Data Processing** | pandas 2.0, numpy 1.26, openpyxl, scipy |
| **Machine Learning** | scikit‑learn 1.9 (StandardScaler, KMeans, LinearRegression) |
| **Visualization (server)** | Plotly 6.9, Kaleido (static image export) |
| **RAG** | sentence‑transformers, FAISS/Chroma, LangChain or LlamaIndex, any LLM API (OpenAI, Gemini, etc.) |
| **Reporting** | ReportLab **or** WeasyPrint (PDF), Kaleido (Plotly image export) |

---

## Getting Started
```bash
# 1️⃣ Clone the repo
git clone https://github.com/sarthak7-securtiy/Adaptive-Auto-Data-Evaluation-System.git
cd Adaptive-Auto-Data-Evaluation-System

# 2️⃣ Backend setup (Windows PowerShell)
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
uvicorn backend.main:app --reload   # API runs on http://localhost:8000

# 3️⃣ Frontend setup (Node.js 18+ required)
cd frontend
npm install               # installs React, Tailwind, shadcn/ui, Plotly.js, etc.
npm run dev               # dev server on http://localhost:3000
```
The frontend talks to the backend via the `/api/*` endpoints defined in `backend/routers/`. The UI is fully functional with mock data out‑of‑the‑box; replace the placeholder services in `backend/services.py` with production logic when ready.

---

## Development & Contribution
1. **Branching** – `git checkout -b feat/<name>`
2. **Code style** – `black .`, `flake8` for Python; `eslint` + `prettier` for TypeScript.
3. **Testing** – `pytest` for backend, **Jest** + **React Testing Library** for frontend.
4. **Pull Request** – Write a clear description, reference the issue, and ensure CI passes before merging.
5. **Security checklist** – Review for prompt‑injection, PII leakage, and unsafe code execution before a release.

---

## Roadmap
| Status | Feature |
|--------|---------|
| ✅ | CSV/Excel/JSON ingestion, schema inspector, descriptive stats, correlation, histograms, box plots, scatter matrix |
| ✅ | K‑Means (elbow curve) & Linear Regression (residuals, coefficients) |
| 🚧 | UI migration to Next.js + shadcn/ui (backend first, then frontend) |
| 🚧 | Module 1: Executive Summary & Data‑Quality Score |
| 🚧 | Module 2: Comparative Analysis Engine |
| 🚧 | Module 3: Chart library with auto‑commentary |
| 🚧 | Module 4: RAG Help assistant (structured responses, confidence badges) |
| 🚧 | Module 5: PDF reporting (captioned charts, RAG insights) |
| 🚧 | Global filters, View‑Code export, authentication, CI/CD pipeline |

---

## License
MIT License – see `LICENSE` file.

