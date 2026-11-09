import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import datasets, rag, reports

app = FastAPI(title="AADES Backend", version="v3.0")

# Allow frontend (localhost:3000) to call API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets.router, prefix="/api/datasets", tags=["datasets"])
app.include_router(rag.router, prefix="/api/rag", tags=["rag"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)

