import base64

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Literal

from config import settings
from api.routes import router
from api.schemas import GenerateRequest
from pipeline.generator import generate_image
from pipeline.identifier import identify_materials_with_consistency
from pipeline.orchestrator import run_pipeline
from store.sessions import get_image

app = FastAPI(
    title="IIGenAI",
    description="Compound AI system grounding interior design images with real-world material CO₂e data",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["meta"])
async def health_check():
    return {"status": "ok", "service": "IIGenAI"}


# ---------------------------------------------------------------------------
# Test route — smoke-test the image generator without a full session
# ---------------------------------------------------------------------------

class TestGenerateRequest(BaseModel):
    prompt: str
    room_type: Literal["office", "living_room", "patient_room", "free_flowing"] = "living_room"


@app.post("/api/test-generate", tags=["dev"])
async def test_generate(body: TestGenerateRequest):
    """
    Quick smoke-test for the gpt-image-1 generator.
    Returns the assembled prompt and the first 100 chars of the base64
    payload so the response stays readable in Swagger.
    """
    try:
        result = await generate_image(prompt=body.prompt, room_type=body.room_type)
    except RuntimeError as exc:
        # Missing API key — surface as a clear 500 with the reason
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI error: {exc}")

    b64 = result["image_base64"] or ""
    return {
        "full_prompt": result["full_prompt"],
        "image_base64_preview": b64[:100] + ("…" if len(b64) > 100 else ""),
        "base64_total_length": len(b64),
        "model": "gpt-image-1",
    }


# ---------------------------------------------------------------------------
# Test route — smoke-test the material identifier
# ---------------------------------------------------------------------------

class TestIdentifyRequest(BaseModel):
    image_base64: str
    n_passes: int = 5


@app.post("/api/test-identify", tags=["dev"])
async def test_identify(body: TestIdentifyRequest):
    """
    Smoke-test for the self-consistency material identifier.
    Pass in a base64 image string (e.g. from /api/test-generate output)
    and get back the identified materials with confidence scores.
    """
    try:
        materials = await identify_materials_with_consistency(
            image_base64=body.image_base64,
            n_passes=body.n_passes,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI error: {exc}")

    return {
        "material_count": len(materials),
        "n_passes": body.n_passes,
        "model": "gpt-4.1-mini",
        "materials": materials,
    }


# ---------------------------------------------------------------------------
# Main generate endpoint — runs the full pipeline
# ---------------------------------------------------------------------------

@app.post("/api/generate", response_model=None, tags=["pipeline"])
async def generate(request: GenerateRequest):
    """
    Run the full IIGenAI pipeline:
      1. Generate image (gpt-image-1)
      2. Identify materials (gpt-4.1-mini, self-consistency)
      3. CoT retry for yellow-flag materials
      4. Ground with CO₂e data (ICE DB + Material2050)

    Returns a GenerateResponse with the current Iteration and session history.
    The generated image is served separately at GET /api/image/{session_id}/{n}.
    """
    try:
        response = await run_pipeline(request)
        return response
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Pipeline error: {exc}")


# ---------------------------------------------------------------------------
# Image serving — returns the raw PNG for a session iteration
# ---------------------------------------------------------------------------

@app.get("/api/image/{session_id}/{iteration_number}", tags=["pipeline"])
async def serve_image(session_id: str, iteration_number: int):
    """
    Serve the base64-encoded PNG generated for a specific pipeline iteration.
    Returns a raw image/png response so browsers and <img> tags can consume it.
    """
    b64 = get_image(session_id, iteration_number)
    if b64 is None:
        raise HTTPException(
            status_code=404,
            detail=f"No image found for session {session_id}, iteration {iteration_number}",
        )
    image_bytes = base64.b64decode(b64)
    return Response(content=image_bytes, media_type="image/png")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
