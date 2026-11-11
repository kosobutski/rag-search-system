import { config } from "../config/index.ts";
import { answerQuestion } from "../rag/answer.ts";

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
    console.error('Использование: npm run ask -- "твой вопрос"');
    process.exit(1);
}

const seconds = (ms: number): string => (ms / 1000).toFixed(1);

console.log(`🔎 ${question}`);
console.log(`💬 ${config.models.llm} отвечает...\n`);

const result = await answerQuestion(question, (token) => process.stdout.write(token));

if (result.status === "notFound") {
    console.log("В документах не найдено ответа на этот вопрос.");
    console.log(`   (лучшее совпадение ${result.bestScore?.toFixed(3) ?? "—"}, ниже порога)`);
    console.log(`\n⏱ поиск ${seconds(result.retrievalMs)} с`);
    process.exit(0);
}

console.log("\n");
if (result.sources.length > 0) {
    console.log("📚 Источники:");
    for (const source of result.sources) {
        const clause = source.clause ? `, п. ${source.clause}` : "";
        console.log(`[${source.number}] ${source.title} (${source.docId})${clause}, стр. ${source.page}`);
        console.log(`    ${source.url}`);
    }
}
for (const warning of result.warnings) {
    console.log(`⚠️ ${warning}`);
}
console.log(`\n⏱ поиск ${seconds(result.retrievalMs)} с, ответ ${seconds(result.generationMs)} с`);
