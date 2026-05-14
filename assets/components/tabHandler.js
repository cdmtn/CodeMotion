import { 
    toBase64, 
    getCodeByName, 
    capitilize, 
    escapeHtml, 
    runCode, 
    runSandbox, 
    addRuntimeError, 
    isFloat, 
    isStringifiedObject,
    createNotify,
    getTheme,
    SideBarIconManager,
    Languages,
    loadAceModule,
    loadAceModuleAsync,
    showCodeWindowVisuals
} from "../js/lib.js"
import { BottomWindow, closeAllWindows } from "../js/handlers/BottomWindowHandler.js"
import { initJSSH } from "../../ace/plugins/languageSyntaxEnhance.js"
import { enableSmoothScroll } from "../plugins/aceSmoothScroller/index.js"
import { JavascriptParser, JSONParser, HTMLParser } from '../js/contextParser.js'
import {
    setCurrentLanguage,
    setColumn,
    setTabSize,
    setSymbols,
    setErrors,
    toggleCodeFooter,
    setLine,
    enableErrors,
    disableErrors
} from "../js/handlers/bottomTabHandler.js"
import { Console } from "../js/handlers/terminalHandler.js"
import { minifyJS, minifyCSS } from "../js/handlers/minifyHandlers.js"
import { initCodeContextMenu, destroyCodeContextMenu } from "./codeContextMenu.js"
import { enableSave, disableSave } from "../../app/renderer.js"
import { bus, sendEvent } from "../js/bus.js"
import { ColorComments } from "../../app/helpers/ace/colorComments.js"

import { renderPyMsgSuccess, renderPyMsgErr } from "./pythonRuntime/runtimeHandler.js"

export const recentlyClosed = new Map();
export const tabsByPath = new Map();

export let currentContent = ""
export let currentPath = null;

export const tabsBar = document.querySelector(".code-tabs");
export const editorWrapper = document.querySelector(".code-inner__wrapper");
export const startScreen = document.querySelector("#main-code");

const globalButtonsInitialized = new Map();
let isLiveServerActive = false;
const codeContextMenuPerTab = new Map();

export class themeEditors {
    static themes = {
        default: "github_dark",
        light: "clouds",
        "contrast-dark": "tomorrow_night_bright"
    }

    constructor(editor) {
        this.editor = editor
    }

    static add(id, value) {
        console.log(`Added new theme editor:`, id, `with value:`, value)
        this.themes[id] = value
    }
    static getThemes() {
        return this.themes
    }
    static has(id) {
        return id in this.themes;
    }

    apply(id) {
        this.editor.setTheme(`ace/theme/${themeEditors.themes[id]}`)
    }
}

function addThemeModificator(editor) {
    function proccess(theme) {
        if (themeEditors.has(theme)) {
            loadAceModule(`theme-${themeEditors.themes[theme]}`)
            editor.setTheme(`ace/theme/${themeEditors.themes[theme]}`)
        }
    }
    proccess(getTheme())

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === "attributes" && mutation.attributeName === "theme") {
                const theme = document.body.getAttribute("theme")
                proccess(theme)
            }
        }
    })

    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["theme"]
    })
}

