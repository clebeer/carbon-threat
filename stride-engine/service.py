"""
STRIDE Engine — FastAPI microservice for AI-powered threat modeling.
Runs as an internal service, called by the carbon-threat Node.js backend.
"""
import hmac
import os
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

import threat_model
import dread
import mitigations
import test_cases

load_dotenv()

app = FastAPI(title="STRIDE Engine", version="1.0.0")

STRIDE_ENGINE_TOKEN = os.getenv("STRIDE_ENGINE_TOKEN", "")

# ── Auth middleware ──────────────────────────────────────────────────────────

@app.middleware("http")
async def verify_internal_token(request: Request, call_next):
    # Skip healthz
    if request.url.path == "/healthz":
        return await call_next(request)

    token = request.headers.get("x-internal-token", "")
    if not STRIDE_ENGINE_TOKEN:
        return JSONResponse(status_code=500, content={"detail": "STRIDE_ENGINE_TOKEN not configured"})
    # Constant-time comparison to avoid leaking the token via timing.
    if not hmac.compare_digest(token, STRIDE_ENGINE_TOKEN):
        return JSONResponse(status_code=403, content={"detail": "Invalid internal token"})
    return await call_next(request)


# ── Models ───────────────────────────────────────────────────────────────────

class ThreatModelRequest(BaseModel):
    provider: str
    model: Optional[str] = None
    app_type: str = "Traditional application"
    authentication: str = "None"
    internet_facing: str = "No"
    sensitive_data: str = "No"
    app_input: str = ""

class ThreatModelArrayRequest(BaseModel):
    provider: str
    model: Optional[str] = None
    threat_model: list

class HealthResponse(BaseModel):
    status: str
    version: str


# ── Provider dispatch ────────────────────────────────────────────────────────

def _get_env(key: str, default: str = "") -> str:
    return os.getenv(key, default)


def _dispatch_threat_model(provider: str, model: str, prompt: str):
    """Route to the correct LLM provider."""
    if provider == "openai":
        return threat_model.get_threat_model(_get_env("OPENAI_API_KEY"), model, prompt)
    elif provider == "anthropic":
        return threat_model.get_threat_model_anthropic(_get_env("ANTHROPIC_API_KEY"), model, prompt)
    elif provider == "google":
        return threat_model.get_threat_model_google(_get_env("GOOGLE_API_KEY"), model, prompt)
    elif provider == "mistral":
        return threat_model.get_threat_model_mistral(_get_env("MISTRAL_API_KEY"), model, prompt)
    elif provider == "groq":
        return threat_model.get_threat_model_groq(_get_env("GROQ_API_KEY"), model, prompt)
    elif provider == "ollama":
        endpoint = _get_env("OLLAMA_ENDPOINT", "http://localhost:11434")
        timeout = int(_get_env("OLLAMA_TIMEOUT", "300"))
        return threat_model.get_threat_model_ollama(endpoint, model, timeout, prompt)
    elif provider == "lmstudio":
        endpoint = _get_env("LM_STUDIO_ENDPOINT", "http://localhost:1234")
        return threat_model.get_threat_model_lm_studio(endpoint, model, prompt)
    else:
        raise ValueError(f"Unknown provider: {provider}")


def _dispatch_dread(provider: str, model: str, prompt: str):
    if provider == "openai":
        return dread.get_dread_assessment(_get_env("OPENAI_API_KEY"), model, prompt)
    elif provider == "anthropic":
        return dread.get_dread_assessment_anthropic(_get_env("ANTHROPIC_API_KEY"), model, prompt)
    elif provider == "google":
        return dread.get_dread_assessment_google(_get_env("GOOGLE_API_KEY"), model, prompt)
    elif provider == "mistral":
        return dread.get_dread_assessment_mistral(_get_env("MISTRAL_API_KEY"), model, prompt)
    elif provider == "groq":
        return dread.get_dread_assessment_groq(_get_env("GROQ_API_KEY"), model, prompt)
    elif provider == "ollama":
        endpoint = _get_env("OLLAMA_ENDPOINT", "http://localhost:11434")
        timeout = int(_get_env("OLLAMA_TIMEOUT", "300"))
        return dread.get_dread_assessment_ollama(endpoint, model, timeout, prompt)
    elif provider == "lmstudio":
        endpoint = _get_env("LM_STUDIO_ENDPOINT", "http://localhost:1234")
        return dread.get_dread_assessment_lm_studio(endpoint, model, prompt)
    else:
        raise ValueError(f"Unknown provider: {provider}")


