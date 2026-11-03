import type { Paragraph } from "./clean.ts";

export type Chunk = {
    id: string;
    docId: string;
    section: string | null;
    clause: string | null;
    page: number;
    text: string;
};

const MAX_CHUNK_LENGTH = 1500;

// "4.2." / "4.2.1" — пункт; "4." — раздел или пункт верхнего уровня.
// Части номера не начинаются с нуля, чтобы время "8.00" не считалось пунктом.
const CLAUSE_RE = /^(\d{1,2}(?:\.[1-9]\d?){1,3})\.?\s/;
const TOP_LEVEL_RE = /^(\d{1,2})\.\s/;
// Заголовок без точки после номера: "1 ОБЛАСТЬ ПРИМЕНЕНИЯ"
const HEADING_NO_DOT_RE = /^\d{1,2}\s+[А-ЯЁ]/;

const isUpperCase = (text: string): boolean => {
    const letters = text.replace(/[^а-яёa-z]/gi, "");
    const upper = letters.replace(/[^А-ЯЁA-Z]/g, "");
    return letters.length > 0 && upper.length / letters.length > 0.7;
};

// Короткая строка без точки в конце: "4. ПРОМЕЖУТОЧНАЯ АТТЕСТАЦИЯ", "2. Возникновение отношений",
// "1 ОБЛАСТЬ ПРИМЕНЕНИЯ" — заголовок раздела
const isSectionHeading = (text: string): boolean =>
    text.length <= 150 &&
    !/[.;:,]$/.test(text) &&
    (TOP_LEVEL_RE.test(text) || (HEADING_NO_DOT_RE.test(text) && isUpperCase(text)));

// Делит слишком длинный текст по абзацам, а слишком длинные абзацы — по предложениям
// Каждая часть получает страницу своего первого абзаца
const splitLongText = (paragraphs: Paragraph[]): Paragraph[] => {
    const pieces = paragraphs.flatMap((p) =>
        p.text.length <= MAX_CHUNK_LENGTH
            ? [p]
            : (p.text.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) ?? [p.text]).map((text) => ({ text, page: p.page })),
    );

    const parts: Paragraph[] = [];
    let current: Paragraph | null = null;
    for (const piece of pieces) {
        if (current && current.text.length + piece.text.length > MAX_CHUNK_LENGTH) {
            parts.push(current);
            current = null;
        }
        current = current ? { text: current.text + "\n" + piece.text, page: current.page } : { ...piece };
    }
    if (current) {
        parts.push(current);
    }
    return parts
        .map((part) => ({ text: part.text.trim(), page: part.page }))
        .filter((part) => part.text.length > 0);
};

type Draft = {
    section: string | null;
    clause: string | null;
    paragraphs: Paragraph[];
};

export const chunkDocument = (docId: string, paragraphs: Paragraph[]): Chunk[] => {
    const chunks: Chunk[] = [];
    let section: string | null = null;
    let draft: Draft | null = null;

    const flush = () => {
        if (!draft) {
            return;
        }
        const current = draft;
        const parts = splitLongText(current.paragraphs);
        parts.forEach(({ text, page }, i) => {
            const suffix = parts.length > 1 ? `-part${i + 1}` : "";
            chunks.push({
                id: `${docId}#${current.clause ?? `s${chunks.length}`}${suffix}`,
                docId,
                section: current.section,
                clause: current.clause,
                page,
                text,
            });
        });
        draft = null;
    };

    for (const paragraph of paragraphs) {
        const { text } = paragraph;
        if (isSectionHeading(text)) {
            flush();
            section = text;
            continue;
        }

        const clause = text.match(CLAUSE_RE)?.[1] ?? text.match(TOP_LEVEL_RE)?.[1] ?? null;
        if (clause) {
            flush();
            draft = { section, clause, paragraphs: [paragraph] };
        } else if (draft) {
            draft.paragraphs.push(paragraph);
        } else {
            draft = { section, clause: null, paragraphs: [paragraph] };
        }
    }
    flush();

    return chunks;
};
