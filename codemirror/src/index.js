import { EditorState, Compartment, EditorSelection } from "@codemirror/state";
import { 
    EditorView, keymap, lineNumbers, highlightActiveLine, 
    highlightActiveLineGutter
} from "@codemirror/view";
import { 
    closeBrackets, autocompletion, completionKeymap, completeFromList, 
    acceptCompletion, completionStatus
} from "@codemirror/autocomplete";
import { indentUnit } from "@codemirror/language";
import { linter, lintGutter, forceLinting } from "@codemirror/lint";

// commands

import { 
    defaultKeymap, indentWithTab, history, historyKeymap,
    selectAll, undo, redo, toggleComment 
} from "@codemirror/commands";

// 

import {
    openSearchPanel, closeSearchPanel, findNext,
    findPrevious
} from "@codemirror/search";

import { vscodeDark, vscodeLight, atomone } from '@uiw/codemirror-themes-all';

import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { php } from "@codemirror/lang-php";
import { go } from "@codemirror/lang-go";
import { yaml } from "@codemirror/lang-yaml";
import { python } from "@codemirror/lang-python";
import { sass } from "@codemirror/lang-sass";
import { rust } from "@codemirror/lang-rust";
import { xml } from "@codemirror/lang-xml";
import { wast } from "@codemirror/lang-wast";
import { java } from "@codemirror/lang-java";
import { vue } from "@codemirror/lang-vue";
import { markdown } from "@codemirror/lang-markdown";

// extensions

import { colorComments, colorCommentsTheme } from "./plugins/colorComments";
import { fromVSCodeSnippets } from "./plugins/snippets";
import { atomoneOverride, vscodeDarkOverride } from "./themes/overrides";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";
import { color } from "@uiw/codemirror-extensions-color";

// 

import javascriptSnippetsJSON from "./snippets/js/snippets.json"
import javascriptGlobalsJSON from "./snippets/js/globals.json"
import { identifierJavaScriptCompletionSource } from "./snippets/js/source";

// external

import { toPng, toBlob } from "html-to-image";

// 

export const javascriptSnippets = fromVSCodeSnippets(javascriptSnippetsJSON);
export const javascriptGlobals = completeFromList(
    javascriptGlobalsJSON.map(label => ({ label, type: "variable" }))
);

const javascriptLang = javascript({ jsx: true, typescript: false });
const typescriptLang = javascript({ jsx: true, typescript: true });
const htmlLang = html({ matchClosingTags: true, selfClosingTags: true, autoCloseTags: true })

export const Languages = {
    javascript: [
        javascriptLang,
        javascriptLang.language.data.of({ autocomplete: completeFromList(javascriptSnippets) }),
        javascriptLang.language.data.of({ autocomplete: javascriptGlobals }),
        javascriptLang.language.data.of({ autocomplete: identifierJavaScriptCompletionSource })
    ],
    typescript: [
        typescriptLang,
        typescriptLang.language.data.of({ autocomplete: completeFromList(javascriptSnippets) }),
        typescriptLang.language.data.of({ autocomplete: javascriptGlobals }),
        typescriptLang.language.data.of({ autocomplete: identifierJavaScriptCompletionSource })
    ],
    html: [
        htmlLang,
        color
    ],
    css: [
        css(),
        color
    ],
    json: json(),
    php: php(),
    go: go(),
    yaml: yaml(),
    python: python(),
    sass: sass(),
    rust: rust(),
    xml: xml(),
    wast: wast(),
    java: java(),
    vue: vue(),

    markdown: markdown()
};

export const Themes = {
    vscodeDark: [
        vscodeDark,
        vscodeDarkOverride
    ],
    vscodeLight: vscodeLight,
    atomone: [
        atomone,
        atomoneOverride
    ]
};

export const ThemeParents = {
    default: "vscodeDark",
    light: "vscodeLight",
    "contrast-dark": "atomone"
}

export const TabSizes = {
    "2": EditorState.tabSize.of(2),
    "4": EditorState.tabSize.of(4),
    "8": EditorState.tabSize.of(8)
};

const insertTab = (view) => {
    if (completionStatus(view.state) !== null) {
        return acceptCompletion(view);
    }

    const { state, dispatch } = view;
    dispatch(
        state.update({
            changes: {
                from: state.selection.main.from,
                to: state.selection.main.to,
                insert: "\t"
            },
            selection: EditorSelection.cursor(
                state.selection.main.from + 1
            )
        })
    );

    return true;
};

window.CodeMirror = {
    create(parent, options = {}) {
        const languageCompartment = new Compartment();
        const themeCompartment = new Compartment();
        const tabSizeCompartment = new Compartment();
        const wordWrapCompartment = new Compartment();
        const scrollCompartment = new Compartment();
        const readOnlyCompartment = new Compartment();

        let onChange = null;

        const updateListener = EditorView.updateListener.of((update) => {
            if (update.docChanged && typeof onChange === "function") {
                onChange(update);
            }
        });

        let diagnostics = [];

        const lintExtension = linter(() => diagnostics);

        function createState(doc) {
            return EditorState.create({
                doc,
                extensions: [
                    lintGutter(),
                    lintExtension,

                    history(),
                    lineNumbers(),
                    highlightActiveLine(),
                    highlightActiveLineGutter(),

                    keymap.of([
                        {
                            key: "Tab",
                            run: insertTab
                        },
                        ...defaultKeymap,
                        ...historyKeymap
                    ]),

                    languageCompartment.of(Languages.javascript),
                    themeCompartment.of(Themes.vscodeDark),
                    tabSizeCompartment.of(EditorState.tabSize.of(4)),
                    wordWrapCompartment.of([]),
                    scrollCompartment.of([]),
                    readOnlyCompartment.of(EditorState.readOnly.of(false)),
                    indentUnit.of("\t"),

                    closeBrackets(),
                    autocompletion(),

                    updateListener,

                    colorComments,
                    colorCommentsTheme,

                    indentationMarkers({
                        colors: {
                            light: "#00000017",
                            dark: "#ffffff1a",
                            activeLight: "#00000070",
                            activeDark: "#ffffff33",
                        }
                    })
                ]
            });
        }

        const view = new EditorView({
            state: createState(options.value ?? ""),
            parent
        });

        return {
            view,

            compartments: {
                languageCompartment,
                themeCompartment,
                tabSizeCompartment,
                wordWrapCompartment,
                scrollCompartment,
                readOnlyCompartment
            },

            setDiagnostics(value) {
                diagnostics = value;
                forceLinting(view);
            },
            setOnChange(cb) {
                onChange = cb;
            },

            commands: {
                selectAll,
                undo,
                redo,
                openSearchPanel,
                toggleComment
            },

            recreateState(doc) {
                view.setState(createState(doc));
            },

            editorView: {
                theme: EditorView.theme,
                lineWrapping: EditorView.lineWrapping
            },

            editorState: {
                readOnly: EditorState.readOnly
            },

            tools: {
                toPng: toPng,
                toBlob: toBlob
            }
        }
    },

    Languages: Languages,
    Themes: Themes,
    ThemeParents: ThemeParents,
    TabSizes: TabSizes
};