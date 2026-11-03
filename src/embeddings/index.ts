import { Ollama } from "ollama";
import { config } from "../config/index.ts";

const ollama = new Ollama({ host: config.ollama.url });

// Сколько текстов отправляем в модель за один запрос
const BATCH_SIZE = 16;

export const embed = async (
    texts: string[],
    onProgress?: (done: number, total: number) => void,
): Promise<number[][]> => {
    const vectors: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);
        const response = await ollama.embed({ model: config.models.embedding, input: batch });
        vectors.push(...response.embeddings);
        onProgress?.(vectors.length, texts.length);
    }

    return vectors;
};

export const embedOne = async (text: string): Promise<number[]> => {
    const [vector] = await embed([text]);
    if (!vector) {
        throw new Error("Модель эмбеддингов не вернула вектор");
    }
    return vector;
};
