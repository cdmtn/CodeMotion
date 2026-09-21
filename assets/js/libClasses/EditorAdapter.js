import { Languages } from "../lib.js";
import { fromJSONToTextMate } from "../../../app/dist-esm/textmate/compile.js"

export class _EditorAdapter {
    constructor(
        {
            view, compartments, setDiagnostics, setOnChange, commands,
            recreateState, editorView, editorState, tools,
            setSemanticDiagnosticsHandler, setValueNoHistory, setUnusedRanges
        }
    ) {
        this.instance = view
        this.languageCompartment = compartments.languageCompartment;
        this.themeCompartment = compartments.themeCompartment;
        this.tabSizeCompartment = compartments.tabSizeCompartment
        this.setDiagnosticsInternal = setDiagnostics;
        this.wordWrapCompartment = compartments.wordWrapCompartment
        this.scrollCompartment = compartments.scrollCompartment
        this.readOnlyCompartment = compartments.readOnlyCompartment

        this.setOnChangeInternal = setOnChange;
        this.commands = commands
        this.recreateState = recreateState

        this.editorView = editorView
        this.editorState = editorState
        this.tools = tools

        this.language = undefined
        this.theme = undefined
        this.tabSize = undefined
        this.listeners = {}

        this.filePath = null;
        this._diagnosticsBySource = {};
        this._onDiagnosticsChange = null;

        this._cleanups = [];
        this._destroyed = false;
        this._setValueNoHistory = setValueNoHistory;
        this._setUnusedRanges = setUnusedRanges;

        this.dom = view.dom

        if (typeof setSemanticDiagnosticsHandler === "function") {
            setSemanticDiagnosticsHandler((list) => {
                const max = this.getValue().length;
                const clamped = (list || []).map((item) => {
                    const from = Math.min(Math.max(item.from ?? 0, 0), max);
                    const to = Math.min(Math.max(item.to ?? from, from), max);
                    return { from, to, severity: item.severity || "error", message: item.message };
                });
                this.setDiagnosticsFor("semantic", clamped);
            });
        }
    }

    //
    // other
    //

    onDestroy(fn) {
        if (typeof fn === "function") this._cleanups.push(fn);
    }

    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        for (const fn of this._cleanups.splice(0)) {
            try { fn(); } catch (_) { }
        }

