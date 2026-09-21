import { EditorState, Compartment, EditorSelection, Prec, Transaction } from "@codemirror/state";
import {
    EditorView, keymap, lineNumbers, highlightActiveLine,
    highlightActiveLineGutter
} from "@codemirror/view";
import {
    closeBrackets, autocompletion, completionKeymap, completeFromList,
    acceptCompletion, completionStatus
} from "@codemirror/autocomplete";
import { indentUnit, language, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { lintGutter, setDiagnostics as setLintDiagnostics } from "@codemirror/lint";

// commands
import {
    defaultKeymap, indentWithTab, history, historyKeymap,
    selectAll, undo, redo, toggleComment, indentSelection,
    indentMore, indentLess
} from "@codemirror/commands";
import {
    openSearchPanel, closeSearchPanel, findNext,
    findPrevious
} from "@codemirror/search";
// 

// themes
import { vscodeDark, vscodeLight, atomone, githubDark } from '@uiw/codemirror-themes-all';
// 

// languages
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
// 

// extensions
import { colorComments, colorCommentsTheme } from "./plugins/colorComments";
import { semanticHighlight, semanticHighlightTheme, semanticDiagnosticsSink } from "./plugins/semanticHighlight";
import { unusedMarksField, unusedMarksTheme, applyUnusedMarks } from "./plugins/unusedMarks";
import { findWidget, openFindReplace } from "./plugins/findWidget";
import { formatCode, parserForMode } from "./plugins/formatter";
import { fromVSCodeSnippets } from "./plugins/snippets";
import { suggestionField, suggestionTheme, suggestPlugin, suggestUpdateListener, acceptSuggestion, dismissSuggestion, initSuggestListener } from "./plugins/suggest";
import { atomoneOverride, githubDarkOverride, vscodeDarkOverride } from "./themes/overrides";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";
import { color } from "@uiw/codemirror-extensions-color";
// 

// javascript & typescript snippet support
import javascriptSnippetsJSON from "./snippets/js/snippets.json"
import javascriptGlobalsJSON from "./snippets/js/globals.json"
import { identifierJavaScriptCompletionSource } from "./snippets/js/source";
// 

// json snippet support
import { identifierJSONCompletionSource } from "./snippets/json/source";
// 

// external
import { toPng, toBlob } from "html-to-image";
//

// lang-reg
import { Registry } from "vscode-textmate";
import { loadWASM, OnigScanner, OnigString } from "vscode-oniguruma";
import { textMateHighlighter } from "./plugins/textmate/highlighter";
import { textMateBaseTheme } from "./plugins/textmate/theme";
// 

const commentHighlightStyle = Prec.highest(syntaxHighlighting(HighlightStyle.define([
    {
        tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment],
        color: "var(--color-comment, #7d8590)"
    }
])));

export const javascriptSnippets = fromVSCodeSnippets(javascriptSnippetsJSON);
export const javascriptGlobals = completeFromList(
    javascriptGlobalsJSON.map(label => ({ label, type: "variable" }))
);

function forLanguage(name, source) {
    return (context) => {
        const active = context.state.facet(language);
        if (!active || active.name !== name) return null;
        return typeof source === "function" ? source(context) : null;
    };
}

const javascriptLang = javascript({ jsx: true, typescript: false });
const typescriptLang = javascript({ jsx: true, typescript: true });
const htmlLang = html({ matchClosingTags: true, selfClosingTags: true, autoCloseTags: true })
const jsonLang = json()

const jsSemantic = semanticHighlight({ ts: false, jsx: true });
const tsSemantic = semanticHighlight({ ts: true, jsx: true });

const javascriptHighlight = javascriptLang;
const javascriptAutocomplete = [
    javascriptLang.language.data.of({ autocomplete: forLanguage("javascript", completeFromList(javascriptSnippets)) }),
    javascriptLang.language.data.of({ autocomplete: forLanguage("javascript", javascriptGlobals) }),
    javascriptLang.language.data.of({ autocomplete: forLanguage("javascript", identifierJavaScriptCompletionSource) })
];

const typescriptHighlight = typescriptLang;
const typescriptAutocomplete = [
    typescriptLang.language.data.of({ autocomplete: forLanguage("typescript", completeFromList(javascriptSnippets)) }),
    typescriptLang.language.data.of({ autocomplete: forLanguage("typescript", javascriptGlobals) }),
    typescriptLang.language.data.of({ autocomplete: forLanguage("typescript", identifierJavaScriptCompletionSource) })
];

const htmlHighlight = [htmlLang, color];
const cssHighlight = [css(), color];

const jsonHighlight = jsonLang;
const jsonAutocomplete = [
    jsonLang.language.data.of({ autocomplete: forLanguage("json", identifierJSONCompletionSource) })
];

export const Languages = {
    javascript: [javascriptHighlight, ...javascriptAutocomplete, ...jsSemantic, semanticHighlightTheme],
    typescript: [typescriptHighlight, ...typescriptAutocomplete, ...tsSemantic, semanticHighlightTheme],
    html: htmlHighlight,
    css: cssHighlight,
    json: [jsonHighlight, ...jsonAutocomplete],
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

export const LanguageHighlighters = {
    javascript: javascriptHighlight,
    typescript: typescriptHighlight,
    html: htmlHighlight,
    css: cssHighlight,
    json: jsonHighlight,
    php: Languages.php,
    go: Languages.go,
    yaml: Languages.yaml,
    python: Languages.python,
    sass: Languages.sass,
    rust: Languages.rust,
    xml: Languages.xml,
    wast: Languages.wast,
    java: Languages.java,
    vue: Languages.vue,
    markdown: Languages.markdown
};

export const LanguageAutocompletes = {
    javascript: javascriptAutocomplete,
    typescript: typescriptAutocomplete,
    json: jsonAutocomplete
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
    ],
    githubDark: [
        githubDark,
        githubDarkOverride
    ],
    githubDarker: [
        githubDark,
        atomoneOverride
    ],
};

