import { Languages } from "../lib.js";

export class _EditorAdapter {
    constructor(
        { 
            view, languageCompartment, themeCompartment, tabSizeCompartment, setDiagnostics, 
            setOnChange 
        }
    ) {
        this.instance = view
        this.languageCompartment = languageCompartment;
        this.themeCompartment = themeCompartment;
        this.tabSizeCompartment = tabSizeCompartment
        this.setDiagnosticsInternal = setDiagnostics;
        this.setOnChangeInternal = setOnChange;

        this.language = undefined
        this.theme = undefined
        this.tabSize = undefined
        this.listeners = {}
    }

    // =========================
    // Getters
    // =========================

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

    currentLanguageId() {
        return this.language
    }

    // =========================
    // Setters
    // =========================

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

        const extension = Languages.list()[name];

        if (!extension) {
            console.warn(`Unknown language: ${name}`);
            return;
        }

        this.instance.dispatch({
            effects: this.languageCompartment.reconfigure(window.CodeMirror.Languages[extension.mode])
        });
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

    resetUndoManager() {
        // TODO
    }

    // =========================
    // Commands
    // =========================

    addCommand(command) {
        // TODO
        // через keymap.of(...)
    }

    // =========================
    // Events
    // =========================

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