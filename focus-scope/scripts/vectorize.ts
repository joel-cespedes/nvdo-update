import fs from "fs";
import glob from "glob";
import { pipeline } from "@xenova/transformers";

const embed = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
const files = glob.sync("src/**/*.ts", { ignore: ["**/*.d.ts", "node_modules/**"] });

const db: any[] = [];
for (const f of files) {
    const code = fs.readFileSync(f, "utf8").slice(0, 4000);
    const v = await embed(code, { pooling: "mean", normalize: true });
    db.push({ file: f, embedding: Array.from(v.data) });
    console.log("⊕", f);
}
fs.writeFileSync("vectors.json", JSON.stringify(db, null, 2));
console.log("✅ vectors.json listo con", db.length, "archivos");
