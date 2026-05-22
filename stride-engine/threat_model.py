"""
STRIDE Threat Model Generation — adapted from STRIDE-GPT for headless API usage.
All Streamlit (st.*) references removed. Multi-provider LLM support preserved.
"""
import json
import re

import requests
from anthropic import Anthropic
from google import genai as google_genai
from groq import Groq
from mistralai.client import Mistral
from openai import OpenAI

from utils import create_reasoning_system_prompt, process_groq_response


# ── Prompt builders ──────────────────────────────────────────────────────────

def create_llm_stride_prompt_section():
    return """
LLM-SPECIFIC THREAT CATEGORIES (OWASP Top 10 for LLM Applications 2025):
You MUST analyze threats from both traditional STRIDE categories AND the following LLM-specific threat categories. Map each LLM threat to its corresponding STRIDE category and include the OWASP_LLM code:

SPOOFING (Traditional + LLM):
- Traditional: Identity spoofing, credential theft
- LLM01 (Prompt Injection): Attacker crafts inputs that override system prompts or instructions, making the LLM impersonate other entities or bypass intended behavior
- LLM07 (System Prompt Leakage): Extraction of system prompts reveals intended identity/behavior, enabling more targeted spoofing

TAMPERING (Traditional + LLM):
- Traditional: Data modification, code injection
- LLM01 (Prompt Injection): Direct or indirect injection that manipulates LLM behavior or outputs
- LLM04 (Data and Model Poisoning): Malicious modification of training data, fine-tuning data, or embeddings
- LLM08 (Vector and Embedding Weaknesses): Manipulation of RAG data or embeddings to alter retrieval results

REPUDIATION (Traditional + LLM):
- Traditional: Denial of actions, log manipulation
- LLM09 (Misinformation): LLM generates false information that users act upon; difficult to attribute accountability
- Lack of audit trails for LLM decision-making and content generation

INFORMATION DISCLOSURE (Traditional + LLM):
- Traditional: Data leaks, unauthorized access
- LLM02 (Sensitive Information Disclosure): LLM reveals training data, PII, credentials, or proprietary information
- LLM07 (System Prompt Leakage): Exposure of confidential system instructions, business logic, or secrets embedded in prompts
- LLM08 (Vector and Embedding Weaknesses): Information leakage through embeddings or cross-tenant RAG data

DENIAL OF SERVICE (Traditional + LLM):
- Traditional: Resource exhaustion, service disruption
- LLM10 (Unbounded Consumption): Resource exhaustion through expensive queries, long contexts, or repeated requests
- LLM04 (Data and Model Poisoning): Model performance degradation through poisoned training data

ELEVATION OF PRIVILEGE (Traditional + LLM):
- Traditional: Privilege escalation, unauthorized access
- LLM05 (Improper Output Handling): LLM output passed to downstream systems without validation enables command injection, XSS, SSRF
- LLM06 (Excessive Agency): LLM granted excessive permissions or autonomy to perform actions
- LLM03 (Supply Chain): Compromised models, plugins, or dependencies introduce backdoors or malicious capabilities

CRITICAL LLM RISKS TO EVALUATE:
1. LLM01 - Prompt Injection
2. LLM02 - Sensitive Information Disclosure
3. LLM03 - Supply Chain
4. LLM04 - Data and Model Poisoning
5. LLM05 - Improper Output Handling
6. LLM06 - Excessive Agency
7. LLM07 - System Prompt Leakage
8. LLM08 - Vector and Embedding Weaknesses
9. LLM09 - Misinformation
10. LLM10 - Unbounded Consumption
"""


def create_agentic_stride_prompt_section():
    return """
ARCHITECTURAL PATTERN DETECTION:
Before generating threats, analyze the application description to detect which architectural patterns are present.

1. RAG / RETRIEVAL SYSTEMS
2. MULTI-AGENT SYSTEMS
3. CODE EXECUTION / SANDBOXING
4. TOOL/PLUGIN ECOSYSTEMS
5. PERSISTENT MEMORY / STATE
6. FINE-TUNED / CUSTOM MODELS

AGENTIC-SPECIFIC THREAT CATEGORIES (OWASP Top 10 for Agentic Applications):
You MUST analyze threats from both traditional STRIDE categories AND the following agentic-specific threat categories. Map each agentic threat to its corresponding STRIDE category and include the OWASP_ASI code.

CRITICAL AGENTIC RISKS TO EVALUATE:
1. ASI01 - Agent Goal Hijack
2. ASI02 - Tool Misuse
3. ASI03 - Identity/Privilege Abuse
4. ASI04 - Supply Chain
5. ASI05 - Code Execution
6. ASI06 - Memory Poisoning
7. ASI07 - Inter-Agent Communication
8. ASI08 - Cascading Failures
9. ASI09 - Human-Agent Trust
10. ASI10 - Rogue Agents
"""


