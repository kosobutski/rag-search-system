const form = document.querySelector("#ask-form");
const questionInput = document.querySelector("#question");
const askButton = document.querySelector("#ask-button");
const resultBlock = document.querySelector("#result");
const statusLine = document.querySelector("#status");
const answerBlock = document.querySelector("#answer");
const warningsList = document.querySelector("#warnings");
const sourcesBlock = document.querySelector("#sources-block");
const sourcesList = document.querySelector("#sources");
const metaLine = document.querySelector("#meta");

const escapeHtml = (text) =>
    text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

const seconds = (ms) => (ms / 1000).toFixed(1);

// Текст ответа → абзацы, а ссылки [1] — кликабельные, ведут к источнику в списке
const renderAnswer = (text) =>
    text
        .split(/\n+/)
        .filter((line) => line.trim())
        .map((line) => {
            const html = escapeHtml(line).replace(/\[(\d+)\]/g, '<a class="cite" href="#source-$1">[$1]</a>');
            return `<p>${html}</p>`;
        })
        .join("");

const renderSources = (sources) => {
    sourcesList.innerHTML = sources
        .map((source) => {
            const clause = source.clause ? ` · п. ${escapeHtml(source.clause)}` : "";
            // #page=N — браузерный просмотрщик PDF сразу откроет нужную страницу
            const href = `${source.url}#page=${source.page}`;
            return `
                <li id="source-${source.number}">
                    <span class="source-number">[${source.number}]</span>
                    <div>
                        <a class="source-title" href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(source.title)}</a>
                        <div class="source-location">${escapeHtml(source.docId)}${clause} · стр. ${source.page}</div>
                    </div>
                </li>`;
        })
        .join("");
    sourcesBlock.hidden = sources.length === 0;
};

const resetResult = () => {
    resultBlock.hidden = false;
    statusLine.className = "status";
    statusLine.textContent = "Ищу в документах…";
    answerBlock.className = "answer streaming";
    answerBlock.textContent = "";
    warningsList.innerHTML = "";
    sourcesList.innerHTML = "";
    sourcesBlock.hidden = true;
    metaLine.textContent = "";
};

const showError = (message) => {
    statusLine.className = "status error";
    statusLine.textContent = message;
};

const handleDone = (result) => {
    statusLine.textContent = "";
    answerBlock.className = "answer";

    if (result.status === "notFound") {
        answerBlock.innerHTML = "<p>В документах не найдено ответа на этот вопрос. Попробуйте сформулировать его иначе.</p>";
        metaLine.textContent = `Поиск ${seconds(result.retrievalMs)} с`;
        return;
    }

    // Показываем очищенный сервером текст: без несуществующих ссылок и лишних строк
    answerBlock.innerHTML = renderAnswer(result.answer);
    renderSources(result.sources);
    warningsList.innerHTML = result.warnings.map((w) => `<li>⚠️ ${escapeHtml(w)}</li>`).join("");
    metaLine.textContent = `Поиск ${seconds(result.retrievalMs)} с · ответ ${seconds(result.generationMs)} с`;
};

// Разбирает один блок Server-Sent Events: "event: token\ndata: ..."
const parseEvent = (block) => {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7);
        else if (line.startsWith("data: ")) data += line.slice(6);
    }
    return { event, data: data ? JSON.parse(data) : null };
};

const ask = async (question) => {
    resetResult();
    askButton.disabled = true;

    try {
        const response = await fetch("/api/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question }),
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            showError(body.error ?? `Ошибка сервера (${response.status})`);
            return;
        }

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += value;
            const blocks = buffer.split("\n\n");
            buffer = blocks.pop();

            for (const block of blocks) {
                const { event, data } = parseEvent(block);
                if (event === "token") {
                    statusLine.textContent = "";
                    answerBlock.textContent += data;
                } else if (event === "done") {
                    handleDone(data);
                } else if (event === "error") {
                    showError(data.message);
                }
            }
        }
    } catch {
        showError("Нет связи с сервером. Проверьте, что он запущен (npm run dev)");
    } finally {
        askButton.disabled = false;
    }
};

form.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = questionInput.value.trim();
    if (question && !askButton.disabled) {
        ask(question);
    }
});

// Enter — отправить, Shift+Enter — новая строка
questionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
    }
});

for (const button of document.querySelectorAll(".example")) {
    button.addEventListener("click", () => {
        questionInput.value = button.textContent;
        form.requestSubmit();
    });
}
