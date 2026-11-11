import express from "express";
import { z } from "zod";
import { config } from "./config/index.ts";
import { answerQuestion } from "./rag/answer.ts";

const app = express();
app.use(express.json({ limit: "10kb" }));
// Страница интерфейса: public/index.html, app.js, style.css
app.use(express.static("public"));

const askSchema = z.object({
    question: z.string().trim().min(1).max(1000),
});

// Модель на процессоре отвечает на один вопрос за раз — второй ставить в очередь нет смысла
let busy = false;

app.post("/api/ask", async (req, res) => {
    const parsed = askSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Вопрос должен быть непустой строкой длиной до 1000 символов" });
        return;
    }
    if (busy) {
        res.status(429).json({ error: "Система отвечает на другой вопрос. Попробуйте через минуту" });
        return;
    }
    busy = true;

    // Ответ отправляется потоком (Server-Sent Events): кусочки текста по мере генерации, в конце — источники
    res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
    });

    let closed = false;
    res.on("close", () => {
        closed = true;
    });
    const send = (event: string, data: unknown) => {
        if (!closed) {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        }
    };

    try {
        const result = await answerQuestion(parsed.data.question, (token) => send("token", token));
        send("done", result);
    } catch (error) {
        console.error(error);
        send("error", { message: "Не удалось получить ответ. Проверьте, что запущены Ollama и Qdrant" });
    } finally {
        busy = false;
        res.end();
    }
});

app.listen(config.server.port, () => {
    console.log(`🌐 Справочная система: http://localhost:${config.server.port}`);
});
