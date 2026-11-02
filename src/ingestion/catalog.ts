import { readFile } from "node:fs/promises";
import { z } from "zod";

const catalogSchema = z.array(
    z.object({
        id: z.string().min(1),
        file: z.string().min(1),
        title: z.string().min(1),
        url: z.url(),
        quality: z.enum(["clean", "ocr"]),
    }),
);

export type DocumentMeta = z.infer<typeof catalogSchema>[number];

export const loadCatalog = async (filePath = "data/catalog.json"): Promise<DocumentMeta[]> => {
    const raw: unknown = JSON.parse(await readFile(filePath, "utf8"));
    return catalogSchema.parse(raw);
};
