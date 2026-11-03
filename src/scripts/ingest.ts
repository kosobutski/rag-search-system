import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config/index.ts";
import { loadCatalog } from "../ingestion/catalog.ts";
import type { Chunk } from "../ingestion/chunk.ts";
import { buildEmbeddingText } from "../ingestion/embeddingText.ts";
import { embed } from "../embeddings/index.ts";
import { recreateCollection, upsertChunks, type ChunkPayload } from "../vectorstore/index.ts";

const CHUNKS_DIR = "data/chunks";

const catalog = await loadCatalog();
const payloads: ChunkPayload[] = [];
const embeddingTexts: string[] = [];

for (const doc of catalog) {
    const chunks = JSON.parse(await readFile(path.join(CHUNKS_DIR, `${doc.id}.json`), "utf8")) as Chunk[];

    for (const chunk of chunks) {
        payloads.push({
            chunkId: chunk.id,
            docId: doc.id,
            title: doc.title,
            url: doc.url,
            quality: doc.quality,
            section: chunk.section,
            clause: chunk.clause,
            page: chunk.page,
            text: chunk.text,
        });
        embeddingTexts.push(buildEmbeddingText(doc, chunk));
    }
}

console.log(`Документов: ${catalog.length}, фрагментов: ${payloads.length}`);
console.log(`Считаю векторы (${config.models.embedding})...`);

const startedAt = Date.now();
const vectors = await embed(embeddingTexts, (done, total) => {
    process.stdout.write(`\r   ${done}/${total}`);
});
console.log(`\n   готово за ${((Date.now() - startedAt) / 1000).toFixed(1)} с`);

const vectorSize = vectors[0]?.length;
if (!vectorSize) {
    throw new Error("Нет ни одного вектора — проверь, что data/chunks не пустая (npm run chunk)");
}

await recreateCollection(vectorSize);
await upsertChunks(payloads.map((payload, i) => ({ payload, vector: vectors[i]! })));

console.log(`✅ Записано ${payloads.length} фрагментов в коллекцию "${config.qdrant.collection}"`);