export const ThemeParents = {
    default: "vscodeDark",
    light: "vscodeLight",
    "contrast-dark": "githubDarker"
}

export const TabSizes = {
    "2": EditorState.tabSize.of(2),
    "4": EditorState.tabSize.of(4),
    "8": EditorState.tabSize.of(8)
};

const insertTab = (view) => {
    if (acceptSuggestion(view)) return true;

    if (completionStatus(view.state) !== null) {
        return acceptCompletion(view);
    }

    if (view.state.selection.ranges.some((range) => !range.empty)) {
        return indentMore(view);
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

const removeTab = (view) => indentLess(view);

const escapeHandler = (view) => {
    if (dismissSuggestion(view)) return true;
    return false;
};

let onigReady = null;
let tmRegistry = null;
const rawGrammars = new Map();
const grammarInstances = new Map();

async function getTextMateRegistry() {
    if (tmRegistry) return tmRegistry;

    onigReady ??= fetch(
        "../codemirror/node_modules/vscode-oniguruma/release/onig.wasm"
    ).then(r => r.arrayBuffer()).then(loadWASM);

    await onigReady;

    tmRegistry = new Registry({
        onigLib: Promise.resolve({
            createOnigScanner(patterns) {
                return new OnigScanner(patterns);
            },
            createOnigString(text) {
                return new OnigString(text);
            }
        }),

        loadGrammar: async (scopeName) => rawGrammars.get(scopeName) ?? null
    });

    return tmRegistry;
}

window.CodeMirror = {
    create(parent: any, options: any = {}) {
        const languageCompartment = new Compartment();
        const themeCompartment = new Compartment();
        const tabSizeCompartment = new Compartment();
        const wordWrapCompartment = new Compartment();
        const scrollCompartment = new Compartment();
        const readOnlyCompartment = new Compartment();

        let onChange = null;
        let onSemanticDiagnostics = null;

        const updateListener = EditorView.updateListener.of((update) => {
            if (update.docChanged && typeof onChange === "function") {
                onChange(update);
            }
        });

        function createState(doc) {
            return EditorState.create({
                doc,
                extensions: [
                    lintGutter(),

                    history(),
                    lineNumbers(),
                    highlightActiveLine(),
                    highlightActiveLineGutter(),

                    keymap.of([
                        {
                            key: "Tab",
                            run: insertTab
                        },
                        {
                            key: "Shift-Tab",
                            run: removeTab
                        },
                        {
                            key: "Escape",
                            run: escapeHandler
                        },
                        ...defaultKeymap,
                        ...historyKeymap
                    ]),

                    languageCompartment.of([]),
                    themeCompartment.of(Themes.vscodeDark),
                    tabSizeCompartment.of(EditorState.tabSize.of(4)),
                    wordWrapCompartment.of([]),
                    scrollCompartment.of([]),
                    readOnlyCompartment.of(EditorState.readOnly.of(false)),
                    indentUnit.of("\t"),

                    semanticDiagnosticsSink.of((list) => onSemanticDiagnostics?.(list)),

                    unusedMarksField,
                    unusedMarksTheme,

                    findWidget(),

                    closeBrackets(),
                    autocompletion(),

                    updateListener,

                    suggestionField,
                    suggestionTheme,
                    suggestPlugin,
                    suggestUpdateListener,

                    commentHighlightStyle,

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

        initSuggestListener();

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
                view.dispatch(setLintDiagnostics(view.state, Array.isArray(value) ? value : []));
            },
            setUnusedRanges(value) {
                applyUnusedMarks(view, Array.isArray(value) ? value : []);
            },
            setOnChange(cb) {
                onChange = cb;
            },
            setSemanticDiagnosticsHandler(cb) {
                onSemanticDiagnostics = cb;
            },

            commands: {
                selectAll,
                undo,
                redo,
                openSearchPanel,
                openFindReplace,
                toggleComment,
                indentSelection
            },

            recreateState(doc) {
                view.setState(createState(doc));
            },

            setValueNoHistory(value) {
                view.dispatch({
                    changes: { from: 0, to: view.state.doc.length, insert: value },
                    annotations: Transaction.addToHistory.of(false)
                });
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
    TabSizes: TabSizes,

    formatCode: formatCode,
    parserForMode: parserForMode,

    async registerLanguage({ id, grammar, extends: inherits = {} }: any) {
        const scopeName = `source.${id}`;
        rawGrammars.set(scopeName, grammar);

        const registry = await getTextMateRegistry();
        const tmGrammar = await registry.loadGrammar(scopeName);

        if (!tmGrammar) {
            throw new Error(`registerLanguage(${id}): grammar failed to load`);
        }

        grammarInstances.set(id, tmGrammar);

        const extension = [];

        if (inherits.highlight) {
            const base = LanguageHighlighters[inherits.highlight];
            if (!base) {
                console.warn(`registerLanguage(${id}): unknown highlight base "${inherits.highlight}"`);
            } else {
                extension.push(base);
            }
        }

        extension.push(Prec.highest([
            textMateHighlighter(tmGrammar),
            textMateBaseTheme
        ]));

        if (inherits.autocomplete) {
            const auto = LanguageAutocompletes[inherits.autocomplete];
            if (!auto) {
                console.warn(`registerLanguage(${id}): unknown autocomplete base "${inherits.autocomplete}"`);
            } else {
                extension.push(...auto);
            }
        }

        Languages[id] = extension;
        return extension;
    }
};