function initializeGlobalButtons(settings = {}) {
    if (globalButtonsInitialized.get("initialized")) return;

    const SideBarLiveServerIcon = new SideBarIconManager("startLiveServer");

    const handleRuntimeErrorsClick = (e) => {
        e.preventDefault()
        if (!currentPath) return;
        const rec = tabsByPath.get(currentPath);
        if (rec && rec.ErrorsHistoryWindow) {
            rec.ErrorsHistoryWindow.toggle()
        }
    }
    const runtimeErrorsBtn = document.querySelector("#runtimeErrors");
    if (runtimeErrorsBtn) {
        runtimeErrorsBtn.addEventListener("click", handleRuntimeErrorsClick);
    }

    const handleMDPreviewClick = (e) => {
        e.preventDefault()
        if (!currentPath) return;
        const rec = tabsByPath.get(currentPath);
        if (!rec) return;
        
        const MDPreviewWindow = new BottomWindow("MDPreview", { title: `Preview · ${rec.tabEl.querySelector(".file-name").textContent}` })
        MDPreviewWindow.fullscreen()
        MDPreviewWindow.show()
        MDPreviewWindow.clear()

        const editor = rec.editor;
        MDPreviewWindow.set(marked.parse(editor.getValue()))
    }
    const mdPreviewBtn = document.querySelector("#MDPreview");
    if (mdPreviewBtn) {
        mdPreviewBtn.addEventListener("click", handleMDPreviewClick);
    }

    const handleJSMinifyClick = (e) => {
        e.preventDefault()
        if (!currentPath) return;
        const rec = tabsByPath.get(currentPath);
        if (!rec) return;

        let value = rec.editor.getValue()
        rec.editor.session.setValue(minifyJS(value))
    }
    const jsMinifyBtn = document.querySelector("#js-minify");
    if (jsMinifyBtn) {
        jsMinifyBtn.addEventListener("click", handleJSMinifyClick);
    }

    const handleCSSMinifyClick = (e) => {
        e.preventDefault()
        if (!currentPath) return;
        const rec = tabsByPath.get(currentPath);
        if (!rec) return;

        let value = rec.editor.getValue()
        rec.editor.session.setValue(minifyCSS(value))
    }
    const cssMinifyBtn = document.querySelector("#css-minify");
    if (cssMinifyBtn) {
        cssMinifyBtn.addEventListener("click", handleCSSMinifyClick);
    }

    const handleCodeConsoleClick = (e) => {
        e.preventDefault()
        if (!currentPath) return;

        const globalTerminalWindow = new BottomWindow("globalTerminal", { title: "Terminal" })
        globalTerminalWindow.show()
        globalTerminalWindow.clear()
        globalTerminalWindow.autoScrollBottom()
        globalTerminalWindow.win.classList.add("console")

        new Console(globalTerminalWindow, currentPath)
    }
    const codeConsoleBtn = document.querySelector("#code-console");
    if (codeConsoleBtn) {
        codeConsoleBtn.addEventListener("click", handleCodeConsoleClick);
    }

    const handleStartLiveServerClick = async (e) => {
        e.preventDefault()
        if (!currentPath) return;

        if(isLiveServerActive == false) {
            let server = await window.electron.startLiveServer(currentPath)
            
            if(server.success) {
                isLiveServerActive = true
                SideBarLiveServerIcon.set("active")
                SideBarLiveServerIcon.blink()
                createNotify("sensors", "Live server enabled", server.url, 5000)
            }
            else {
                createNotify("sensors", "Live server error", server.error, 5000)
            }
        }
        else {
            let server = await window.electron.stopLiveServer()

            if(server.success) {
                isLiveServerActive = false
                SideBarLiveServerIcon.set("unactive")
                SideBarLiveServerIcon.blink(false)

                createNotify("sensors", "Live server disabled", "Live server is not working now", 5000)
            }
            else {
                isLiveServerActive = false
                createNotify("sensors", "Live server error", server.error, 5000)
            }
        }
    }
    const startLiveServerBtn = document.querySelector("#startLiveServer");
    if (startLiveServerBtn) {
        startLiveServerBtn.addEventListener("click", handleStartLiveServerClick);
    }

    const handleRuntimeOutputPythonClick = async (e) => {
        const pyInfo = await window.electron.getPython()

        e.preventDefault()
        if (!currentPath) return;
        const rec = tabsByPath.get(currentPath);
        if (!rec) return;

        const RuntimeHistoryWindow = new BottomWindow("runtimeHistoryPython", { title: "Python" })
        RuntimeHistoryWindow.show()
        RuntimeHistoryWindow.clear()

        let pythonRunMethod = "installed"

        if("editor" in settings && "pythonRunnerMethod" in settings.editor) {
            pythonRunMethod = settings.editor.pythonRunnerMethod
        }

        console.log("RUNPY:", pythonRunMethod)
        const pythonResult = await window.electron.runPython({ filePath: currentPath, useEmbed: pythonRunMethod == "builtin" })

        if(pythonResult.type == "success") {
            renderPyMsgSuccess({ RuntimeHistoryWindow: RuntimeHistoryWindow, pythonResult: pythonResult, method: pythonRunMethod })
        }
        if(pythonResult.type == "error") {
            renderPyMsgErr({ RuntimeHistoryWindow: RuntimeHistoryWindow, pythonResult: pythonResult, method: pythonRunMethod })
        }
    }
    const runtimeOutputPythonBtn = document.querySelector("#runtimeOutputPython");
    if (runtimeOutputPythonBtn) {
        runtimeOutputPythonBtn.addEventListener("click", handleRuntimeOutputPythonClick);
    }

    const handleRuntimeOutputClick = async (e) => {
        e.preventDefault()
        if (!currentPath) return;
        const rec = tabsByPath.get(currentPath);
        if (!rec) return;

        const RuntimeHistoryWindow = new BottomWindow("runtimeHistory", { title: "Runtime" })
        RuntimeHistoryWindow.show()
        RuntimeHistoryWindow.clear()

        const evaluatedCode = runSandbox(rec.editor.getValue())
        
        if(typeof evaluatedCode == "object") {
            evaluatedCode.forEach(e => {
                const type = e.type
                let args = e.args
                const line = e.line - 2 > 0 ? e.line - 2 : 0
                const col = e.col

                const icons = {
                    log: "subdirectory_arrow_right",
                    error: "error",
                    warn: "warning"
                }
                const types = {
                    log: "default",
                    error: "error",
                    warn: "warning"
                }

                let argType = null
                if(args.length == 1) {
                    argType = typeof args[0]

                    if(isStringifiedObject(args[0]) == "object") {
                        argType = "object:dict"
                    }
                    if(isStringifiedObject(args[0]) == "array") {
                        argType = "object:array"
                    }

                    if(argType == "number") {
                        argType = isFloat(args[0]) ? argType += ":float" : argType += ":int"
                    }
                }

                const runtimeOutputEl = document.createElement("div")
                runtimeOutputEl.classList.add(`log-${types[type]} bottom-window__item`)
                
                const transluentSpan = document.createElement("span")
                transluentSpan.className = "translucent bottom-window__item"
                transluentSpan.textContent = `${line}:${col}`
                runtimeOutputEl.appendChild(transluentSpan)
                
                if(argType != null) {
                    const typeSpan = document.createElement("span")
                    typeSpan.className = `runtime-typeof ${argType.split(":")[0]}`
                    typeSpan.textContent = argType.toUpperCase()
                    runtimeOutputEl.appendChild(typeSpan)
                }
                
                const iconSpan = document.createElement("span")
                iconSpan.className = "material-symbols-rounded"
                iconSpan.textContent = icons[type]
                runtimeOutputEl.appendChild(iconSpan)
                
                if(args.join(", ").length == 0) {
                    const emptySpan = document.createElement("span")
                    emptySpan.className = "translucent"
                    emptySpan.textContent = "Empty"
                    runtimeOutputEl.appendChild(emptySpan)
                } else {
                    const argsSpan = document.createElement("span")
                    argsSpan.textContent = args.join(", ")
                    runtimeOutputEl.appendChild(argsSpan)
                }

                RuntimeHistoryWindow.add(runtimeOutputEl)
            })
        }
    }
    const runtimeOutputBtn = document.querySelector("#runtimeOutput");
    if (runtimeOutputBtn) {
        runtimeOutputBtn.addEventListener("click", handleRuntimeOutputClick);
    }

    globalButtonsInitialized.set("initialized", true);
}

