"""RAG Help chat router."""
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
    # Placeholder: in production, embed context, retrieve from vector store, call LLM, stream response.
    return RAGResponse(
        explanation="This is a placeholder explanation based on the uploaded dataset.",
        root_cause="No real root cause computed yet.",
        counter_plan="Consider cleaning missing values and re-run the analysis.",
        confidence="medium",
        citations=["profile missing-value metric"],
    )
