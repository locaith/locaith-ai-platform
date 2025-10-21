import os
from typing import Literal, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google.genai import Client

# Ensure API key is set for Gemini
if os.getenv("GEMINI_API_KEY") is None:
    raise ValueError("GEMINI_API_KEY is not set")

client = Client(api_key=os.getenv("GEMINI_API_KEY"))

router = APIRouter(prefix="/api/intent", tags=["intent"]) 


class ImageIntentRequest(BaseModel):
    user_input: str

class ImageIntentResponse(BaseModel):
    intent: Literal["create", "ask"]
    confidence: float
    keywords: list[str]
    model: str = "gemini-2.5-flash"


def _keyword_confidence(text: str) -> tuple[list[str], float]:
    t = (text or "").lower()
    keywords = {
        # create
        "tạo": 0.25,
        "tạo ảnh": 0.35,
        "vẽ": 0.25,
        "render": 0.25,
        "generate": 0.25,
        "image": 0.15,
        "ảnh": 0.15,
        "photo": 0.15,
        "hình": 0.15,
        "giúp tôi tạo": 0.30,
        # edit
        "chỉnh sửa": 0.25,
        "sửa ảnh": 0.30,
        "edit": 0.25,
        "edit image": 0.30,
        # ask
        "cơ chế": -0.30,
        "hoạt động": -0.25,
        "nguyên lý": -0.30,
        "cách tạo": -0.20,
        "cách hoạt động": -0.25,
        "how": -0.20,
        "explain": -0.20,
        "mechanism": -0.20,
    }
    hits: list[str] = []
    score = 0.0
    for k, w in keywords.items():
        if k in t:
            hits.append(k)
            score += w
    # Normalize confidence to [0,1]
    # Positive score indicates leaning to "create"; negative -> "ask"
    pos = max(score, 0.0)
    conf = min(1.0, pos)
    return hits, conf


def _call_flash_classify(user_input: str) -> str:
    """Call Gemini 2.5 Flash to classify 'create' or 'ask'."""
    prompt = (
        "Phân tích xem người dùng có đang:\n"
        "(A) Muốn AI tạo ảnh mới theo mô tả.\n"
        "(B) Chỉ hỏi về cơ chế, cách hoạt động, hoặc nguyên lý tạo ảnh.\n"
        "Chỉ trả về 'create' hoặc 'ask'.\n---\n"
        f"Câu hỏi: {user_input}\n"
    )
    try:
        res = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={"temperature": 0, "max_output_tokens": 2},
        )
        text = (res.text or "").strip().lower()
        if "create" in text:
            return "create"
        if "ask" in text:
            return "ask"
        # Fallback heuristic
        return "create" if any(s in user_input.lower() for s in ["tạo", "vẽ", "generate", "render"]) else "ask"
    except Exception as e:
        # In case of model failure, fallback to heuristic only
        print(f"WARN: flash classify failed: {e}")
        return "create" if any(s in user_input.lower() for s in ["tạo", "vẽ", "generate", "render"]) else "ask"


@router.post("/image", response_model=ImageIntentResponse)
def classify_image_intent(payload: ImageIntentRequest):
    text = (payload.user_input or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="user_input is required")

    hits, kw_conf = _keyword_confidence(text)
    model_intent = _call_flash_classify(text)

    # Combine confidences. If model says 'ask', reduce overall confidence.
    # Base trust 0.5, keywords up to +0.3, model alignment up to +0.2
    base = 0.5
    model_boost = 0.2 if model_intent == "create" else -0.2
    combined = max(0.0, min(1.0, base + (kw_conf * 0.3) + model_boost))

    final_intent: Literal["create", "ask"] = (
        "create" if combined >= 0.5 else "ask"
    )

    return ImageIntentResponse(intent=final_intent, confidence=combined, keywords=hits)