function initializeChangeTabSizeButton() {
    const cycleStates = [2, 4, 8];
    let currentIndex = 0;

    const handleChangeTabSize = () => {
        if (!currentPath) return;
        const rec = tabsByPath.get(currentPath);
        if (!rec) return;

        currentIndex = (currentIndex + 1) % cycleStates.length
        rec.editor.session.setTabSize(cycleStates[currentIndex])
        setTabSize(cycleStates[currentIndex])
    }

    const changeTabSizeBtn = document.querySelector("#changeTabSize");
    if (changeTabSizeBtn && !changeTabSizeBtn.hasTabSizeListener) {
        changeTabSizeBtn.addEventListener("click", handleChangeTabSize);
        changeTabSizeBtn.hasTabSizeListener = true;
    }
}

function updateVisibleOnElements(extension, language) {
    document.querySelectorAll("[visibleOn]").forEach(element => {
        let val = element.getAttribute("visibleOn")

        if(val.includes("language:")) {
            let lang = val.split("language:")[1].trim()

            if(extension == lang) {
                element.classList.remove("hidden")
            } 
            else {
                element.classList.add("hidden")
            }
        }
        if(val.includes("mode:")) {
            let mode = val.split("mode:")[1].trim()

            if(language.mode == mode) {
                element.classList.remove("hidden")
            } 
            else {
                element.classList.add("hidden")
            }
        }
    })
}

