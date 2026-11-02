import { Ollama } from "ollama";
import { QdrantClient } from "@qdrant/js-client-rest";
import { config } from "../config/index.ts";

const ollama = new Ollama({ host: config.ollama.url });
const qdrant = new QdrantClient({ url: config.qdrant.url });

const embedding = await ollama.embed({
    model: config.models.embedding,
    input: "Порядок пересдачи экзаменов",
});
console.log(`✅ Эмбеддинги (${config.models.embedding}): вектор размером ${embedding.embeddings[0]?.length}`);

const chat = await ollama.chat({
    model: config.models.llm,
    messages: [{ role: "user", content: "Ответь одним словом: столица Польши?" }],
});
console.log(`✅ LLM (${config.models.llm}): ${chat.message.content.trim()}`);

const { collections } = await qdrant.getCollections();
console.log(`✅ Qdrant: коллекций ${collections.length}`);
