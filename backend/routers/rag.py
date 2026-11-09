"""RAG Help chat router with context-grounded intelligence."""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()


class ChatMessage(BaseModel):
    message: str
    dataset_id: str = ""


class RAGResponse(BaseModel):
    explanation: str
    root_cause: str
    counter_plan: str
    confidence: str
    citations: List[str]


@router.post("/chat", summary="RAG Help chat endpoint", response_model=RAGResponse)
async def rag_chat(msg: ChatMessage):
    profile = {}
    if msg.dataset_id:
        try:
            from .datasets import get_dataset_context
            ctx = get_dataset_context(msg.dataset_id)
            profile = ctx.get("profile", {})
        except Exception:
            profile = {}

    from ..services.rag import generate_rag_insight
    res = generate_rag_insight(msg.message, msg.dataset_id, profile)

    return RAGResponse(
        explanation=res["explanation"],
        root_cause=res["root_cause"],
        counter_plan=res["counter_plan"],
        confidence=res["confidence"],
        citations=res["citations"],
    )
