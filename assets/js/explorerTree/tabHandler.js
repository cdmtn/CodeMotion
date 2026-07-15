import {
    toBase64,
    getCodeByName,
    capitilize,
    escapeHtml,
    runCode,
    runSandbox,
    clearRuntimeErrors,
    isFloat,
    isStringifiedObject,
    createNotify,
    getTheme,
    SideBarIconManager,
    Languages,
    loadAceModule,
    loadAceModuleAsync,
    showCodeWindowVisuals,
    Filenames,
    idify,
    CodeTemplates,
    dedent,
    GLS,
    fitAceHeight,
    setAppTitle
} from "../lib.js"
import { BottomWindow, closeAllWindows } from "../handlers/BottomWindowHandler.js"
import { initJSSH } from "../../../ace/plugins/languageSyntaxEnhance.js"
import { enableSmoothScroll } from "../../plugins/aceSmoothScroller/index.js"
import { Setting } from "../settings.js"
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
} from "../handlers/bottomTabHandler.js"
import { Console } from "../handlers/terminalHandler.js"
import { minifyJS, minifyCSS } from "../handlers/minifyHandlers.js"
import { initCodeContextMenu, destroyCodeContextMenu } from "../codeContextMenu.js"
import { enableSave, disableSave } from "../../../app/renderer.js"
import { bus, sendEvent } from "../bus.js"

import { FindNoUsages } from "../editor/noUsagesFinder.js"
import { ColorComments } from "../editor/colorComments.js"

import { renderPyMsgSuccess, renderPyMsgErr } from "../terminalRenderer/PyRuntimeHandler.js"

import { triggerAceChanged, triggerAceClicked } from "./triggers.js"
import { TopWindowList, destroyAllTopWindowLists } from "../topWindowHandler/topWindowList.js"
import { setEditorContext } from "./helpers/setEditorContext.js"
import { Modal } from "../modalsHandler/engine.js"
import { electronAPI } from "../global.js"
import { closeConfirmModal } from "../modals/closeConfirm.js"

ace.require("ace/ext/language_tools");
ace.require("ace/ext/beautify");
ace.config.setModuleUrl("ace/mode/gomod", "../app/main/tools/go/gomod-mode.js");

export const recentlyClosed = new Map();
export const tabsByPath = new Map();

export let currentContent = ""
export let currentPath = null;

export const tabsBar = document.querySelector(".code-tabs");
export const editorWrapper = document.querySelector(".code-inner__wrapper");
export const startScreen = document.querySelector("#main-code");

const codeToolsWrapper = document.querySelector("#code-tools")
const templateChooseCodeTool = document.querySelector("#code-tools_template-choose")

