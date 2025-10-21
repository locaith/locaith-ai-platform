import os
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from google.genai import Client, types

# Gemini client
if os.getenv("GEMINI_API_KEY") is None:
    raise ValueError("GEMINI_API_KEY is not set")

client = Client(api_key=os.getenv("GEMINI_API_KEY"))

router = APIRouter(prefix="/api/image", tags=["image"])

# In-memory cache for last generated/edited image
_last_image_bytes: Optional[bytes] = None
_last_mime_type: str = "image/png"


class GenerateRequest(BaseModel):
    prompt: str
    aspect_ratio: Optional[str] = None  # e.g., "1:1", "16:9", "4:3"


def _extract_image_and_text(response: types.GenerateContentResponse):
    """Extracts image bytes and text from a Gemini generate_content response."""
    image_bytes = None
    mime_type = "image/png"
    texts: list[str] = []

    # Some responses may include multiple candidates/parts; we scan for first image
    for cand in getattr(response, "candidates", []) or []:
        for part in getattr(cand.content, "parts", []) or []:
            # Text
            if hasattr(part, "text") and part.text:
                texts.append(part.text)
            # Image bytes
            if hasattr(part, "inline_data") and part.inline_data and getattr(part.inline_data, "data", None):
                image_bytes = part.inline_data.data
                if getattr(part.inline_data, "mime_type", None):
                    mime_type = part.inline_data.mime_type
                break
        if image_bytes is not None:
            break

    return image_bytes, mime_type, ("\n".join(texts).strip() if texts else None)


@router.post("/generate")
def generate_image(payload: GenerateRequest):
    """Generate an image from a descriptive prompt using Gemini 2.5 Flash Image."""
    global _last_image_bytes, _last_mime_type

    prompt = payload.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    config: dict = {
        "response_modalities": ["IMAGE", "TEXT"],
        "temperature": 0.8,
    }
    if payload.aspect_ratio:
        config["image_config"] = {"aspect_ratio": payload.aspect_ratio}

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=prompt,
            config=config,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini image generation failed: {e}")

    image_bytes, mime_type, caption = _extract_image_and_text(response)
    if image_bytes is None:
        raise HTTPException(status_code=500, detail="No image returned from Gemini")

    # Cache last image
    _last_image_bytes = image_bytes
    _last_mime_type = mime_type or "image/png"

    import base64

    data_url = f"data:{_last_mime_type};base64,{base64.b64encode(image_bytes).decode('utf-8')}"
    return {"mime_type": _last_mime_type, "data_url": data_url, "caption": caption}


@router.post("/edit")
async def edit_image(
    prompt: str = Form(...),
    file: Optional[UploadFile] = File(None),
    aspect_ratio: Optional[str] = Form(None),
):
    """Edit an existing image using Gemini 2.5 Flash Image.

    - If a file is provided, it will be used as the base image.
    - If no file is provided, the last generated image will be used.
    """
    global _last_image_bytes, _last_mime_type

    prompt = prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    img_bytes: Optional[bytes] = None
    mime_type = "image/png"

    if file is not None:
        try:
            img_bytes = await file.read()
            mime_type = file.content_type or "image/png"
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {e}")
    else:
        # Use last image if available
        if _last_image_bytes is None:
            raise HTTPException(status_code=400, detail="No image file provided and no previous image to edit")
        img_bytes = _last_image_bytes
        mime_type = _last_mime_type

    image_part = types.Part.from_bytes(data=img_bytes, mime_type=mime_type)

    config: dict = {
        "response_modalities": ["IMAGE", "TEXT"],
        "temperature": 0.7,
    }
    if aspect_ratio:
        config["image_config"] = {"aspect_ratio": aspect_ratio}

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[prompt, image_part],
            config=config,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini image edit failed: {e}")

    image_bytes, mime_type, caption = _extract_image_and_text(response)
    if image_bytes is None:
        raise HTTPException(status_code=500, detail="No edited image returned from Gemini")

    # Cache last image
    _last_image_bytes = image_bytes
    _last_mime_type = mime_type or "image/png"

    import base64

    data_url = f"data:{_last_mime_type};base64,{base64.b64encode(image_bytes).decode('utf-8')}"
    return {"mime_type": _last_mime_type, "data_url": data_url, "caption": caption}


@router.get("/last")
async def get_last_image():
    """Return last generated/edited image as data URL."""
    global _last_image_bytes, _last_mime_type
    if _last_image_bytes is None:
        raise HTTPException(status_code=404, detail="No image available")

    import base64

    data_url = f"data:{_last_mime_type};base64,{base64.b64encode(_last_image_bytes).decode('utf-8')}"
    return {"mime_type": _last_mime_type, "data_url": data_url}