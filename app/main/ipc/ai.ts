import { ipcMain } from "electron";

interface AiMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

interface AiPayload {
    provider: "openrouter" | "openai" | "anthropic";
    apiKey: string;
    model: string;
    messages: AiMessage[];
    temperature?: number;
    maxTokens?: number;
}

async function fetchOpenRouter(apiKey: string, model: string, messages: AiMessage[], temperature: number, maxTokens: number) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://codemotion.app",
            "X-Title": "CodeMotion IDE"
        },
        body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            include_reasoning: true,
            transforms: ["middle-out"]
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenRouter ${response.status}: ${err}`);
    }

    return await response.json();
}

async function fetchOpenAI(apiKey: string, model: string, messages: AiMessage[], temperature: number, maxTokens: number) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI ${response.status}: ${err}`);
    }

    return await response.json();
}

async function fetchAnthropic(apiKey: string, model: string, messages: AiMessage[], temperature: number, maxTokens: number) {
    const systemMsg = messages.find(m => m.role === "system")?.content || "";
    const otherMessages = messages.filter(m => m.role !== "system").map(m => ({
        role: m.role,
        content: m.content
    }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
            model,
            system: systemMsg,
            messages: otherMessages,
            temperature,
            max_tokens: maxTokens,
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Anthropic ${response.status}: ${err}`);
    }

    return await response.json();
}

ipcMain.handle("ai-chat", async (_event, payload: AiPayload) => {
    try {
        let result: any;
        const temp = payload.temperature ?? 0.7;
        const maxTokens = payload.maxTokens ?? 4096;

        switch (payload.provider) {
            case "openrouter":
                result = await fetchOpenRouter(payload.apiKey, payload.model, payload.messages, temp, maxTokens);
                break;
            case "openai":
                result = await fetchOpenAI(payload.apiKey, payload.model, payload.messages, temp, maxTokens);
                break;
            case "anthropic":
                result = await fetchAnthropic(payload.apiKey, payload.model, payload.messages, temp, maxTokens);
                break;
            default:
                throw new Error("Unknown provider");
        }

        let content = "";
        let reasoning = "";
        if (payload.provider === "anthropic") {
            content = result.content?.[0]?.text || "";
        } else {
            content = result.choices?.[0]?.message?.content || "";
            reasoning = result.choices?.[0]?.message?.reasoning || "";
        }

        // Prepend reasoning if present (OpenRouter models like Cohere North Mini Code)
        if (reasoning && !content.startsWith(reasoning)) {
            content = reasoning + (content ? "\n\n" + content : "");
        }

        return {
            success: true,
            content,
            raw: result
        };
    } catch (error: unknown) {
        return {
            success: false,
            error: String(error)
        };
    }
});

ipcMain.handle("ai-get-models", async () => {
    return {
        openrouter: [
            { id: "anthropic/claude-opus-4.8", name: "Claude Opus 4.8" },
            { id: "anthropic/claude-sonnet-4.6", name: "Claude Sonnet 4.6" },
            { id: "openai/gpt-5.5", name: "GPT-5.5" },
            { id: "openai/gpt-5.5-pro", name: "GPT-5.5 Pro" },
            { id: "openai/gpt-5", name: "GPT-5" },
            { id: "openai/o4-mini", name: "o4-mini" },
            { id: "google/gemini-3.5-pro", name: "Gemini 3.5 Pro" },
            { id: "google/gemini-3.5-flash", name: "Gemini 3.5 Flash" },
            { id: "google/gemini-3.1-pro", name: "Gemini 3.1 Pro" },
            { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
            { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
            { id: "xai/grok-4.3", name: "Grok 4.3" },
            { id: "moonshotai/kimi-k2.6", name: "Kimi K2.6" },
            { id: "meta-llama/llama-4", name: "Llama 4" },
            { id: "deepseek/deepseek-v4-pro", name: "DeepSeek V4 Pro" },
            { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash" },
            { id: "mistralai/mistral-large-3", name: "Mistral Large 3" },
            { id: "cohere/north-mini-code:free", name: "Cohere North Mini Code" },
        ],
        openai: [
            { id: "gpt-5.5", name: "GPT-5.5" },
            { id: "gpt-5.5-pro", name: "GPT-5.5 Pro" },
            { id: "gpt-5", name: "GPT-5" },
            { id: "o4-mini", name: "o4-mini" },
            { id: "o3", name: "o3" },
            { id: "gpt-4o", name: "GPT-4o" },
        ],
        anthropic: [
            { id: "claude-opus-4.8", name: "Claude Opus 4.8" },
            { id: "claude-opus-4.7", name: "Claude Opus 4.7" },
            { id: "claude-sonnet-4.6", name: "Claude Sonnet 4.6" },
            { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
        ]
    };
});