async function bindCodeTools({ editor, extension }) {
    const gls = GLS.initLocal()
    const placeholderRegex = /%\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/gm;
    const oldInstance = TopWindowList.get("chooseTemplate")

    function extractPlaceholders(str) {
        return [...str.matchAll(placeholderRegex)].map(match => match[1].trim());
    }
    function clearPlaceholders(str) {
        return str.replaceAll(placeholderRegex, "")
    }
    function lgls(key, props = {}) {
        return gls.get(`modals.templates.${key}`, props)
    }

    if (oldInstance != undefined) {
        oldInstance.destroy()
    }

    Modal.destroy("templatePlaceholders")

    const list = CodeTemplates.list()

    if (extension in list) {
        templateChooseCodeTool.classList.remove("disabled")

        const item = list[extension]
        const currentTemplates = Object.keys(item).map(id => ({
            name: item[id].name,
            id: id
        }))

        const chooseTemplateList = new TopWindowList("chooseTemplate", currentTemplates)
        chooseTemplateList.bind(templateChooseCodeTool)

        chooseTemplateList.on("click", (data) => {
            const id = parseInt(data.id)
            let templateContent = dedent(item[id].content)
            const placeholders = extractPlaceholders(templateContent)

            if(placeholders.length > 0) {
                const modalInputs = []

                placeholders.forEach(p => {
                    modalInputs.push(
                        {
                            type: "input",
                            placeholder: capitilize(p).replaceAll(/[-_]/g, " "),
                            id: p
                        }
                    )
                })

                const modal = Modal.create(
                    {
                        id: "templatePlaceholders",
                        name: "templatePlaceholders",
                        modalClassList: ["window"],
                        size: "mini",
                        title: lgls("placeholders.title"),

                        content: [
                            {
                                type: "row",
                                gap: 15,
                                classList: ['background'],
                                items: [
                                    {
                                        type: "placeholder",
                                        title: lgls("placeholders.inner.title"),
                                        description: lgls("placeholders.inner.description")
                                    },
                                    ...modalInputs,
                                    {
                                        type: "container",
                                        id: "buttonsContainer"
                                    },
                                    {
                                        type: "button",
                                        id: "templateOk",
                                        title: lgls("placeholders.inner.confirmBtn"),
                                        container: "#buttonsContainer"
                                    },
                                    {
                                        type: "button",
                                        id: "templateSkip",
                                        title: lgls("placeholders.inner.skipBtn"),
                                        container: "#buttonsContainer",
                                        class: "secondary"
                                    }
                                ]
                            }
                        ]
                    }
                )

                modal.open()

                const modalEl = modal.el
                const skipBtn = modalEl.querySelector("#templateSkip")
                const okBtn = modalEl.querySelector("#templateOk")

                skipBtn.onclick = () => {
                    editor.setValue(clearPlaceholders(templateContent))
                    modal.close()
                }

                okBtn.onclick = () => {
                    templateContent = templateContent.replace(
                        placeholderRegex,
                        (_, key) => {
                            const input = modalEl.querySelector(`#${key.trim()}`);
                            return input ? input.value : "";
                        }
                    );

                    editor.setValue(templateContent)
                    modal.close()
                }
            }
            else {
                editor.setValue(clearPlaceholders(templateContent))
            }
        })
    }
    else {
        templateChooseCodeTool.classList.add("disabled")
    }
}

const globalButtonsInitialized = new Map();
let isLiveServerActive = false;
const codeContextMenuPerTab = new Map();

function setTabColor(tab, color) {
    tab.style.borderBottomColor = color
}

let settingsObject = {}

export function updateTabPath(oldPath, newPath, newName) {
    const rec = tabsByPath.get(oldPath);
    if (!rec) return;

    tabsByPath.delete(oldPath);
    tabsByPath.set(newPath, rec);
    rec.tabEl.setAttribute("data-path", newPath);

    const nameEl = rec.tabEl.querySelector(".file-name");
    if (nameEl && newName) {
        nameEl.textContent = newName;
    }

    if (currentPath === oldPath) {
        currentPath = newPath;
    }
}

export class themeEditors {
    static current = {}

    static themes = {
        default: "github_dark",
        light: "clouds",
        "contrast-dark": "tomorrow_night_bright",
        terminal: "tomorrow_night_bright"
    }

    constructor(editor) {
        this.editor = editor
    }

