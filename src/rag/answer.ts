import { embedOne } from "../embeddings/index.ts";
import { generate } from "../llm/index.ts";
import { searchChunks, type SearchResult } from "../vectorstore/index.ts";
import { buildMessages, NO_ANSWER_PHRASE } from "./prompt.ts";

// Сколько фрагментов ищем
const TOP_K = 5;
// Если лучший фрагмент похож слабее — ответа в базе нет, модель не вызываем.
// Подобрано на тестах: вопросы не по теме дают до ~0.44, по теме — от ~0.52.
const MIN_SCORE = 0.47;
// Фрагменты, которые хуже лучшего больше чем на столько, в контекст не берём
const MAX_SCORE_GAP = 0.1;

export type Source = {
    number: number;
    docId: string;
    title: string;
    clause: string | null;
    page: number;
    url: string;
    score: number;
};

export type AnswerResult =
    | {
          status: "notFound";
          bestScore: number | null;
          retrievalMs: number;
      }
    | {
          status: "answered";
          answer: string;
          sources: Source[];
          warnings: string[];
          retrievalMs: number;
          generationMs: number;
      };

// Ссылки вида [1], [2], а также [1, 3] и [1; 3]
const CITATION_RE = /\[(\d+(?:\s*[,;]\s*\d+)*)\]/g;

// Находит ссылки в ответе, убирает несуществующие и приводит [1, 3] к виду [1][3]
const processCitations = (answer: string, fragmentCount: number) => {
    const cited = new Set<number>();
    const invalid = new Set<number>();

    const text = answer.replace(CITATION_RE, (_match, inner: string) => {
        const numbers = inner.split(/[,;]/).map((n) => Number.parseInt(n.trim(), 10));
        const valid = numbers.filter((n) => n >= 1 && n <= fragmentCount);
        numbers.filter((n) => !valid.includes(n)).forEach((n) => invalid.add(n));
        valid.forEach((n) => cited.add(n));
        return valid.map((n) => `[${n}]`).join("");
    });

    // Строки, состоящие только из ссылок ("[1][2][3]" в конце ответа), не несут смысла
    const cleaned = text
        .split("\n")
        .filter((line) => !/^\s*(\[\d+\]\s*)+$/.test(line))
        .join("\n")
        .trim();

    return { text: cleaned, cited, invalid };
};

const toSource = ({ score, payload }: SearchResult, number: number): Source => ({
    number,
    docId: payload.docId,
    title: payload.title,
    clause: payload.clause,
    page: payload.page,
    url: payload.url,
    score,
});

export const answerQuestion = async (
    question: string,
    onToken?: (token: string) => void,
): Promise<AnswerResult> => {
    // R — поиск
    const retrievalStart = Date.now();
    const results = await searchChunks(await embedOne(question), TOP_K);
    const retrievalMs = Date.now() - retrievalStart;

    const bestScore = results[0]?.score ?? null;
    if (bestScore === null || bestScore < MIN_SCORE) {
        return { status: "notFound", bestScore, retrievalMs };
    }
    const fragments = results.filter((r) => r.score >= bestScore - MAX_SCORE_GAP);

    // A — фрагменты в промпт
    const messages = buildMessages(question, fragments);

    // G — генерация
    const generationStart = Date.now();
    const rawAnswer = await generate(messages, {}, onToken);
    const generationMs = Date.now() - generationStart;

    // Проверка ссылок и сборка источников
    const { text, cited, invalid } = processCitations(rawAnswer, fragments.length);
    const warnings: string[] = [];
    if (invalid.size > 0) {
        warnings.push(`Модель сослалась на несуществующие фрагменты: ${[...invalid].map((n) => `[${n}]`).join(", ")}`);
    }
    if (cited.size === 0 && !text.includes(NO_ANSWER_PHRASE)) {
        warnings.push("Ответ не содержит ссылок на источники");
    }

    const sources = [...cited]
        .sort((a, b) => a - b)
        .map((n) => toSource(fragments[n - 1]!, n));

    return { status: "answered", answer: text, sources, warnings, retrievalMs, generationMs };
};
