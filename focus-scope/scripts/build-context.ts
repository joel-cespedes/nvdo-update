import fs from "fs";
import path from "path";
import glob from "glob";
import { Project } from "ts-morph";
import { encoding_for_model } from "@dqbd/tiktoken";

const ROOT = process.cwd();
const encoder = encoding_for_model("gpt-3.5-turbo"); // cl100k_base

// 1. prepara AST
const project = new Project({ tsConfigFilePath: "tsconfig.json" });
project.addSourceFilesAtPaths("src/**/*.ts");
const entries = glob.sync("src/**/*.ts", { ignore: ["**/*.d.ts", "node_modules/**"] });

// 2. recolecta imports usados
const seen = new Set<string>();
const walk = (file: any) => {
    if (!file || seen.has(file.getFilePath())) return;
    seen.add(file.getFilePath());
    for (const imp of file.getImportDeclarations()) {
        const sf = imp.getModuleSpecifierSourceFile();
        if (!sf) continue;
        const ids = imp.getNamedImports().map(i => i.getName());
        const used = ids.some(id => file.getDescendantsOfKind(174).some(t => t.getText() === id));
        if (used) walk(sf);
    }
};
entries.forEach(f => walk(project.getSourceFile(f)));

// 3. genera lista + token meter
let totalTokens = 0;
const paths = [...seen].map(p => {
    const code = fs.readFileSync(p, "utf8");
    totalTokens += encoder.encode(code).length;
    return path.join(ROOT, path.relative(ROOT, p));
});

fs.writeFileSync(".roo-code-context.json", JSON.stringify({
    "rooCode.localKnowledge.paths": paths,
    "rooCode.localKnowledge.indexInterval": 0
}, null, 2));

console.log(`✅ .roo-code-context.json con ${paths.length} archivos`);
console.log(`≈ Tokens totales (cl100k_base): ${totalTokens.toLocaleString()}`);
