"""
Tests for STRIDE Engine FastAPI service.
Uses httpx AsyncClient with pytest-asyncio (or sync httpx in TestClient).
"""
import os
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Set token before importing the app so the module-level var picks it up
os.environ["STRIDE_ENGINE_TOKEN"] = "test-secret-token"

from service import app

client = TestClient(app)


class TestHealthz:
    def test_healthz_returns_ok(self):
        resp = client.get("/healthz")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["version"] == "1.0.0"


class TestAuth:
    def test_post_without_token_returns_403(self):
        resp = client.post("/threat-model", json={
            "provider": "ollama",
            "model": "llama3",
            "app_input": "test"
        })
        assert resp.status_code == 403

    def test_post_with_wrong_token_returns_403(self):
        resp = client.post("/threat-model",
            json={"provider": "ollama", "model": "llama3", "app_input": "test"},
            headers={"x-internal-token": "wrong-token"}
        )
        assert resp.status_code == 403


class TestThreatModel:
    @patch("threat_model.get_threat_model_ollama")
    def test_threat_model_ollama_success(self, mock_ollama):
        mock_ollama.return_value = {
            "threat_model": [
                {
                    "Threat Type": "Spoofing",
                    "Scenario": "Test scenario",
                    "Potential Impact": "Test impact",
                }
            ],
            "improvement_suggestions": ["Add more detail"]
        }

        resp = client.post("/threat-model",
            json={
                "provider": "ollama",
                "model": "llama3",
                "app_type": "Traditional application",
                "authentication": "JWT",
                "internet_facing": "Yes",
                "sensitive_data": "Yes",
                "app_input": "A web application with user authentication"
            },
            headers={"x-internal-token": "test-secret-token"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "threat_model" in data
        assert len(data["threat_model"]) == 1
        assert data["threat_model"][0]["Threat Type"] == "Spoofing"
        assert "improvement_suggestions" in data

    @patch("threat_model.get_threat_model_ollama")
    def test_threat_model_ollama_error(self, mock_ollama):
        mock_ollama.side_effect = Exception("Ollama connection refused")

        resp = client.post("/threat-model",
            json={
                "provider": "ollama",
                "model": "llama3",
                "app_input": "test"
            },
            headers={"x-internal-token": "test-secret-token"}
        )
        assert resp.status_code == 502

    def test_threat_model_unknown_provider(self):
        resp = client.post("/threat-model",
            json={
                "provider": "nonexistent",
                "model": "test",
                "app_input": "test"
            },
            headers={"x-internal-token": "test-secret-token"}
        )
        assert resp.status_code == 502


class TestDread:
    @patch("dread.get_dread_assessment_ollama")
    def test_dread_ollama_success(self, mock_ollama):
        mock_ollama.return_value = {
            "Risk Assessment": [
                {
                    "Threat Type": "Spoofing",
                    "Scenario": "Test",
                    "Damage Potential": 8,
                    "Reproducibility": 7,
                    "Exploitability": 6,
                    "Affected Users": 9,
                    "Discoverability": 5,
                    "Risk Score": 7.0
                }
            ]
        }

        resp = client.post("/dread",
            json={
                "provider": "ollama",
                "model": "llama3",
                "threat_model": [
                    {"Threat Type": "Spoofing", "Scenario": "Test", "Potential Impact": "Impact"}
                ]
            },
            headers={"x-internal-token": "test-secret-token"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "Risk Assessment" in data


class TestMitigations:
    @patch("mitigations.get_mitigations_ollama")
    def test_mitigations_ollama_success(self, mock_ollama):
        mock_ollama.return_value = {
            "mitigations": [
                {
                    "Threat Type": "Spoofing",
                    "Scenario": "Test",
                    "Mitigations": ["Use MFA", "Implement certificate-based auth"]
                }
            ]
        }

        resp = client.post("/mitigations",
            json={
                "provider": "ollama",
                "model": "llama3",
                "threat_model": [
                    {"Threat Type": "Spoofing", "Scenario": "Test", "Potential Impact": "Impact"}
                ]
            },
            headers={"x-internal-token": "test-secret-token"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "mitigations" in data


class TestTestCases:
    @patch("test_cases.get_test_cases_ollama")
    def test_cases_ollama_success(self, mock_ollama):
        mock_ollama.return_value = {
            "test_cases": [
                {
                    "Threat Type": "Spoofing",
                    "Scenario": "Test",
                    "Test Cases": [
                        {"name": "Auth bypass test", "description": "Try invalid credentials"}
                    ]
                }
            ]
        }

        resp = client.post("/test-cases",
            json={
                "provider": "ollama",
                "model": "llama3",
                "threat_model": [
                    {"Threat Type": "Spoofing", "Scenario": "Test", "Potential Impact": "Impact"}
                ]
            },
            headers={"x-internal-token": "test-secret-token"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "test_cases" in data


class TestPromptBuilders:
    def test_create_threat_model_prompt_traditional(self):
        from threat_model import create_threat_model_prompt
        prompt = create_threat_model_prompt(
            app_type="Traditional application",
            authentication="JWT",
            internet_facing="Yes",
            sensitive_data="Yes",
            app_input="A web application"
        )
        assert "Traditional application" in prompt
        assert "JWT" in prompt
        assert "JSON" in prompt

    def test_create_threat_model_prompt_genai(self):
        from threat_model import create_threat_model_prompt
        prompt = create_threat_model_prompt(
            app_type="Generative AI application",
            authentication="API Key",
            internet_facing="Yes",
            sensitive_data="Yes",
            app_input="An LLM chatbot"
        )
        assert "OWASP_LLM" in prompt
        assert "LLM01" in prompt

    def test_create_threat_model_prompt_agentic(self):
        from threat_model import create_threat_model_prompt
        prompt = create_threat_model_prompt(
            app_type="Agentic AI application",
            authentication="OAuth2",
            internet_facing="Yes",
            sensitive_data="Yes",
            app_input="An AI agent system"
        )
        assert "OWASP_ASI" in prompt
        assert "ASI01" in prompt

    def test_create_dread_prompt(self):
        from dread import create_dread_prompt
        prompt = create_dread_prompt([
            {"Threat Type": "Spoofing", "Scenario": "Test", "Potential Impact": "Impact"}
        ])
        assert "DREAD" in prompt
        assert "Spoofing" in prompt

    def test_create_mitigations_prompt(self):
        from mitigations import create_mitigations_prompt
        prompt = create_mitigations_prompt([
            {"Threat Type": "Tampering", "Scenario": "Test", "Potential Impact": "Impact"}
        ])
        assert "Mitigations" in prompt
        assert "Tampering" in prompt

    def test_create_test_cases_prompt(self):
        from test_cases import create_test_cases_prompt
        prompt = create_test_cases_prompt([
            {"Threat Type": "DoS", "Scenario": "Test", "Potential Impact": "Impact"}
        ])
        assert "Test Cases" in prompt