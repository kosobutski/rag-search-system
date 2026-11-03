import { embedOne } from "../embeddings/index.ts";
import { searchChunks } from "../vectorstore/index.ts";

const TOP_K = 5;

const query = process.argv.slice(2).join(" ").trim();
if (!query) {
    console.error('Использование: npm run search -- "твой вопрос"');
    process.exit(1);
}

const vector = await embedOne(query);
const results = await searchChunks(vector, TOP_K);

console.log(`🔎 ${query}\n`);
for (const { score, payload } of results) {
    console.log(`${score.toFixed(3)}  ${payload.docId}, п. ${payload.clause ?? "—"}, стр. ${payload.page}`);
    console.log(`       ${payload.text.slice(0, 250).replace(/\s+/g, " ")}...\n`);
}
