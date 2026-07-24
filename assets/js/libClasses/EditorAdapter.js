import { Languages } from "../lib.js";

export class _EditorAdapter {
    constructor(
        { 
            view, compartments, setOnChange, commands, recreateState, editorView,
            editorState, tools
        }
    ) {
        this.instance = view
        this.languageCompartment = compartments.languageCompartment;
        this.themeCompartment = compartments.themeCompartment;
        this.tabSizeCompartment = compartments.tabSizeCompartment
        this.setDiagnosticsInternal = compartments.setDiagnostics;
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

        this.dom = view.dom
    }

    // 
    // other
    // 

    openSearch() {
        this.commands.openSearchPanel(this.instance)
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

    setDiagnostics(list) {
        this.setDiagnosticsInternal(list);
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
}