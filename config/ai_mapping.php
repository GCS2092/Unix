<?php

return [
    // anthropic | openai  ("openai" = tout service compatible OpenAI : Ollama, Groq, Gemini, OpenRouter, Mistral...)
    'provider' => env('AI_MAPPING_PROVIDER', 'anthropic'),

    // Fournisseur "anthropic"
    'key' => env('ANTHROPIC_API_KEY'),

    // Fournisseur "openai" (cle facultative pour Ollama)
    'base_url' => env('AI_MAPPING_BASE_URL'),
    'api_key' => env('AI_MAPPING_API_KEY'),

    'model' => env('AI_MAPPING_MODEL', 'claude-sonnet-5-5'),
    'timeout' => (int) env('AI_MAPPING_TIMEOUT', 90),
];