def create_threat_model_prompt(app_type, authentication, internet_facing, sensitive_data, app_input):
    is_genai = app_type == "Generative AI application"
    is_agentic = app_type == "Agentic AI application"
    include_llm_risks = is_genai or is_agentic

    prompt = """Act as a cyber security expert with more than 20 years experience of using the STRIDE threat modelling methodology to produce comprehensive threat models for a wide range of applications. Your task is to analyze the provided code summary, README content, and application description to produce a list of specific threats for the application.

Pay special attention to the README content as it often provides valuable context about the project's purpose, architecture, and potential security considerations.

"""

    if is_agentic:
        prompt += """For this AGENTIC AI APPLICATION, you must consider traditional STRIDE threats, LLM-specific threats from the OWASP Top 10 for LLM Applications (LLM01-LLM10), AND agentic-specific threats from the OWASP Top 10 for Agentic Applications (ASI01-ASI10).\n\n"""
    elif is_genai:
        prompt += """For this GENERATIVE AI APPLICATION, you must consider both traditional STRIDE threats AND LLM-specific threats from the OWASP Top 10 for LLM Applications 2025 (LLM01-LLM10).\n\n"""
    else:
        prompt += """For each of the STRIDE categories (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege), list multiple (3 or 4) credible threats if applicable. """

    prompt += """Each threat scenario should provide a credible scenario in which the threat could occur in the context of the application. It is very important that your responses are tailored to reflect the details you are given.

"""

    if is_agentic:
        prompt += """When providing the threat model, use a JSON formatted response with the keys "threat_model" and "improvement_suggestions". Under "threat_model", include an array of objects with the keys "Threat Type", "Scenario", "Potential Impact", "OWASP_LLM" (the applicable LLM risk code, or null), and "OWASP_ASI" (the applicable Agentic Security Issue code, or null).\n\n"""
    elif is_genai:
        prompt += """When providing the threat model, use a JSON formatted response with the keys "threat_model" and "improvement_suggestions". Under "threat_model", include an array of objects with the keys "Threat Type", "Scenario", "Potential Impact", and "OWASP_LLM" (the applicable OWASP LLM risk code, or null if not applicable).\n\n"""
    else:
        prompt += """When providing the threat model, use a JSON formatted response with the keys "threat_model" and "improvement_suggestions". Under "threat_model", include an array of objects with the keys "Threat Type", "Scenario", and "Potential Impact".\n\n"""

    prompt += """Under "improvement_suggestions", include an array of strings that suggest what additional information or details the user could provide to make the threat model more comprehensive and accurate in the next iteration. Do not provide general security recommendations - focus only on what additional information would help create a better threat model.

"""

    prompt += f"""APPLICATION TYPE: {app_type}
AUTHENTICATION METHODS: {authentication}
INTERNET FACING: {internet_facing}
SENSITIVE DATA: {sensitive_data}
"""

    if include_llm_risks:
        prompt += create_llm_stride_prompt_section()
    if is_agentic:
        prompt += create_agentic_stride_prompt_section()

    prompt += f"""
CODE SUMMARY, README CONTENT, AND APPLICATION DESCRIPTION:
{app_input}

"""

    if is_agentic:
        prompt += """Example of expected JSON response format for Agentic AI applications:
    {
      "threat_model": [
        {
          "Threat Type": "Spoofing",
          "Scenario": "Example scenario",
          "Potential Impact": "Example impact",
          "OWASP_LLM": "LLM01",
          "OWASP_ASI": "ASI01"
        }
      ],
      "improvement_suggestions": ["suggestion1"]
    }
"""
    elif is_genai:
        prompt += """Example of expected JSON response format for Generative AI applications:
    {
      "threat_model": [
        {
          "Threat Type": "Tampering",
          "Scenario": "Example scenario",
          "Potential Impact": "Example impact",
          "OWASP_LLM": "LLM01"
        }
      ],
      "improvement_suggestions": ["suggestion1"]
    }
"""
    else:
        prompt += """Example of expected JSON response format:
    {
      "threat_model": [
        {
          "Threat Type": "Spoofing",
          "Scenario": "Example Scenario",
          "Potential Impact": "Example Impact"
        }
      ],
      "improvement_suggestions": ["suggestion1"]
    }
"""
    return prompt


