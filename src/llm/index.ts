import { Ollama } from "ollama";
import { config } from "../config/index.ts";

export type ChatMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};

// Параметры генерации — свои названия, чтобы не зависеть от конкретного API (Ollama, GigaChat)
export type LlmOptions = {
    temperature: number;
    topP: number;
    topK: number;
    maxTokens: number;
    contextSize: number;
    seed: number;
};

export const DEFAULT_LLM_OPTIONS: LlmOptions = {
    temperature: 0.3, // мало "фантазии", но не 0 — иначе Qwen склонен к повторам
    topP: 0.8, // рекомендация разработчиков Qwen3-Instruct-2507
    topK: 20, // то же
    maxTokens: 800, // краткий ответ; защита от зацикливания
    contextSize: 8192, // без этого Ollama молча обрежет длинный промпт
    seed: 42, // воспроизводимость экспериментов
};

const ollama = new Ollama({ host: config.ollama.url });

export const generate = async (
    messages: ChatMessage[],
    options: Partial<LlmOptions> = {},
    onToken?: (token: string) => void,
): Promise<string> => {
    const opts = { ...DEFAULT_LLM_OPTIONS, ...options };

    const stream = await ollama.chat({
        model: config.models.llm,
        messages,
        stream: true,
        options: {
            temperature: opts.temperature,
            top_p: opts.topP,
            top_k: opts.topK,
            num_predict: opts.maxTokens,
            num_ctx: opts.contextSize,
            seed: opts.seed,
        },
    });

    let answer = "";
    for await (const part of stream) {
        const token = part.message.content;
        answer += token;
        onToken?.(token);
    }
    return answer;
};
