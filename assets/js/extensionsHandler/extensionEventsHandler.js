import { Options, Languages, Dirs, escapeHtml, loadAceModule, createNotify } from "../lib.js"
import { optionsThemeButtonHandler } from "../handlers/themesHandler.js"
import { themeEditors } from "../explorerTree/tabHandler.js"
import { registerAceLanguage } from "../../../helpers/aceRegisterLanguage.js"
import { bus, sendEvent } from "../../js/bus.js"
import { disableErrors, enableErrors } from "../handlers/bottomTabHandler.js"

import { themeRegisterCallback } from "./events/ui/onThemeRegister.js"
import { onLoadCSSCallback } from "./events/ui/onLoadCSS.js"
import { onLanguageRegisterCallback } from "./events/editor/onLanguageRegister.js"
import { onNewLanguageIconsRegisterCallback } from "./events/editor/onNewLanguageIconsRegister.js"
import { onNewDirIconRegisterCallback } from "./events/editor/onNewDirIconRegister.js"
import { onEditorChangeNewHLRulesCallback } from "./events/editor/onEditorChangeNewHLRules.js"
import { onNotificationCallback } from "./events/app/onNotification.js"
import { onNewDocumentationRegisterCallback } from "./events/editor/onNewDocumentationRegister.js"

const preloadapi = window.electron
const extapi = preloadapi.ext

const contexts = {}
let currentEditor = null

export function handleExtensionEvents() {
    const audioProvider = new Audio()
    audioProvider.preload = "auto"

    extapi.app.onLog((name, text) => {
        console.log(`[LOG FROM "${name}"] ${text}`)
    })
    extapi.ui.theme.onRegister((name, data) => {
        themeRegisterCallback({ name: name, data: data })
    })
    extapi.ui.css.onLoad((id, content) => {
        onLoadCSSCallback({ id: id, content: content })
    })
    extapi.editor.docs.onRegister((data) => {
        onNewDocumentationRegisterCallback({ data: data })
    })
    extapi.editor.language.onRegister(async (data) => {
        onLanguageRegisterCallback({ data: data })
    })
    extapi.editor.language.onIconsRegister((data) => {
        onNewLanguageIconsRegisterCallback({ data: data })
    })
    extapi.editor.dir.onIconsRegister((data) => {
        onNewDirIconRegisterCallback({ data: data })
    })
    extapi.editor.language.onChangeHLRules((data) => {
        onEditorChangeNewHLRulesCallback({ data: data, contexts: contexts, refreshEditorHighlight: refreshEditorHighlight })
    })
    extapi.app.onNotification((name, data) => {
        onNotificationCallback({ data: data, name: name })
    })
    extapi.app.onAudioPlay(data => {
        const path = data.path
        let volume = data.volume
        let speed = data.speed
        
        audioProvider.src = path
        audioProvider.load()

        audioProvider.volume = volume
        audioProvider.playbackRate = speed

        audioProvider.addEventListener("loadedmetadata", () => {
            if(audioProvider.duration < 31) {
                audioProvider.play()
            }
        })
    })

    // dynamic editor change

    function refreshEditorHighlight() {
        if (!currentEditor) return

        const mode = currentEditor.session.$mode
        const startRules = mode.$highlightRules.$rules.start

        mode.$highlightRules.$rules.start = startRules.filter(
            rule => !rule._dynamicId
        )

        for (const [id, rule] of contexts[currentEditor.id]) {
            mode.$highlightRules.$rules.start.unshift({
                ...rule,
                _dynamicId: id
            })
        }

        mode.$tokenizer = null

        const tokenizer = mode.getTokenizer()

        currentEditor.session.bgTokenizer.setTokenizer(tokenizer)
        currentEditor.session.bgTokenizer.start(0)
    }

    bus.addEventListener("ace-mode-changed", (d) => {
        currentEditor = d.detail.editor
        refreshEditorHighlight()
    })
    bus.addEventListener("ace-mode-clicked", (d) => {
        currentEditor = d.detail.editor
        refreshEditorHighlight()
    })
    bus.addEventListener("file-opened-event", (d) => {
        currentEditor = d.detail.editor
        contexts[currentEditor.id] = new Map()
        refreshEditorHighlight()
    })
}