        try { this.instance.destroy(); } catch (_) { }
    }

    openSearch() {
        this.commands.openSearchPanel(this.instance)
    }

    openReplace() {
        this.commands.openFindReplace(this.instance)
    }

    resetUndoManager() {
        this.recreateState(this.instance.state.doc.toString());
    }

    scrollPastEnd(value) {
        this.instance.dispatch({
            effects: this.scrollCompartment.reconfigure(
                this.editorView.theme({
                    ".cm-content": {
                        paddingBottom: value === 0 ? "0px" : `${value * 100}vh`
                    }
                })
            )
        });

        return this;
    }

    //
    // getters
    //

    getValue() {
        return this.instance.state.doc.toString()
    }

    getTheme() {
        return this.theme
    }

    getSelectedText() {
        const { from, to } = this.instance.state.selection.main
        return this.instance.state.sliceDoc(from, to)
    }

    getCurrentLanguage() {
        return this.language
    }

    getAnnotations() {
        return []
    }

    getScrollTop() {
        return this.instance.scrollDOM.scrollTop
    }

    getCursorPosition() {
        const pos = this.instance.state.selection.main.head
        const line = this.instance.state.doc.lineAt(pos)

        return {
            row: line.number - 1,
            column: pos - line.from
        }
    }

    // lines api

    getCurrentLineText() {
        const pos = this.instance.state.selection.main.head;
        const line = this.instance.state.doc.lineAt(pos);

        return line.text;
    }

    getLineText(row) {
        return this.instance.state.doc.line(row + 1).text;
    }

    currentLanguageId() {
        return this.language
    }

    removeFullLines(fromRow, toRow = fromRow) {
        const doc = this.instance.state.doc;

        fromRow = Math.max(0, fromRow);
        toRow = Math.min(doc.lines - 1, toRow);

        const fromLine = doc.line(fromRow + 1);
        const toLine = doc.line(toRow + 1);

        this.instance.dispatch({
            changes: {
                from: fromLine.from,
                to: toLine.to < doc.length ? toLine.to + 1 : toLine.to
            }
        });
    }

    removeCurrentLine() {
        const view = this.instance;
        const { state } = view;

        const line = state.doc.lineAt(state.selection.main.head);

        view.dispatch({
            changes: {
                from: line.from,
                to: line.to < state.doc.length ? line.to + 1 : line.to
            }
        });
    }

    replace(range, text) {
        this.instance.dispatch({
            changes: {
                from: range.start,
                to: range.end,
                insert: text
            }
        });
    }

    // 

    //
    // setters
    //

    readOnly(enabled) {
        this.instance.dispatch({
            effects: this.readOnlyCompartment.reconfigure(
                this.editorState.readOnly.of(enabled)
            )
        });

        return this;
    }

    wordWrap(enabled) {
        this.instance.dispatch({
            effects: this.wordWrapCompartment.reconfigure(
                enabled ? this.editorView.lineWrapping : []
            )
        });

        return this;
    }

    setMaxLines(lines) {
        const container = this.instance.dom.parentElement;

        if (lines === Infinity) {
            container.style.height = "auto";
            container.style.maxHeight = "";
        } else {
            const lineHeight = this.instance.defaultLineHeight;
            container.style.maxHeight = `${lineHeight * lines}px`;
        }

        this.instance.requestMeasure();

        return this;
    }

    setValue(value) {
        this.instance.dispatch({
            changes: {
                from: 0,
                to: this.instance.state.doc.length,
                insert: value
            }
        })
    }

    setValueNoHistory(value) {
        if (typeof this._setValueNoHistory === "function") {
            this._setValueNoHistory(value)
        } else {
            this.setValue(value)
        }
    }

    setLanguage(name) {
        this.language = name;

        const langInfo = Languages.get(name);
        const mode = langInfo ? langInfo.mode : (name || "text");

        const targetLang = window.CodeMirror?.Languages?.[mode];

        if (targetLang) {
            this.instance.dispatch({
                effects: this.languageCompartment.reconfigure(targetLang)
            });
        }
    }

    setTheme(name) {
        const theme = window.CodeMirror.Themes[name];

        if (!theme) {
            console.warn(`Unknown theme: ${name}`);
            return;
        }

        this.theme = name

        this.instance.dispatch({
            effects: this.themeCompartment.reconfigure(theme)
        });
    }

    setTabSize(size) {
        const tabSize = window.CodeMirror.TabSizes[String(size)];

        if (!tabSize) {
            console.warn(`Unknown tabSize: ${size}`);
            return;
        }

        this.tabSize = size

        this.instance.dispatch({
            effects: this.tabSizeCompartment.reconfigure(tabSize)
        });
    }

    setDiagnosticsFor(source, list) {
        this._diagnosticsBySource = this._diagnosticsBySource || {};
        this._diagnosticsBySource[source] = list || [];
        this.setDiagnosticsInternal(Object.values(this._diagnosticsBySource).flat());
        this._emitDiagnosticsChange();
    }
    setDiagnostics(list) {
        this.setDiagnosticsFor("manual", list);
    }

    setUnusedRanges(list) {
        if (typeof this._setUnusedRanges === "function") {
            this._setUnusedRanges(Array.isArray(list) ? list : []);
        }
    }

    _computeDiagnosticsState() {
        const all = Object.values(this._diagnosticsBySource || {}).flat();
        let errorCount = 0;
        let warnCount = 0;

        for (const d of all) {
            if (!d) continue;
            if (d.severity === "error") errorCount++;
            else if (d.severity === "warning") warnCount++;
        }

        return {
            errorCount,
            warnCount,
            hasError: errorCount > 0,
            hasWarn: warnCount > 0,
        };
    }

    _emitDiagnosticsChange() {
        if (typeof this._onDiagnosticsChange === "function") {
            this._onDiagnosticsChange(this._computeDiagnosticsState());
        }
    }

    onDiagnosticsChange(fn) {
        this._onDiagnosticsChange = fn;
        this._emitDiagnosticsChange();
    }

    setFilePath(filePath) {
        this.filePath = filePath;
    }

    setOption(name, value) {
        // TODO
    }

    setOptions(options) {
        // TODO
    }

    useWrapMode(value) {
        // TODO
    }

    setScrollTop(value) {
        this.instance.scrollDOM.scrollTop = value
    }

    moveCursorTo(row, column) {
        const line = this.instance.state.doc.line(row + 1)

        this.instance.dispatch({
            selection: {
                anchor: line.from + column
            }
        })
    }

    //
    // commands
    //

    pasteContent(text) {
        this.instance.dispatch(
            this.instance.state.replaceSelection(text)
        );
    }

    async pasteBufferContent() {
        const text = await navigator.clipboard.readText();

        this.instance.dispatch(
            this.instance.state.replaceSelection(text)
        );
    }

    selectAll() {
        this.instance.focus();
        this.commands.selectAll(this.instance)
    }

    duplicateSelection() {
        const view = this.instance;
        const { state } = view;
        const { from, to, empty } = state.selection.main;

        if (!empty) {
            const text = state.doc.sliceString(from, to);

            view.dispatch({
                changes: {
                    from: to,
                    insert: text
                },
                selection: {
                    anchor: to,
                    head: to + text.length
                }
            });

            return;
        }

        const line = state.doc.lineAt(from);

        view.dispatch({
            changes: {
                from: line.to,
                insert: "\n" + line.text
            },
            selection: {
                anchor: from + line.length + 1,
                head: from + line.length + 1
            }
        });
    }

    undo() {
        this.commands.undo(this.instance)
    }

    redo() {
        this.commands.redo(this.instance)
    }

    toggleCommentLine() {
        this.instance.focus()
        this.commands.toggleComment(this.instance)
    }

    _prettierParser() {
        const info = Languages.get(this.language)
        const candidates = [info && info.mode, this.language]

        for (const candidate of candidates) {
            const parser = window.CodeMirror.parserForMode(candidate)
            if (parser) return parser
        }
        return null
    }

    _applyFormatted(text, cursorOffset) {
        const doc = this.instance.state.doc
        if (text == null || text === doc.toString()) return

        const selection = typeof cursorOffset === "number"
            ? { anchor: Math.min(Math.max(cursorOffset, 0), text.length) }
            : undefined

        this.instance.dispatch({
            changes: { from: 0, to: doc.length, insert: text },
            selection,
            scrollIntoView: true
        })
    }

    async formatDocument() {
        this.instance.focus()
        const parser = this._prettierParser()

        if (!parser) {
            this.commands.selectAll(this.instance)
            this.commands.indentSelection(this.instance)
            return
        }

        try {
            const result = await window.CodeMirror.formatCode(this.getValue(), {
                parser,
                tabWidth: Number(this.tabSize) || 4,
                useTabs: true,
                cursorOffset: this.instance.state.selection.main.head
            })
            if (result) this._applyFormatted(result.formatted, result.cursorOffset)
        } catch (error) {
            console.warn("Format document failed:", error?.message || error)
        }
    }

    async formatSelection() {
        this.instance.focus()
        const selection = this.instance.state.selection.main
        if (selection.empty) return this.formatDocument()

        const parser = this._prettierParser()
        if (!parser) {
            this.commands.indentSelection(this.instance)
            return
        }

        try {
            const result = await window.CodeMirror.formatCode(this.getValue(), {
                parser,
                tabWidth: Number(this.tabSize) || 4,
                useTabs: true,
                rangeStart: selection.from,
                rangeEnd: selection.to
            })
            if (result) this._applyFormatted(result.formatted, null)
        } catch (error) {
            console.warn("Format selection failed:", error?.message || error)
        }
    }

    //
    // events
    //

    onWheel(cb) {
        this.instance.scrollDOM.addEventListener("wheel", cb)
    }

    onMouseDown(cb) {
        this.instance.dom.addEventListener("mousedown", cb)
    }

    onFocus(cb) {
        this.instance.dom.addEventListener("focus", cb)
    }

    onClick(cb) {
        this.instance.dom.addEventListener("click", cb)
    }

    onChange(cb) {
        this.setOnChangeInternal(cb);
    }

    onChangeCursor(cb) {
        this.listeners.cursor = cb
    }

    onAfterRender(cb) {
        this.listeners.render = cb
    }

    on(name, cb) {
        this.listeners[name] = cb
    }

    off(name) {
        delete this.listeners[name]
    }

    // regs

    static async registerLanguage({ id, rules }) {
        const { keywords, comment, operators, types } = rules.syntax

        const textMateCompiled = fromJSONToTextMate({
            id, keywords, comment, operators, types
        })

        return await window.CodeMirror.registerLanguage({
            id: id,
            grammar: textMateCompiled,
            extends: rules.extends
        })
    }
}