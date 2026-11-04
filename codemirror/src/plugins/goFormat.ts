import { EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

export function formatGo(view: EditorView): string {
    const { state } = view;
    const doc = state.doc;
    const tree = syntaxTree(state);

    const protectedRanges: { from: number; to: number }[] = [];
    tree.iterate({
        enter: (node) => {
            if (node.name === "String" || node.name === "Rune" || node.name === "BlockComment") {
                if (doc.lineAt(node.from).number !== doc.lineAt(node.to).number) {
                    protectedRanges.push({ from: node.from, to: node.to });
                }
            }
        },
    });

    const isProtected = (pos: number) =>
        protectedRanges.some((range) => pos > range.from && pos < range.to);

    const lines: { text: string; locked: boolean }[] = [];
    for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        const locked = isProtected(line.from) || isProtected(line.to);
        lines.push({
            text: locked ? line.text : line.text.replace(/[ \t]+$/, ""),
            locked,
        });
    }

    const out: string[] = [];
    let blankRun = 0;
    for (const line of lines) {
        const isBlank = !line.locked && line.text.trim() === "";
        if (isBlank) {
            blankRun++;
            if (blankRun > 1) continue;
            out.push("");
        } else {
            blankRun = 0;
            out.push(line.text);
        }
    }

    while (out.length && out[0].trim() === "") out.shift();
    while (out.length && out[out.length - 1].trim() === "") out.pop();

    return out.join("\n") + "\n";
}
