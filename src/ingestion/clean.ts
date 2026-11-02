export type Paragraph = {
    text: string;
    page: number;
};

// Колонтитул вида "4 РДО ГУАП. СМК 3.152" или "30 СТО ГУАП. СМК 3.76"
const HEADER_RE = /^\d{1,3}\s+(РДО|СТО)\s+ГУАП\.?\s+СМК\s+[\d.]+$/i;
// Одинокий номер страницы
const PAGE_NUMBER_RE = /^\d{1,3}$/;
// Символы из "личной" области Unicode — так PDF кодирует маркеры списков
const PRIVATE_USE_RE = /[-]/g;

// Первый пункт документа — с него начинается сам текст положения
const FIRST_CLAUSE_RE = /^1\.1\.?\s/;
// Заголовок первого раздела перед пунктом 1.1 ("1. ОБЩИЕ ПОЛОЖЕНИЯ" или "1 ОБЛАСТЬ ПРИМЕНЕНИЯ")
const FIRST_SECTION_RE = /^1\.?\s/;
// Начало приложений с формами заявлений — дальше текст не берём
const APPENDIX_RE = /^Приложение\s+\S{1,3}\s+к\s+(Положению|Правилам)/i;

// Строка начинается с номера пункта ("4.", "4.2.", "4.2.1"), заголовка без точки ("1 ОБЛАСТЬ")
// или маркера списка ("–", "1)", "а)"). Части номера не начинаются с нуля, чтобы "8.00" не считалось пунктом.
const NEW_PARAGRAPH_RE = /^(\d{1,2}(\.[1-9]\d?){0,3}\.?\s|\d{1,2}\s+[А-ЯЁ]{2}|[–\-•]\s|\d{1,2}\)\s|[а-я]\)\s)/;

const normalizeLine = (line: string): string =>
    line
        .replace(PRIVATE_USE_RE, "–")
        .replace(/ /g, " ")
        .replace(/\s+/g, " ")
        .trim();

const isHeader = (line: string): boolean => HEADER_RE.test(line) || PAGE_NUMBER_RE.test(line);

const toLines = (pages: string[]): Paragraph[] =>
    pages.flatMap((pageText, index) => {
        const lines = pageText.split("\n").map(normalizeLine).filter((line) => line.length > 0);
        while (lines.length > 0 && isHeader(lines[0]!)) {
            lines.shift();
        }
        while (lines.length > 0 && PAGE_NUMBER_RE.test(lines.at(-1)!)) {
            lines.pop();
        }
        return lines.map((text) => ({ text, page: index + 1 }));
    });

// Отрезает титульный приказ, оглавление и приложения
const sliceBody = (lines: Paragraph[]): Paragraph[] => {
    const firstClause = lines.findIndex((line) => FIRST_CLAUSE_RE.test(line.text));
    if (firstClause === -1) {
        return lines;
    }

    let start = firstClause;
    for (let i = firstClause - 1; i >= Math.max(0, firstClause - 5); i--) {
        if (FIRST_SECTION_RE.test(lines[i]!.text)) {
            start = i;
            break;
        }
    }

    const end = lines.findIndex((line, i) => i > start && APPENDIX_RE.test(line.text));
    return lines.slice(start, end === -1 ? undefined : end);
};

// Склеивает строки PDF обратно в абзацы
const mergeLines = (lines: Paragraph[]): Paragraph[] => {
    const paragraphs: Paragraph[] = [];

    for (const line of lines) {
        const prev = paragraphs.at(-1);
        const startsNew = !prev || NEW_PARAGRAPH_RE.test(line.text) || /[.;:]$/.test(prev.text);

        if (startsNew) {
            paragraphs.push({ ...line });
        } else if (/[а-яё]-$/i.test(prev.text) && /^[а-яё]/.test(line.text)) {
            // перенос слова: "обуча-" + "ющихся"
            prev.text = prev.text.slice(0, -1) + line.text;
        } else {
            prev.text += " " + line.text;
        }
    }

    return paragraphs;
};

export const cleanDocument = (pages: string[]): Paragraph[] => mergeLines(sliceBody(toLines(pages)));
