import { snippetCompletion } from "@codemirror/autocomplete";

export function fromVSCodeSnippets(json, type = "keyword") {
    const completions = [];

    for (const def of Object.values(json)) {
        let body = Array.isArray(def.body) ? def.body.join("\n") : def.body;

        if (/\$\{\d+\|/.test(body) || /\$\{[A-Z_]+(\/|})/.test(body)) continue;

        const names = {};
        for (const m of body.matchAll(/\$\{(\d+):([^}]*)\}/g)) {
            if (!(m[1] in names)) names[m[1]] = m[2];
        }

        body = body
            .replace(/\$\{(\d+):[^}]*\}/g, (_, n) => `\${${names[n] ?? ""}}`)
            .replace(/\$\{(\d+)\}/g, (_, n) => `\${${names[n] ?? ""}}`)
            .replace(/\$(\d+)/g, (_, n) => (n === "0" ? "${}" : `\${${names[n] ?? ""}}`))
            .replace(/\$CLIPBOARD/g, "");

        const prefixes = Array.isArray(def.prefix) ? def.prefix : [def.prefix];
        for (const prefix of prefixes) {
            completions.push(snippetCompletion(body, { label: prefix, type }));
        }
    }

    return completions;
}