export async function openTab(path, content, extension, name, pathContext, isNew = false, settings = {}) {
    window.electron.triggerFileOpenedEvent(
        {
            path: path,
            extension: extension,
            name: name,
            context: pathContext ?? undefined
        }
    )
    closeAllWindows()

    currentContent = content

    const cached = recentlyClosed.get(path) || null;
    const id = toBase64(path);

    const pane = document.createElement("div");
    pane.className = "code";
    pane.id = id;
    editorWrapper.appendChild(pane);

    ace.require("ace/ext/language_tools");
    ace.require("ace/ext/beautify");

    let language = Languages.get(extension)
    let languageIcon = await Languages.getIconPath(extension)

    const editor = ace.edit(id);

    addThemeModificator(editor)

    const ErrorsHistoryWindow = new BottomWindow("errorsHistory", { title: "Errors history" })

    const imagePreviewWindow = new BottomWindow("imagePreview", { title: "Preview" })
    imagePreviewWindow.removeClose()

    if(language.name == "Image") {
        disableSave()
        const escapedPath = escapeHtml(path);
        imagePreviewWindow.set(`<div class="image-preview"><img src="${escapedPath}"></div>`)
        imagePreviewWindow.fullscreen()
        imagePreviewWindow.show()
    }
    else {
        enableSave()
        imagePreviewWindow.fullscreen(false)
        imagePreviewWindow.hide()
    }

    initCodeContextMenu(path, pathContext, editor)
    codeContextMenuPerTab.set(path, true)

    initializeGlobalButtons(settings)
    initializeChangeTabSizeButton()
    updateVisibleOnElements(extension, language)

    editor.session.setMode(`ace/mode/${language.mode}`);
    editor.setOptions({
        enableBasicAutocompletion: false,
        enableSnippets: true,
        enableLiveAutocompletion: true,
        animatedScroll: true,
        cursorStyle: "smooth"
    });

    // trigger first ace mode changed

    triggerAceChanged(editor)

    function triggerAceChanged(editor) {
        window.electron.triggerAceChangedEvent(
            {
                editorValue: editor.getValue(),
                editorMode: editor.session.$modeId,
                editorLanguage: language.mode,
                editorLanguageExtension: extension,
                cursor: {
                    line: editor.getCursorPosition().row + 1,
                    column: editor.getCursorPosition().column + 1
                }
            }
        )

        sendEvent("aceModeChanged", { extension: extension, editor: editor, mode: editor.session.$modeId })
    }

    // 
    
    if("editor" in settings && "smoothScroll" in settings.editor) {
        if(settings.editor.smoothScroll) {
            enableSmoothScroll(editor)
        }
    }

    setCurrentLanguage(language.name, { editor: editor })

    ColorComments.install(editor)

    if (tabsByPath.has(path)) {
        activateTab(tabsByPath.get(path).tabEl);
        return;
    }

    function updateEditorData() {
        let cursor = editor.getCursorPosition()

        let line = cursor.row
        let col = cursor.column

        setColumn(col)
        setLine(line)

        setSymbols(editor.getValue().length)
        setErrors(editor.getSession().getAnnotations())
    }

    function setEditorContext() {
        updateEditorData()

        if (language.mode == "javascript") {
            function parse(code) {
                return acorn.parse(code, {
                    ecmaVersion: "latest",
                    locations: true
                });
            }
            function getCursorRow() {
                return editor.getCursorPosition().row + 1;
            }
            const jsParser = new JavascriptParser()

            let ast;
            try {
                ast = parse(editor.getValue());
                addRuntimeError(
                    { 
                        isNull: true,
                        time: Math.floor(Date.now() / 1000)
                    }
                )
            } catch (e) {
                console.error(e.loc)
                addRuntimeError(
                    {
                        msg: `${e} (${e.pos})`,
                        line: e.loc.line,
                        col: e.loc.column,
                        time: Math.floor(Date.now() / 1000)
                    }
                )
                return;
            }

            const row = getCursorRow();

            const chain = jsParser.getContextChain(ast, row);
            jsParser.renderContext(chain);
        }
        else if (language.mode == "json") {
            const jsonParser = new JSONParser()
            jsonParser.showJSONContext(editor, document.querySelector(".code-structure"))
        }
        else if (language.mode == "html") {
            const htmlParser = new HTMLParser()
            htmlParser.showHTMLContext(editor, document.querySelector(".code-structure"))
        }
        else {
            const codeStructure = document.querySelector(".code-structure");
            if (codeStructure) {
                codeStructure.textContent = `Context unavailable for ${language.name}`
            }
        }
    }

    ace.config.loadModule(`ace/mode/${language.mode}`, () => {
        if (language.mode === "javascript") {
            initJSSH(editor)
        }
        else {
            enableErrors(editor)
        }
    });

    editor.session.on('change', function (delta) {
        updateEditorData()
        setEditorContext()
        triggerAceChanged(editor)
    });

    editor.on('mousedown', function () {
        updateEditorData()
    });

    editor.on('focus', function () {
        updateEditorData()
    });

    editor.on("click", () => {
        setEditorContext()
    });

    editor.session.on('changeAnnotation', function () {
        updateEditorData()
    });

    if (cached) {
        editor.setValue(cached.content ?? "", -1);
        setErrors(editor.getSession().getAnnotations())
        if (cached.cursor) editor.selection.moveTo(cached.cursor.row, cached.cursor.column);
        if (typeof cached.scrollTop === "number") editor.session.setScrollTop(cached.scrollTop);
    } else {
        editor.setValue(content ?? "", -1);
        setErrors(editor.getSession().getAnnotations())
    }

    const tab = document.createElement("div");

    tab.className = "code-tab";
    tab.setAttribute("data-id", id);
    tab.setAttribute("data-path", path);

    tab.innerHTML = `
            <img class="file-icon" src="${languageIcon}">
            <span class="file-name">${escapeHtml(name)}</span>
            <span class="material-symbols-rounded" id="tab-close">close</span>
            `;
    tabsBar.appendChild(tab);

    // if tab - a new file (from dragNdrop or smth)

    if(isNew) {
        showCodeWindowVisuals()
        console.log(tab)
        tab.classList.add("not-saved")
    }

    tabsByPath.set(path, { id, tabEl: tab, editor, paneEl: pane, ErrorsHistoryWindow, language, new: isNew });
    recentlyClosed.delete(path);

    addToHistory("file-open", `${name} opened`, path);

    tab.addEventListener("click", (ev) => {
        ev.preventDefault();
        activateTab(tab);
    });
    tab.querySelector("#tab-close").addEventListener("click", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        closeTab(path);
    });

    editor.session.on("change", () => {
        tab.classList.add("not-saved");
    });

    activateTab(tab);
}

