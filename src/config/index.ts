import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    OLLAMA_URL: z.url(),
    EMBEDDING_MODEL: z.string().min(1),
    LLM_MODEL: z.string().min(1),
    QDRANT_URL: z.url(),
    QDRANT_COLLECTION: z.string().min(1).default("guap_docs"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("Ошибка в настройках .env:\n" + z.prettifyError(parsed.error));
    process.exit(1);
}

const env = parsed.data;

export const config = {
    ollama: {
        url: env.OLLAMA_URL,
    },
    models: {
        embedding: env.EMBEDDING_MODEL,
        llm: env.LLM_MODEL,
    },
    qdrant: {
        url: env.QDRANT_URL,
        collection: env.QDRANT_COLLECTION,
    },
} as const;
