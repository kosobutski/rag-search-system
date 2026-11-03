import type { DocumentMeta } from "./catalog.ts";
import type { Chunk } from "./chunk.ts";

// Текст, по которому строится вектор: название документа + раздел + сам пункт.
// Без контекста короткий пункт вроде "6.10.5. Игра в карты" непонятно о чём.
export const buildEmbeddingText = (doc: DocumentMeta, chunk: Chunk): string =>
    [doc.title, chunk.section, chunk.text].filter(Boolean).join("\n");
