from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .agent import run_agent
from .vectorize import vectorize_image_url

load_dotenv()

app = FastAPI(title="Just Plan ML", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class VectorizeRequest(BaseModel):
    image_url: str
    pixels_per_meter: float | None = None
    source_image_id: str | None = None


class AgentRequest(BaseModel):
    message: str
    plan: dict[str, Any] = Field(default_factory=dict)


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "just-plan-ml"}


@app.post("/vectorize")
def vectorize(req: VectorizeRequest) -> dict[str, Any]:
    plan = vectorize_image_url(
        req.image_url,
        pixels_per_meter=req.pixels_per_meter,
        source_image_id=req.source_image_id,
    )
    return {"plan": plan}


@app.post("/agent/chat")
def agent_chat(req: AgentRequest) -> dict[str, Any]:
    return run_agent(req.message, req.plan)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
