import { readdir } from "node:fs/promises";
import { extractPdf } from "../ingestion/extract";
import path from "node:path";

const DOCS_DIR = 'data/documents';

const files = (await readdir(DOCS_DIR)).filter(f => f.endsWith('.pdf'));

for (const file of files) {
    const pages = await extractPdf(path.join(DOCS_DIR, file));
    const totalChars = pages.reduce((sum, p) => sum + p.length, 0);
    const emptyPages = pages.filter((p) => p.trim().length < 50).length;

    console.log(`\n📄 ${file}`);
    console.log(`   страниц: ${pages.length}, символов: ${totalChars}, почти пустых страниц: ${emptyPages}`);
    console.log(`   начало: ${pages.find((p) => p.trim().length > 50)?.slice(0, 300).replace(/\s+/g, " ")}`);
}