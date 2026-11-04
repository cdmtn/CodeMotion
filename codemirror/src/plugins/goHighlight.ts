import { EditorView, Decoration, ViewPlugin, ViewUpdate, DecorationSet } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

const packageMark = Decoration.mark({ class: "cm-go-package" });
const importMark = Decoration.mark({ class: "cm-go-import" });
const callMark = Decoration.mark({ class: "cm-go-call" });
const errorMark = Decoration.mark({ class: "cm-go-error" });

function buildGoDecorations(view: EditorView): DecorationSet {
    const marks: { from: number; to: number; deco: Decoration }[] = [];
    const { state } = view;
    const tree = syntaxTree(state);

    const word = (from: number, to: number) => state.doc.sliceString(from, to);

    for (const { from, to } of view.visibleRanges) {
        tree.iterate({
            from,
            to,
            enter: (node) => {
                const name = node.name;

                if (name === "VariableName") {
                    const parent = node.node.parent;
                    if (parent && (parent.name === "SelectorExpr" || parent.name === "QualifiedType")) {
                        const first = parent.firstChild;
                        if (first && first.from === node.from && first.to === node.to) {
                            marks.push({ from: node.from, to: node.to, deco: packageMark });
                            return;
                        }
                    }
                    if (word(node.from, node.to) === "err") {
                        marks.push({ from: node.from, to: node.to, deco: errorMark });
                    }
                    return;
                }

                if (name === "DefName") {
                    const parent = node.node.parent;
                    if (parent && (parent.name === "PackageClause" || parent.name === "ImportSpec")) {
                        marks.push({ from: node.from, to: node.to, deco: packageMark });
                        return;
                    }
                    if (word(node.from, node.to) === "err") {
                        marks.push({ from: node.from, to: node.to, deco: errorMark });
                    }
                    return;
                }

                if (name === "FieldName") {
                    const parent = node.node.parent;
                    if (parent && parent.name === "SelectorExpr" && parent.parent && parent.parent.name === "CallExpr") {
                        marks.push({ from: node.from, to: node.to, deco: callMark });
                    }
                    return;
                }

                if (name === "String") {
                    const parent = node.node.parent;
                    if (parent && parent.name === "ImportSpec") {
                        marks.push({ from: node.from, to: node.to, deco: importMark });
                    }
                    return;
                }

                if (name === "TypeName") {
                    if (word(node.from, node.to) === "error") {
                        marks.push({ from: node.from, to: node.to, deco: errorMark });
                    }
                    return;
                }
            },
        });
    }

    marks.sort((a, b) => a.from - b.from || a.to - b.to);
    const builder = new RangeSetBuilder<Decoration>();
    for (const m of marks) builder.add(m.from, m.to, m.deco);
    return builder.finish();
}

export const goHighlight = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
            this.decorations = buildGoDecorations(view);
        }
        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged) {
                this.decorations = buildGoDecorations(update.view);
            }
        }
    },
    {
        decorations: (v) => v.decorations,
    }
);

export const goHighlightTheme = EditorView.baseTheme({
    ".cm-go-package, .cm-go-package *": { color: "var(--color-go-package, #4ec9b0) !important" },
    ".cm-go-import, .cm-go-import *": { color: "var(--color-go-import, #ce9178) !important" },
    ".cm-go-call, .cm-go-call *": { color: "var(--color-go-call, #dcdcaa) !important" },
    ".cm-go-error, .cm-go-error *": { color: "var(--color-go-error, #f97583) !important", fontStyle: "italic" },
});
