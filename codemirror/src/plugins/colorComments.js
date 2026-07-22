import { EditorView, Decoration, ViewPlugin } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";

const markers = [
    { regex: /^\?/, className: "cm-comment-info" },
    { regex: /^!/, className: "cm-comment-alert" },
    { regex: /^\*/, className: "cm-comment-highlight" },
    { regex: /^todo/i, className: "cm-comment-todo" },
];

const LEADER = /^(\/\/|\/\*|\*)\s*/;

function buildDecorations(view) {
    const builder = new RangeSetBuilder();

    for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            from,
            to,
            enter: (node) => {
                if (!/comment/i.test(node.name)) return;

                const text = view.state.sliceDoc(node.from, node.to);
                const leaderMatch = text.match(LEADER);
                const leaderLen = leaderMatch ? leaderMatch[0].length : 0;
                const body = text.slice(leaderLen);

                for (const marker of markers) {
                    if (marker.regex.test(body)) {
                        builder.add(node.from, node.to, Decoration.mark({ class: marker.className }));
                        break;
                    }
                }
            },
        });
    }

    return builder.finish();
}

export const colorComments = ViewPlugin.fromClass(
    class {
        constructor(view) {
            this.decorations = buildDecorations(view);
        }
        update(update) {
            if (update.docChanged || update.viewportChanged || update.selectionSet) {
                this.decorations = buildDecorations(update.view);
            }
        }
    },
    { decorations: (v) => v.decorations }
);

export const colorCommentsTheme = EditorView.baseTheme({
    ".cm-comment-info *": {
        color: "#e5c07b",
        opacity: ".8"
    },
    ".cm-comment-alert *": { 
        color: "#e06c75", fontWeight: "bold" 
    },
    ".cm-comment-highlight *": { 
        color: "#98c379" 
    },
    ".cm-comment-todo *": { 
        color: "#61afef", fontWeight: "bold" 
    },
});