import json
import re


def extract_deepseek_reasoning(response_text):
    """
    Extract reasoning and final output from DeepSeek R1 model response.
    """
    think_pattern = r"<think >(.*?)</think >"
    think_match = re.search(think_pattern, response_text, re.DOTALL)

    if think_match:
        reasoning = think_match.group(1).strip()
        final_output = re.sub(think_pattern, "", response_text, flags=re.DOTALL).strip()
        return reasoning, final_output
    return None, response_text


def process_groq_response(response_text, model_name, expect_json=True):
    """
    Process a Groq API response, handling special cases for different models.
    """
    reasoning = None
    final_output = response_text

    if model_name == "deepseek-r1-distill-llama-70b":
        reasoning, final_output = extract_deepseek_reasoning(response_text)

    if expect_json:
        try:
            processed_output = json.loads(final_output)
        except json.JSONDecodeError:
            processed_output = final_output
    else:
        if "graph " in final_output:
            processed_output = final_output
        else:
            processed_output = final_output

    return reasoning, processed_output


def create_reasoning_system_prompt(task_description, approach_description):
    """Creates a system prompt formatted for reasoning models."""
    return f"""Task: {task_description}

Approach:
{approach_description}"""