# ── Provider functions ───────────────────────────────────────────────────────

def get_threat_model(api_key, model_name, prompt):
    """OpenAI / compatible provider."""
    client = OpenAI(api_key=api_key)

    if model_name in ["gpt-5.2", "gpt-5-mini", "gpt-5-nano", "gpt-5.2-pro", "gpt-5"]:
        system_prompt = create_reasoning_system_prompt(
            task_description="Analyze the provided application description and generate a comprehensive threat model using the STRIDE methodology.",
            approach_description="""1. Carefully read and understand the application description
2. For each component and data flow, identify STRIDE threats
3. For each identified threat, describe the specific scenario and potential impact
4. Generate improvement suggestions
5. Format the output as JSON""",
        )
        max_tokens = 20000 if model_name.startswith("gpt-5") else 8192
        response = client.chat.completions.create(
            model=model_name,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            max_completion_tokens=max_tokens,
        )
    else:
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


def get_threat_model_google(google_api_key, google_model, prompt):
    client = google_genai.Client(api_key=google_api_key)

    try:
        from google.genai import types as google_types

        config = google_types.GenerateContentConfig(
            response_mime_type="application/json",
        )

        response = client.models.generate_content(
            model=google_model, contents=prompt, config=config
        )

        response_text = response.text if hasattr(response, 'text') else ""
    except Exception as e:
        raise RuntimeError(f"Error generating content with Google AI: {e}") from e

    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        raise RuntimeError("Failed to parse JSON response from Google AI")


def get_threat_model_mistral(mistral_api_key, mistral_model, prompt):
    client = Mistral(api_key=mistral_api_key)
    response = client.chat.complete(
        model=mistral_model,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}],
    )
    return json.loads(response.choices[0].message.content)


def get_threat_model_ollama(ollama_endpoint, ollama_model, ollama_timeout, prompt):
    if not ollama_endpoint.endswith("/"):
        ollama_endpoint = ollama_endpoint + "/"

    url = ollama_endpoint + "api/generate"
    system_prompt = "You are a helpful assistant designed to output JSON."
    full_prompt = f"{system_prompt}\n\n{prompt}"
    data = {"model": ollama_model, "prompt": full_prompt, "stream": False, "format": "json"}

    response = requests.post(url, json=data, timeout=ollama_timeout)
    response.raise_for_status()
    outer_json = response.json()
    return json.loads(outer_json["response"])


def get_threat_model_anthropic(anthropic_api_key, anthropic_model, prompt):
    client = Anthropic(api_key=anthropic_api_key)

    response = client.messages.create(
        model=anthropic_model,
        max_tokens=32768,
        system="You are a helpful assistant designed to output JSON. Your response must be a valid, parseable JSON object with no additional text, markdown formatting, or explanation.",
        messages=[{"role": "user", "content": prompt}],
        timeout=300,
    )

    full_content = "".join(block.text for block in response.content if getattr(block, "text", None))

    try:
        if "```json" in full_content:
            full_content = re.sub(r"```json\s*", "", full_content)
            full_content = re.sub(r"```\s*$", "", full_content)
        elif "```" in full_content:
            full_content = re.sub(r"```\s*", "", full_content)
        full_content = full_content.strip()
        return json.loads(full_content)
    except json.JSONDecodeError:
        return {
            "threat_model": [
                {
                    "Threat Type": "Error",
                    "Scenario": "Failed to parse Claude response",
                    "Potential Impact": "Unable to generate threat model",
                }
            ],
            "improvement_suggestions": ["Try again — model sometimes returns properly formatted response on subsequent attempts"],
        }


def get_threat_model_lm_studio(lm_studio_endpoint, model_name, prompt, api_key="not-needed"):
    client = OpenAI(
        base_url=f"{lm_studio_endpoint}/v1",
        api_key=api_key,
    )
    response = client.chat.completions.create(
        model=model_name,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "You are a helpful assistant designed to output JSON."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=4000,
    )
    return json.loads(response.choices[0].message.content)


def get_threat_model_groq(groq_api_key, groq_model, prompt):
    client = Groq(api_key=groq_api_key)
    response = client.chat.completions.create(
        model=groq_model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "You are a helpful assistant designed to output JSON."},
            {"role": "user", "content": prompt},
        ],
    )
    reasoning, response_content = process_groq_response(
        response.choices[0].message.content, groq_model, expect_json=True
    )
    return response_content