export function closeTab(path) {
    const rec = tabsByPath.get(path);
    if (!rec) return;

    const { tabEl, editor, paneEl, id } = rec;

    const state = {
        content: editor.getValue(),
        cursor: editor.getCursorPosition(),
        scrollTop: editor.session.getScrollTop(),
        when: Date.now()
    };
    recentlyClosed.set(path, state);

    destroyCodeContextMenu();

    try { editor.destroy(); } catch (_) { }
    if (paneEl && paneEl.parentNode) paneEl.parentNode.removeChild(paneEl);

    const next = tabEl.nextElementSibling?.classList.contains("code-tab") ? tabEl.nextElementSibling : null;
    const prev = tabEl.previousElementSibling?.classList.contains("code-tab") ? tabEl.previousElementSibling : null;
    const toActivate = next || prev;

    tabEl.remove();
    tabsByPath.delete(path);
    codeContextMenuPerTab.delete(path);

    const stillHas = !!tabsBar.querySelector(".code-tab");
    if (!stillHas) {
        startScreen?.classList.remove("hidden");
        toggleCodeFooter(false)
        tabsBar.classList.add("hidden");
        currentPath = null;
    } else if (toActivate) {
        activateTab(toActivate);
    }

    if (recentlyClosed.size > 30) {
        const oldest = [...recentlyClosed.entries()].sort((a, b) => a[1].when - b[1].when)[0][0];
        recentlyClosed.delete(oldest);
    }
}

