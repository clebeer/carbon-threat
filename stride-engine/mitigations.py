"""
Mitigations Generation — adapted from STRIDE-GPT for headless API usage.
All Streamlit (st.*) references removed.
"""
import json
import re

import requests
from anthropic import Anthropic
from google import genai as google_genai
from groq import Groq
from mistralai.client import Mistral
from openai import OpenAI

from utils import process_groq_response


def create_mitigations_prompt(threat_model):
    prompt = """Act as a cyber security expert with more than 20 years experience of providing security mitigations for a wide range of applications.

You are provided with a threat model and must provide specific, actionable mitigations for each threat identified.

"""
    prompt += "THREAT MODEL:\n"
    for i, threat in enumerate(threat_model):
        prompt += f"\n{i+1}. Threat Type: {threat.get('Threat Type', 'Unknown')}\n"
        prompt += f"   Scenario: {threat.get('Scenario', 'N/A')}\n"
        prompt += f"   Potential Impact: {threat.get('Potential Impact', 'N/A')}\n"

    prompt += """

Provide your mitigations as a JSON object with the key "mitigations" containing an array of objects, each with:
- "Threat Type": the threat type
- "Scenario": the scenario
- "Mitigations": an array of specific, actionable mitigation strings

Example format:
{
  "mitigations": [
    {
      "Threat Type": "Spoofing",
      "Scenario": "Example scenario",
      "Mitigations": [
        "Implement multi-factor authentication",
        "Use certificate-based authentication"
      ]
    }
  ]
}
"""
    return prompt


# ── Provider functions ───────────────────────────────────────────────────────

def get_mitigations(api_key, model_name, prompt):
    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=model_name,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "You are a helpful assistant designed to output JSON."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=8192,
    )
    content = response.choices[0].message.content
    if not content:
        raise ValueError(f"Empty response from model {model_name}")
    return json.loads(content)


def get_mitigations_google(google_api_key, google_model, prompt):
    client = google_genai.Client(api_key=google_api_key)
    from google.genai import types as google_types
    config = google_types.GenerateContentConfig(response_mime_type="application/json")
    response = client.models.generate_content(model=google_model, contents=prompt, config=config)
    return json.loads(response.text)


def get_mitigations_mistral(mistral_api_key, mistral_model, prompt):
    client = Mistral(api_key=mistral_api_key)
    response = client.chat.complete(
        model=mistral_model,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}],
    )
    return json.loads(response.choices[0].message.content)


def get_mitigations_ollama(ollama_endpoint, ollama_model, ollama_timeout, prompt):
    if not ollama_endpoint.endswith("/"):
        ollama_endpoint += "/"
    url = ollama_endpoint + "api/generate"
    full_prompt = "You are a helpful assistant designed to output JSON.\n\n" + prompt
    data = {"model": ollama_model, "prompt": full_prompt, "stream": False, "format": "json"}
    response = requests.post(url, json=data, timeout=ollama_timeout)
    response.raise_for_status()
    return json.loads(response.json()["response"])


def get_mitigations_anthropic(anthropic_api_key, anthropic_model, prompt):
    client = Anthropic(api_key=anthropic_api_key)
    response = client.messages.create(
        model=anthropic_model,
        max_tokens=32768,
        system="You are a helpful assistant designed to output JSON.",
        messages=[{"role": "user", "content": prompt}],
        timeout=300,
    )
    full_content = "".join(block.text for block in response.content if getattr(block, "text", None))
    full_content = full_content.strip()
    if "```json" in full_content:
        full_content = re.sub(r"```json\s*", "", full_content)
        full_content = re.sub(r"```\s*$", "", full_content)
    return json.loads(full_content)


def get_mitigations_lm_studio(lm_studio_endpoint, model_name, prompt, api_key="not-needed"):
    client = OpenAI(base_url=f"{lm_studio_endpoint}/v1", api_key=api_key)
    response = client.chat.completions.create(
        model=model_name,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "You are a helpful assistant designed to output JSON."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=8192,
    )
    return json.loads(response.choices[0].message.content)


def get_mitigations_groq(groq_api_key, groq_model, prompt):
    client = Groq(api_key=groq_api_key)
    response = client.chat.completions.create(
        model=groq_model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "You are a helpful assistant designed to output JSON."},
            {"role": "user", "content": prompt},
        ],
    )
    _, response_content = process_groq_response(response.choices[0].message.content, groq_model, expect_json=True)
    return response_content