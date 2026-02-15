export var AIProvider = {
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
    OLLAMA: 'ollama',
    OPENROUTER: 'openrouter',
    ZAI: 'zai'
};
export var AIRole = {
    USER: 'user',
    ASSISTANT: 'assistant',
    SYSTEM: 'system',
    TOOL: 'tool'
};
export var PREDEFINED_MODELS = {
    openai: [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
    ],
    anthropic: [
        { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet' },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
    ],
    openrouter: [
        { id: 'mistralai/mistral-small-24b-instruct-2501', name: 'Mistral Small 24B' },
        { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B' },
        { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B' },
        { id: 'mistralai/mistral-nemo', name: 'Mistral Nemo' },
        { id: 'mistralai/ministral-3b', name: 'Ministral 3B' },
        { id: 'x-ai/grok-4.1-fast', name: 'Grok 4.1 Fast' }
    ],
    ollama: [
        { id: 'llama3', name: 'Llama 3' },
        { id: 'mistral', name: 'Mistral' },
        { id: 'phi3', name: 'Phi-3' }
    ],
    zai: [
        { id: 'GLM-4.7', name: 'GLM-4.7' },
        { id: 'GLM-4.6', name: 'GLM-4.6' },
        { id: 'GLM-4.5', name: 'GLM-4.5' },
        { id: 'GLM-4-32B-0414-128K', name: 'GLM-4-32B-0414-128K' }
    ]
};
//# sourceMappingURL=ai.js.map