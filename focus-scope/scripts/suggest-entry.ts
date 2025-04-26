import fs from "fs";
import { pipeline } from "@xenova/transformers";

const prompt = process.argv.slice(2).join(" ");
if (!prompt) { console.error("Uso: npm run suggest -- \"tu pregunta\""); process.exit(1); }

const db = JSON.parse(fs.readFileSync("vectors.json", "utf8"));
const emb = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
const q: Array<number> = Array.from((await emb(prompt, { pooling: "mean", normalize: true })).data);

const cos = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
db.map((d: any) => ({ file: d.file, score: cos(q, d.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .forEach((r, i) => console.log(`${i + 1}. ${r.file} (score ${r.score.toFixed(3)})`));