    static add(id, value) {
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
            themeEditors.current = {
                name: theme,
                ace: themeEditors.themes[theme]
            }
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

        if (isLiveServerActive == false) {
            let server = await window.electron.startLiveServer(currentPath)

            if (server.success) {
                isLiveServerActive = true
                SideBarLiveServerIcon.set("active")
                SideBarLiveServerIcon.blink()

                createNotify(
                    {
                        type: "success",
                        icon: "sensors",
                        title: "Live server enabled",
                        content: server.url
                    }
                )
            }
            else {
                createNotify(
                    {
                        type: "danger",
                        icon: "sensors",
                        title: "Live server error",
                        content: server.error
                    }
                )
            }
        }
        else {
            let server = await window.electron.stopLiveServer()

            if (server.success) {
                isLiveServerActive = false
                SideBarLiveServerIcon.set("unactive")
                SideBarLiveServerIcon.blink(false)

                createNotify(
                    {
                        type: "warn",
                        icon: "sensors",
                        title: "Live server disabled",
                        content: "Live server is not working now"
                    }
                )
            }
            else {
                isLiveServerActive = false

                createNotify(
                    {
                        type: "danger",
                        icon: "sensors",
                        title: "Live server error",
                        content: server.error
                    }
                )
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

        if ("editor" in settings && "pythonRunnerMethod" in settings.editor) {
            pythonRunMethod = settings.editor.pythonRunnerMethod
        }

        const pythonResult = await window.electron.runPython({ filePath: currentPath, useEmbed: pythonRunMethod == "builtin" })

        if (pythonResult.type == "success") {
            renderPyMsgSuccess({ RuntimeHistoryWindow: RuntimeHistoryWindow, pythonResult: pythonResult, method: pythonRunMethod })
        }
        if (pythonResult.type == "error") {
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

        if (typeof evaluatedCode == "object") {
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
                if (args.length == 1) {
                    argType = typeof args[0]

                    if (isStringifiedObject(args[0]) == "object") {
                        argType = "object:dict"
                    }
                    if (isStringifiedObject(args[0]) == "array") {
                        argType = "object:array"
                    }

                    if (argType == "number") {
                        argType = isFloat(args[0]) ? argType += ":float" : argType += ":int"
                    }
                }

                const runtimeOutputEl = document.createElement("div")
                runtimeOutputEl.classList.add(`log-${types[type]} bottom-window__item`)

                const transluentSpan = document.createElement("span")
                transluentSpan.className = "translucent bottom-window__item"
                transluentSpan.textContent = `${line}:${col}`
                runtimeOutputEl.appendChild(transluentSpan)

                if (argType != null) {
                    const typeSpan = document.createElement("span")
                    typeSpan.className = `runtime-typeof ${argType.split(":")[0]}`
                    typeSpan.textContent = argType.toUpperCase()
                    runtimeOutputEl.appendChild(typeSpan)
                }

                const iconSpan = document.createElement("span")
                iconSpan.className = "material-symbols-rounded"
                iconSpan.textContent = icons[type]
                runtimeOutputEl.appendChild(iconSpan)

                if (args.join(", ").length == 0) {
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

function initializeChangeTabSizeButton(settings) {
    let currentTabSize = 2;

    if("editor" in settings && "tabSize" in settings.editor) {
        if(settings.editor.tabSize != undefined && settings.editor.tabSize.length != 0) {
            currentTabSize = settings.editor.tabSize
        }
    }

    const el = document.querySelector("#changeTabSize")

    function set(size) {
        if (!currentPath) return;
        const rec = tabsByPath.get(currentPath);
        if (!rec) return;

        rec.editor.session.setTabSize(size)
        setTabSize(size)
    }

    setTimeout(() => {
        set(currentTabSize)
    }, 100)

    const changeTabSizeList = new TopWindowList("changeTabSizeWindow",
        [
            {
                name: "2 Tabs",
                id: 2
            },
            {
                name: "4 Tabs",
                id: 4
            },
            {
                name: "8 Tabs",
                id: 8
            }
        ]
    )

    changeTabSizeList.on("click", (d) => {
        set(d.id)
    })

    changeTabSizeList.bind(el)
}

function updateVisibleOnElements(extension, language) {
    document.querySelectorAll("[visibleOn]").forEach(element => {
        let val = element.getAttribute("visibleOn")

        if (val.includes("language:")) {
            let lang = val.split("language:")[1].trim()

            if (extension == lang) {
                element.classList.remove("hidden")
            }
            else {
                element.classList.add("hidden")
            }
        }
        if (val.includes("mode:")) {
            let mode = val.split("mode:")[1].trim()

            if (language.mode == mode) {
                element.classList.remove("hidden")
            }
            else {
                element.classList.add("hidden")
            }
        }
    })
}

function initExtensionEditorAPIEvents({ editor }) {
    window.electron.ext.editor.api.onReplace((data) => {
        const findString = data.findString
        const replaceString = data.replaceString

        editor.find(findString, {
            caseSensitive: true,
            wholeWord: false,
            regExp: false
        });

        editor.replace(replaceString);
    })
}

export async function openTab(path, content, extension, name, pathContext, isNew = false, settings = {}) {
    closeAllWindows()
    setAppTitle(name)

    currentContent = content
    settingsObject = settings

    const cached = recentlyClosed.get(path) || null;
    const id = toBase64(path);

    const pane = document.createElement("div");
    pane.className = "code";
    pane.id = id;
    editorWrapper.appendChild(pane);

    let language = Languages.get(extension)
    let languageIcon = await Languages.getIconPath(extension)

    let fileNameInfo = Filenames.get(name)
    let fileNameInfoIcon = await Filenames.getIconPath(name)

    const editor = ace.edit(id);

    addThemeModificator(editor)

    const ErrorsHistoryWindow = new BottomWindow("errorsHistory", { title: "Errors history" })
    clearRuntimeErrors()

    const imagePreviewWindow = new BottomWindow("imagePreview", { title: "Preview" })
    imagePreviewWindow.removeClose()

    if (language.name == "Image") {
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
    initializeChangeTabSizeButton(settings)
    updateVisibleOnElements(extension, language)

    editor.session.setMode(`ace/mode/${fileNameInfo == false ? language.mode : fileNameInfo.mode}`);
    editor.setOptions({
        enableBasicAutocompletion: false,
        enableSnippets: true,
        enableLiveAutocompletion: true,
        animatedScroll: true,
        cursorStyle: "smooth",
        fixedWidthGutter: true
    });
    editor.getSession().setUseWorker(true)

    window.electron.triggers.sendFileOpened(
        {
            path: path,
            extension: extension,
            name: name,
            context: pathContext ?? undefined
        }
    )
    sendEvent("file-opened-event",
        {
            editor: editor,
            path: path,
            extension: extension,
            name: name,
            context: pathContext ?? undefined
        }
    )

    // trigger first ace mode changed

    triggerAceChanged({ editor: editor, extension: extension, language: language })
    initExtensionEditorAPIEvents({ editor: editor })

    let cursorChangeTimer = null

    function triggerCursorChanged() {
        updateEditorData()

        clearTimeout(cursorChangeTimer)
        cursorChangeTimer = setTimeout(() => {
            triggerAceClicked({ editor: editor, extension: extension, language: language })
        }, 100)
    }

    // 

    if ("editor" in settings && "smoothScroll" in settings.editor) {
        if (settings.editor.smoothScroll) {
            enableSmoothScroll(editor)
        }
    }

    editor.container.addEventListener('wheel', (e) => {
        if (!e.ctrlKey && !e.metaKey) return
        e.preventDefault()
        e.stopPropagation()
        const px = parseFloat(getComputedStyle(document.body).getPropertyValue('--editor-font-size'))
        const next = Math.min(200, Math.max(50, Math.round(px / 15 * 100) + (e.deltaY < 0 ? 5 : -5)))
        Setting.editorTextSize(next)
    }, { passive: false, capture: true })

    const languageContextName = fileNameInfo != false ? `${fileNameInfo.name} (${fileNameInfo.mode.toUpperCase()})` : language.name
    setCurrentLanguage(languageContextName, { editor: editor })

    // install color comments
    ColorComments.install(editor)

    if (tabsByPath.has(path)) {
        activateTab(tabsByPath.get(path).tabEl);
        return;
    }

    function updateEditorData() {
        let cursor = editor.getCursorPosition()
        let editorValue = editor.getValue()
        let editorSession = editor.getSession()

        let line = cursor.row
        let col = cursor.column

        setColumn(col + 1)
        setLine(line + 1)

        setSymbols(editorValue.length)
        setErrors(editorSession.getAnnotations())

        if(editorValue.trim().length > 0) {
            codeToolsWrapper.classList.add("hidden")
        }
        else {
            codeToolsWrapper.classList.remove("hidden")
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

    editor.renderer.on("afterRender", () => {
        bindCodeTools({ editor: editor, extension: extension })
    })

    editor.session.on('change', async () => {
        await setEditorContext({}, {
            editor: editor,
            language: language,
            updateEditorData: updateEditorData,
            path: path,
            settings: settings
        })

        triggerAceChanged({ editor: editor, extension: extension, language: language })

        // unused find

        FindNoUsages.install(editor)
    });

    editor.selection.on("changeCursor", triggerCursorChanged)

    editor.on('mousedown', function () {
        updateEditorData()
    });

    editor.on('focus', function () {
        updateEditorData()
    });

    editor.on("click", async () => {
        await setEditorContext({ errorsUpdate: false }, {
            editor: editor,
            language: language,
            updateEditorData: updateEditorData,
            path: path,
            settings: settings
        })
    });

    editor.session.on('changeAnnotation', function () {
        const worker = editor.session.$worker
        if (worker) {
            worker.send('changeOptions', [{ asi: true }]);
        }

        updateEditorData()
    });

    if (cached) {
        editor.setValue(cached.content ?? "", -1);
        editor.session.getUndoManager().reset();
        setErrors(editor.getSession().getAnnotations())
        if (cached.cursor) editor.selection.moveTo(cached.cursor.row, cached.cursor.column);
        if (typeof cached.scrollTop === "number") editor.session.setScrollTop(cached.scrollTop);
    } else {
        editor.setValue(content ?? "", -1);
        editor.session.getUndoManager().reset();
        setErrors(editor.getSession().getAnnotations())
    }

    const tab = document.createElement("div");

    tab.className = "code-tab";
    tab.setAttribute("data-id", id);
    tab.setAttribute("data-path", path);

    // colored tabs
    if ("editor" in settings && "coloredTabs" in settings.editor && settings.editor.coloredTabs) {
        setTabColor(tab, language.color)
    }

    const languageTabIcon = fileNameInfoIcon != false ? fileNameInfoIcon : languageIcon
    tab.innerHTML = `
            <img class="file-icon" src="${languageTabIcon}">
            <span class="file-name">${escapeHtml(name)}</span>
            <span class="material-symbols-rounded" id="tab-close">close</span>
        `;
    tabsBar.appendChild(tab);

    tab.draggable = true

    tab.addEventListener('dragstart', () => {
        tab.classList.add('dragging')
        console.log('dragstart')
    })

    tab.addEventListener('dragend', () => {
        tab.classList.remove('dragging')
        tabsBar.querySelectorAll('.drag-over-left, .drag-over-right')
            .forEach(t => t.classList.remove('drag-over-left', 'drag-over-right'))

        console.log('dragend')
    })

    tab.addEventListener('dragover', (e) => {
        e.preventDefault()
        const dragging = tabsBar.querySelector('.dragging')
        if (!dragging || dragging === tab) return
        tabsBar.querySelectorAll('.drag-over-left, .drag-over-right')
            .forEach(t => t.classList.remove('drag-over-left', 'drag-over-right'))
        const { left, width } = tab.getBoundingClientRect()
        tab.classList.add(e.clientX < left + width / 2 ? 'drag-over-left' : 'drag-over-right')

        console.log('dragover')
    })

    tab.addEventListener('dragleave', () => {
        tab.classList.remove('drag-over-left', 'drag-over-right')

        console.log('dragleave')
    })

    tab.addEventListener('drop', (e) => {
        e.preventDefault()
        const dragging = tabsBar.querySelector('.dragging')
        if (!dragging || dragging === tab) return
        const { left, width } = tab.getBoundingClientRect()
        tabsBar.insertBefore(dragging, e.clientX < left + width / 2 ? tab : tab.nextSibling)
        tab.classList.remove('drag-over-left', 'drag-over-right')

        console.log('drop')
    })

    // if tab is a new file (from dragNdrop or smth)

    if (isNew) {
        showCodeWindowVisuals()
        tab.classList.add("not-saved")
    }

    // 

    tabsByPath.set(path, {
        id: id,
        tabEl: tab,
        editor: editor,
        paneEl: pane,
        ErrorsHistoryWindow: ErrorsHistoryWindow,
        language: language,
        new: isNew,
        fileName: name,
        color: language.color,
        extension: extension
    });

    recentlyClosed.delete(path);

    addToHistory(
        {
            actionType: "file-open",
            value: `${name} opened`,
            desc: path
        }
    )

    tab.addEventListener("click", (ev) => {
        ev.preventDefault();
        activateTab(tab);
    });
    tab.querySelector("#tab-close").addEventListener("click", async (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        const isModified = tab.classList.contains("not-saved");
        const settings = await window.electron.readSettings();
        if (isModified && settings?.editor?.confirmCloseTab !== false) {
            showCloseConfirmModal(path, editor);
        } else {
            closeTab(path);
        }
    });
    editor.session.on('change', async () => {
        tab.classList.add("not-saved");
    });

    activateTab(tab);
}

bus.addEventListener("on-setting-colored-tabs", (data) => {
    const value = data.detail

    // update settings editor.coloredTabs
    if("editor" in settingsObject && "coloredTabs" in settingsObject.editor) {
        settingsObject.editor.coloredTabs = value
    }

    tabsByPath.forEach(item => {
        const tabEl = item.tabEl

        if(value) {
            tabEl.classList.remove("no-color")
            setTabColor(tabEl, item.color)
        }
        else {
            tabEl.classList.add("no-color")
        }
    })
})

async function showCloseConfirmModal(path, editor) {
    const gls = GLS.initLocal();
    const fileName = path.split(/[\\/]/).pop();

    const modal = closeConfirmModal(
        {
            fileName: fileName,
            gls: gls
        }
    )

    const modalEl = modal.el;
    const saveBtn = modalEl.querySelector("#closeConfirmSave");
    const yesBtn = modalEl.querySelector("#closeConfirmYes");
    const noBtn = modalEl.querySelector("#closeConfirmNo");

    yesBtn.addEventListener("click", () => {
        modal.close();
        modal.destroy();
        closeTab(path);
    });

    noBtn.addEventListener("click", () => {
        modal.close();
        modal.destroy();
    });

    saveBtn.addEventListener("click", async () => {
        const rec = tabsByPath.get(path);
        if (rec) {
            const isNew = rec.new;
            if (isNew) {
                const saveNewFileRes = await electronAPI.askToSaveNewFile({
                    filename: path,
                    content: rec.editor.getValue()
                });
                if (saveNewFileRes.success) {
                    const newPath = saveNewFileRes.path;
                    const newName = newPath.split(/[\\/]/).pop();
                    rec.new = false;
                    rec.tabEl.classList.remove("not-saved");
                    updateTabPath(path, newPath, newName);
                }
            } else {
                const saveStatus = await window.electron.saveFile(path, rec.editor.getValue());
                if (saveStatus.success) {
                    rec.tabEl.classList.remove("not-saved");
                }
            }
        }
        modal.close();
        modal.destroy();
        closeTab(path);
    });

    modal.open();
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

        setAppTitle()
    } else if (toActivate) {
        activateTab(toActivate);
    }

    if (recentlyClosed.size > 30) {
        const oldest = [...recentlyClosed.entries()].sort((a, b) => a[1].when - b[1].when)[0][0];
        recentlyClosed.delete(oldest);
    }
}

export async function reopenLastClosed() {
    if (!recentlyClosed.size) return;
    const [path, state, settings] = [...recentlyClosed.entries()].sort((a, b) => b[1].when - a[1].when)[0];
    const extension = (path.split(".").pop() || "").toLowerCase();
    const name = path.split(/[\\/]/).pop();

    openTab(path, state.content, extension, name, path, false, settings);
}

export function activateTab(tabEl) {
    if (!tabEl) return;
    const id = tabEl.getAttribute("data-id");
    const realPath = tabEl.getAttribute("data-path");
    if (!id || !realPath) return;

    destroyCodeContextMenu();

    tabsBar.querySelectorAll(".code-tab").forEach(t => t.classList.remove("active"));
    editorWrapper.querySelectorAll(".code").forEach(c => c.classList.remove("active-pane"));

    tabEl.classList.add("active");
    const pane = document.getElementById(id);
    if (!pane) return;

    pane.classList.add("active-pane");
    currentPath = realPath;

    const rec = tabsByPath.get(realPath);
    if (!rec) return;

    const editor = rec.editor;
    if (!editor) return;

    bindEditorBtns(editor, { fileName: rec.fileName })
    bindCodeTools({ editor: editor, extension: rec.extension })
    initCodeContextMenu(realPath, rec.pathContext, editor)

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

function bindEditorBtns(editor, properties = {}) {
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

            createNotify(
                {
                    icon: "content_copy",
                    title: "Text copied",
                    content: "Text copied to clipboard!"
                }
            )
        })
    }

    if (codeSnippet) {
        codeSnippet.addEventListener("click", () => {
            const currentMode = editor.session.$modeId
            const currentTheme = editor.getTheme()

            const captureWrapper = document.createElement("div")
            captureWrapper.classList.add("code-snippet__wrapper")
            captureWrapper.innerHTML = `
                <div id="title-wrapper">
                    <div id="fake-controls">
                        <div></div>
                        <div></div>
                        <div></div>
                    </div>
                    <div id="title">${properties.fileName}</div>
                    <div id="language">${capitilize(currentMode.substr(currentMode.lastIndexOf('/') + 1))}</div>
                </div>
                <div id="code-snippet-area"></div>
            `

            let value = null;
            const selectedText = editor.getSelectedText();

            if(selectedText.length > 0) {
                value = selectedText
            }
            else {
                value = editor.getValue()
            }
            
            const captureArea = captureWrapper.querySelector("#code-snippet-area")
            captureArea.textContent = value
            captureArea.id = "code-snippet-area"

            document.body.appendChild(captureWrapper)

            const captureEditor = ace.edit(captureArea)
            captureEditor.session.setMode(currentMode);
            captureEditor.setTheme(currentTheme);

            captureEditor.setOption("scrollPastEnd", 0);
            captureEditor.setOption("maxLines", Infinity);
            captureEditor.setOption("wrap", true);

            captureEditor.session.setUseWrapMode(true);
            captureEditor.session.setUseWorker(false)

            const flashEl = document.createElement("div")
            flashEl.classList.add("ace-flash", "hidden")

            setTimeout(() => {
                html2canvas(captureWrapper, {
                    backgroundColor: null,
                    scale: 3
                }).then(canvas => {
                    // flash animation
                    editor.container.appendChild(flashEl)

                    flashEl.classList.remove("hidden")
                    
                    setTimeout(() => {
                        flashEl.classList.add("hidden")
                        flashEl.addEventListener("transitionend", () => {
                            flashEl.remove()
                        })
                    }, 100)
                    // 

                    canvas.toBlob(blob => {
                        navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ])
                    })
                    let image = canvas.toDataURL("image/png")

                    createNotify(
                        {
                            icon: "image",
                            title: "Screenshot taken!",
                            content: "Screenshot taken and copied to your clipboard"
                        }
                    )
                })
            }, 100)
        })
    }
}

export function closeAllTabs() {
    const paths = Array.from(tabsByPath.keys());

    for (const path of paths) {
        closeTab(path);
    }
}