export function reopenLastClosed() {
    if (!recentlyClosed.size) return;
    const [path, state] = [...recentlyClosed.entries()].sort((a, b) => b[1].when - a[1].when)[0];
    const extension = (path.split(".").pop() || "").toLowerCase();
    const name = path.split(/[\\/]/).pop();
    openTab(path, state.content, extension, name);
}

export function activateTab(tabEl) {
    if (!tabEl) return;
    const id = tabEl.getAttribute("data-id");
    const realPath = tabEl.getAttribute("data-path");
    if (!id || !realPath) return;

    destroyCodeContextMenu();

    tabsBar.querySelectorAll(".code-tab").forEach(t => t.classList.remove("active"));
    editorWrapper.querySelectorAll(".code").forEach(c => c.classList.remove("ace_focus"));

    tabEl.classList.add("active");
    const pane = document.getElementById(id);
    if (!pane) return;
    
    pane.classList.add("ace_focus");
    currentPath = realPath;

    const rec = tabsByPath.get(realPath);
    if (!rec) return;

    const editor = rec.editor;
    if (!editor) return;

    bindEditorBtns(editor)

    document.querySelectorAll(".explorer-elements .file").forEach(file => {
        file.classList.toggle("active", file.getAttribute("data-path") === realPath);
    });

    startScreen?.classList.add("hidden");
    toggleCodeFooter(true)
    tabsBar.classList.remove("hidden");

    const ext = (realPath.split(".").pop() || "").toLowerCase();

    if (rec && rec.language) {
        updateVisibleOnElements(ext, rec.language);
    }
}

function bindEditorBtns(editor) {
    let buttonWrapper = document.querySelector(".code-footer:not(.structure)")
    if (!buttonWrapper) return;

    let copyBtn = buttonWrapper.querySelector("#code-copy")
    let codeSnippet = buttonWrapper.querySelector("#code-snippet")

    if (copyBtn) copyBtn.replaceWith(copyBtn.cloneNode(true))
    if (codeSnippet) codeSnippet.replaceWith(codeSnippet.cloneNode(true))

    copyBtn = buttonWrapper.querySelector("#code-copy")
    codeSnippet = buttonWrapper.querySelector("#code-snippet")

    if (copyBtn) {
        copyBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(editor.getValue())
            createNotify("info", "Text copied", "Text copied to clipboard!")
        })
    }

    if (codeSnippet) {
        codeSnippet.addEventListener("click", () => {
            html2canvas(editor.container).then(canvas => {
                canvas.toBlob(blob => {
                    navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ])
                })
                let image = canvas.toDataURL("image/png")
                createNotify("image", "Screenshot taken!", "Screenshot taken and copied to your clipboard", undefined, image)
            })
        })
    }
}

export function closeAllTabs() {
    const paths = Array.from(tabsByPath.keys());

    for (const path of paths) {
        closeTab(path);
    }
}