def _dispatch_mitigations(provider: str, model: str, prompt: str):
    if provider == "openai":
        return mitigations.get_mitigations(_get_env("OPENAI_API_KEY"), model, prompt)
    elif provider == "anthropic":
        return mitigations.get_mitigations_anthropic(_get_env("ANTHROPIC_API_KEY"), model, prompt)
    elif provider == "google":
        return mitigations.get_mitigations_google(_get_env("GOOGLE_API_KEY"), model, prompt)
    elif provider == "mistral":
        return mitigations.get_mitigations_mistral(_get_env("MISTRAL_API_KEY"), model, prompt)
    elif provider == "groq":
        return mitigations.get_mitigations_groq(_get_env("GROQ_API_KEY"), model, prompt)
    elif provider == "ollama":
        endpoint = _get_env("OLLAMA_ENDPOINT", "http://localhost:11434")
        timeout = int(_get_env("OLLAMA_TIMEOUT", "300"))
        return mitigations.get_mitigations_ollama(endpoint, model, timeout, prompt)
    elif provider == "lmstudio":
        endpoint = _get_env("LM_STUDIO_ENDPOINT", "http://localhost:1234")
        return mitigations.get_mitigations_lm_studio(endpoint, model, prompt)
    else:
        raise ValueError(f"Unknown provider: {provider}")


def _dispatch_test_cases(provider: str, model: str, prompt: str):
    if provider == "openai":
        return test_cases.get_test_cases(_get_env("OPENAI_API_KEY"), model, prompt)
    elif provider == "anthropic":
        return test_cases.get_test_cases_anthropic(_get_env("ANTHROPIC_API_KEY"), model, prompt)
    elif provider == "google":
        return test_cases.get_test_cases_google(_get_env("GOOGLE_API_KEY"), model, prompt)
    elif provider == "mistral":
        return test_cases.get_test_cases_mistral(_get_env("MISTRAL_API_KEY"), model, prompt)
    elif provider == "groq":
        return test_cases.get_test_cases_groq(_get_env("GROQ_API_KEY"), model, prompt)
    elif provider == "ollama":
        endpoint = _get_env("OLLAMA_ENDPOINT", "http://localhost:11434")
        timeout = int(_get_env("OLLAMA_TIMEOUT", "300"))
        return test_cases.get_test_cases_ollama(endpoint, model, timeout, prompt)
    elif provider == "lmstudio":
        endpoint = _get_env("LM_STUDIO_ENDPOINT", "http://localhost:1234")
        return test_cases.get_test_cases_lm_studio(endpoint, model, prompt)
    else:
        raise ValueError(f"Unknown provider: {provider}")


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/healthz")
async def healthz():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/threat-model")
async def generate_threat_model(req: ThreatModelRequest):
    try:
        prompt = threat_model.create_threat_model_prompt(
            app_type=req.app_type,
            authentication=req.authentication,
            internet_facing=req.internet_facing,
            sensitive_data=req.sensitive_data,
            app_input=req.app_input,
        )
        result = _dispatch_threat_model(req.provider, req.model or "gpt-4o", prompt)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/dread")
async def generate_dread(req: ThreatModelArrayRequest):
    try:
        prompt = dread.create_dread_prompt(req.threat_model)
        result = _dispatch_dread(req.provider, req.model or "gpt-4o", prompt)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/mitigations")
async def generate_mitigations(req: ThreatModelArrayRequest):
    try:
        prompt = mitigations.create_mitigations_prompt(req.threat_model)
        result = _dispatch_mitigations(req.provider, req.model or "gpt-4o", prompt)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/test-cases")
async def generate_test_cases(req: ThreatModelArrayRequest):
    try:
        prompt = test_cases.create_test_cases_prompt(req.threat_model)
        result = _dispatch_test_cases(req.provider, req.model or "gpt-4o", prompt)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))