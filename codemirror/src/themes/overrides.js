import { EditorView } from "@codemirror/view";

export const vscodeDarkOverride = EditorView.theme({
    "&": {
        backgroundColor: "oklch(from var(--body-color) calc(l - 0.02) c h)!important"
    },
    ".cm-gutters": {
        backgroundColor: "oklch(from var(--body-color) calc(l - 0.02) c h)!important"
    }
});
export const atomoneOverride = EditorView.theme({
    "&": {
        backgroundColor: "#0b0b0b!important"
    },
    ".cm-gutters": {
        backgroundColor: "#0b0b0b!important"
    }
});