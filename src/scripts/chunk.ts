import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadCatalog } from "../ingestion/catalog.ts";
import { extractPdf } from "../ingestion/extract.ts";
import { cleanDocument } from "../ingestion/clean.ts";
import { chunkDocument } from "../ingestion/chunk.ts";

const DOCS_DIR = "data/documents";
const CHUNKS_DIR = "data/chunks";

await mkdir(CHUNKS_DIR, { recursive: true });
const catalog = await loadCatalog();

for (const doc of catalog) {
    const pages = await extractPdf(path.join(DOCS_DIR, doc.file));
    const chunks = chunkDocument(doc.id, cleanDocument(pages));

    const sections = new Set(chunks.map((c) => c.section)).size;
    const lengths = chunks.map((c) => c.text.length);
    console.log(
        `📄 ${doc.id}: фрагментов ${chunks.length}, разделов ${sections}, ` +
            `длина ${Math.min(...lengths)}–${Math.max(...lengths)} символов`,
    );

    await writeFile(path.join(CHUNKS_DIR, `${doc.id}.json`), JSON.stringify(chunks, null, 4));
}
