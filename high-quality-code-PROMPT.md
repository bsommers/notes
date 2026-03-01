To create a high-quality coding prompt for Claude 4.6 (Opus), you should leverage its ability to follow complex architectural patterns while providing it with clear "guardrails" using XML tags.

Based on the latest best practices, a "good" code prompt should include a **System Role**, **Contextual Documentation**, **Few-Shot Examples**, and a **Clear Action Trigger**.

---

## The "Master" Code Prompt Example

Below is a prompt designed to help you build a Python-based monitoring tool. Note how the technical requirements are separated from the data.

<system_prompt>
    You are an expert Backend Engineer specializing in Python and distributed systems. Your coding style is PEP 8 compliant, favors composition over inheritance, and includes comprehensive type hinting.
    <default_to_action>
</system_prompt>

<context>
    I am building a lightweight monitoring agent that needs to collect JMX metrics from a remote Java process and export them to a JSON file.
</context>

<documentation>
    <api_specs>
    The agent should use the `jxmlease` library to parse XML responses from the Jolokia agent.
    The target endpoint is `http://localhost:8080/jolokia/`.
    </api_specs>
</documentation>

<examples>
    <example>
    <description>How to format the output JSON</description>
        <code>
        {
        "timestamp": "2026-02-27T20:30:00Z",
        "metric_name": "HeapMemoryUsage",
        "value": 1024
        }
        </code>
    </example>
</examples>

<instructions>

    1. Write a Python script named `metrics_collector.py`.
    2. Implement a class-based structure.
    3. Include a method specifically for error handling if the connection to the Jolokia agent fails.
    4. Provide a quick summary of the work you've done after the code block.
    5. Format your response in plain text only for any mathematical explanations; do not use LaTeX.
</instructions>

<query>
    Please implement the `metrics_collector.py` script based on the documentation provided above.
</query>

---

## Why this prompt works for Claude 4.6

### 1. Structural Hierarchy

By placing the `<documentation>` and `<context>` at the top and the `<query>` at the very end, you prevent the "lost in the middle" phenomenon. Claude 4.6 processes the instructions better when the "ask" follows the "data."

### 2. Specificity over Aggression

The prompt uses direct verbs ("Write," "Implement," "Include") rather than aggressive language like "YOU MUST NOT FAIL." Claude 4.6 is highly responsive to the system prompt and does not require "shouting" to follow instructions.

### 3. Output Control

The prompt uses the instruction: *"Your response should be composed of smoothly flowing prose paragraphs"* (implied in the summary request) and explicitly requests the exclusion of LaTeX. This ensures the output is copy-paste ready for your terminal or IDE.

### 4. Role-Based Behavior

Setting the role as a "Backend Engineer" ensures that Claude doesn't just give you a "hello world" script, but rather a production-ready snippet with type hints and error handling.

Would you like me to generate a specific Python script using this prompt structure for a project you're working on?