import { createHash } from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import { config } from "../config/index.ts";

// Паспорт фрагмента, который хранится в Qdrant рядом с вектором
export type ChunkPayload = {
    chunkId: string;
    docId: string;
    title: string;
    url: string;
    quality: "clean" | "ocr";
    section: string | null;
    clause: string | null;
    page: number;
    text: string;
};

export type SearchResult = {
    score: number;
    payload: ChunkPayload;
};

const client = new QdrantClient({ url: config.qdrant.url });
const collection = config.qdrant.collection;

// Сколько точек отправляем в Qdrant за один запрос
const UPSERT_BATCH_SIZE = 64;

// Qdrant принимает ID только как число или UUID, поэтому делаем UUID из id чанка.
// Из одного и того же id всегда получается один и тот же UUID.
const toPointId = (chunkId: string): string => {
    const hex = createHash("md5").update(chunkId).digest("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const recreateCollection = async (vectorSize: number): Promise<void> => {
    const { exists } = await client.collectionExists(collection);
    if (exists) {
        await client.deleteCollection(collection);
    }

    await client.createCollection(collection, {
        vectors: { size: vectorSize, distance: "Cosine" },
    });
    // Индекс по документу — пригодится для фильтров "искать только в таком-то положении"
    await client.createPayloadIndex(collection, {
        field_name: "docId",
        field_schema: "keyword",
        wait: true,
    });
};

export const upsertChunks = async (items: { payload: ChunkPayload; vector: number[] }[]): Promise<void> => {
    for (let i = 0; i < items.length; i += UPSERT_BATCH_SIZE) {
        const batch = items.slice(i, i + UPSERT_BATCH_SIZE);
        await client.upsert(collection, {
            wait: true,
            points: batch.map(({ payload, vector }) => ({
                id: toPointId(payload.chunkId),
                vector,
                payload,
            })),
        });
    }
};

export const searchChunks = async (vector: number[], limit = 5): Promise<SearchResult[]> => {
    const { points } = await client.query(collection, {
        query: vector,
        limit,
        with_payload: true,
    });

    return points.map((point) => ({
        score: point.score,
        payload: point.payload as ChunkPayload,
    }));
};
