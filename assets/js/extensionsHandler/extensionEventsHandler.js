import { Options, Languages, Dirs, escapeHtml, loadAceModule, createNotify } from "../lib.js"
import { optionsThemeButtonHandler } from "../handlers/themesHandler.js"
import { themeEditors } from "../explorerTree/tabHandler.js"
import { registerAceLanguage } from "../../../helpers/aceRegisterLanguage.js"
import { bus, sendEvent } from "../../js/bus.js"
import { disableErrors, enableErrors } from "../handlers/bottomTabHandler.js"

export class DocumentationTypes {
    static types = [
        {
            name: "function",
            displayName: "Function",
            className: "function"
        },
        {
            name: "operator",
            displayName: "Operator",
            className: "operator"
        }
    ]

    static list() {
        return this.types
    }

    static add(object) {
        this.types.push(object)
    }
}

function enableAceHover(editor, docs) {
    const tooltip = document.createElement("div")
    tooltip.classList.add("ace-documentation__tooltip", "hidden")
    tooltip.style.position = "fixed"
    tooltip.style.display = "none"
    tooltip.style.zIndex = 9999
    tooltip.style.maxWidth = "300px"
    tooltip.style.wordWrap = "break-word"

    document.body.appendChild(tooltip)

    let hoverTimeout = null
    let hideTimeout = null
    let markerId = null
    let isTooltipHovered = false

    const Range = ace.require("ace/range").Range

    let lastText = null
    let lastResult = null

    const compiledDocs = Object.entries(docs).map(([key, value]) => {
        let regex = null
        let isRegex = false

        try {
            if (/[\\[\](){}.+*?^$]/.test(key)) {
                regex = new RegExp(key)
                isRegex = true
            }
        } catch { }

        return { key, value, regex, isRegex }
    })

    function getWord(editor, pos) {
        const session = editor.session
        const line = session.getLine(pos.row)

        let start = pos.column
        let end = pos.column

        const leftPart = line.slice(0, pos.column)
        const tagStart = leftPart.lastIndexOf("<")
        const tagEnd = leftPart.lastIndexOf(">")

        if (tagStart > tagEnd) {
            start = tagStart

            end = pos.column
            while (end < line.length && line[end] !== ">") {
                end++
            }
            if (line[end] === ">") end++

            const text = line.slice(start, end)

            return {
                text,
                range: new Range(pos.row, start, pos.row, end)
            }
        }

        while (start > 0 && /[\w.$]/.test(line[start - 1])) start--
        while (end < line.length && /[\w.$()]/.test(line[end])) end++

        const text = line.slice(start, end)

        return {
            text,
            range: new Range(pos.row, start, pos.row, end)
        }
    }

    function clearMarker() {
        if (markerId !== null) {
            editor.session.removeMarker(markerId)
            markerId = null
        }
    }

    function highlight(range) {
        clearMarker()
        markerId = editor.session.addMarker(range, "ace_hover_marker", "text", false)
    }

    function findDocEntry(text) {
        if (text === lastText) return lastResult

        const normalized = text.replace(/\(\)$/, "")

        // 1. exact
        for (const item of compiledDocs) {
            if (!item.isRegex && item.key === text) {
                return (lastResult = { key: item.key, data: item.value, match: text })
            }
        }

        // 2. normalized
        for (const item of compiledDocs) {
            if (!item.isRegex && item.key === normalized) {
                return (lastResult = { key: item.key, data: item.value, match: normalized })
            }

            if (!item.isRegex && item.key === normalized + "()") {
                return (lastResult = { key: item.key, data: item.value, match: normalized + "()" })
            }
        }

        // 3. regex
        for (const item of compiledDocs) {
            if (!item.isRegex || !item.regex) continue

            const match = text.match(item.regex)
            if (match) {
                return (lastResult = {
                    key: item.key,
                    data: item.value,
                    match: match[0]
                })
            }
        }

        lastText = text
        return (lastResult = null)
    }

    function showTooltip(x, y, data, key, match) {
        tooltip.classList.remove("hidden")

        const displayKey = data.displayAs || match || key

        tooltip.innerHTML = `
            <div class="ace-documentation__tooltip-key">${escapeHtml(displayKey)}</div>
            <div class="ace-documentation__tooltip-type">${escapeHtml(data.type || "Key")}</div>
            <div class="ace-documentation__tooltip-description">
                <div class="note">Description</div>
                <span class="content">${escapeHtml(data.description || "No description provided")}</span>
            </div>
        `

        const docTypesArray = DocumentationTypes.list().map(item => item.name)

        if (data.type) {
            if (docTypesArray.includes(data.type)) {
                const type = DocumentationTypes.list().find(item => item.name === data.type)

                if (type) {
                    let tooltipKey = tooltip.querySelector(".ace-documentation__tooltip-key")
                    let tooltipType = tooltip.querySelector(".ace-documentation__tooltip-type")

                    tooltipType.textContent = type.displayName

                    if ("className" in type) {
                        tooltipKey.classList.add(type.className)
                    }
                    else {
                        tooltipKey.style.color = type.color
                    }
                }
            }
        }

        if (data.example) {
            tooltip.innerHTML += `
                <div class="ace-documentation__tooltip-example">
                    <div class="note">Example</div>
                    <span class="content">${escapeHtml(data.example)}</span>
                </div>
            `
        }

        if (data.sources) {
            let sources = data.sources.map(s =>
                `<a target="_blank" href="https://${escapeHtml(s.url)}/">${escapeHtml(s.title)}</a>`
            ).join("")

            tooltip.innerHTML += `
                <div class="ace-documentation__tooltip-block">
                    <div class="note">Sources</div>
                    <span class="content">${sources}</span>
                </div>
            `
        }

        tooltip.style.display = "block"

        const rect = tooltip.getBoundingClientRect()
        const screenWidth = window.innerWidth

        let left = x - rect.width / 2
        if (left < 4) left = 4
        if (left + rect.width > screenWidth - 4) left = screenWidth - rect.width - 4

        let top = y - rect.height - 8
        if (top < 4) top = y + 8

        tooltip.style.left = left + "px"
        tooltip.style.top = top + "px"
    }

    function hideTooltip() {
        clearTimeout(hideTimeout)

        hideTimeout = setTimeout(() => {
            if (!isTooltipHovered) {
                tooltip.classList.add("hidden")
                clearMarker()
            }
        }, 120)
    }

    tooltip.addEventListener("mouseenter", () => {
        isTooltipHovered = true
    })

    tooltip.addEventListener("mouseleave", () => {
        isTooltipHovered = false
        hideTooltip()
        clearMarker()
    })

    editor.container.addEventListener("mousemove", (e) => {
        clearTimeout(hoverTimeout)

        hoverTimeout = setTimeout(() => {
            const pos = editor.renderer.screenToTextCoordinates(e.clientX, e.clientY)
            const { text, range } = getWord(editor, pos)

            if (!text) {
                hideTooltip()
                clearMarker()
                return
            }

            const token = editor.session.getTokenAt(pos.row, pos.column - 1)
            if (token && token.type.includes("comment")) {
                hideTooltip()
                clearMarker()
                return
            }

            const result = findDocEntry(text)

            if (!result) {
                hideTooltip()
                clearMarker()
                return
            }

            const coords = editor.renderer.textToScreenCoordinates(pos.row, pos.column)

            highlight(range)
            showTooltip(coords.pageX, coords.pageY, result.data, result.key, result.match)
        }, 300)
    })

    editor.container.addEventListener("mouseleave", () => {
        clearTimeout(hoverTimeout)
        if (!isTooltipHovered) {
            hideTooltip()
            clearMarker()
        }
    })
}

export function handleExtensionEvents() {
    window.electron.onExtLog((name, text) => {
        console.log(`[LOG FROM "${name}"] ${text}`)
    })
    window.electron.onThemeRegister((name, data) => {
        console.log(data)
        const themeSelectOptions = Options.edit("themeSelect")
        themeSelectOptions.add(data.id, name)

        const style = document.createElement("style")
        style.id = `theme-${data.id}`
        style.textContent = `body[theme="${data.id}"] { ${data.variables} }`

        document.head.appendChild(style)

        optionsThemeButtonHandler(themeSelectOptions)

        themeEditors.add(data.id, data.editorTheme)

        sendEvent("new-theme-register", { id: data.id, name: name })
    })
    window.electron.onLoadCSS((id, content) => {
        const style = document.createElement("style")
        style.id = `css-${id}-${Math.floor(Math.random() * 99999)}`
        style.textContent = content

        document.head.appendChild(style)
    })
    window.electron.onNewDocumentationTypesRegister((data) => {
        data.forEach(e => {
            let type = e.type
            let name = e.displayName
            let color = e.color

            DocumentationTypes.add(
                {
                    name: type,
                    displayName: name,
                    color: color
                }
            )
        })
    })
    window.electron.onLanguageRegister(async (data) => {
        let name = data.languageName
        let displayName = data.languageDisplayName
        let extensions = data.languageExtensions
        let rules = data.languageRules
        let iconPath = data.languageIconPath
        let documentation = undefined

        if ("languageDocumentation" in data) {
            documentation = data.languageDocumentation
        }

        bus.addEventListener("aceModeChanged", (e) => {
            let data = e.detail
            let extension = data.extension
            let editor = data.editor

            if ("errors" in rules) {
                if (rules.errors) {
                    enableErrors(editor)
                }
                else {
                    disableErrors(editor)
                }
            }

            if (extensions.includes(extension)) {
                if (documentation != undefined) {
                    enableAceHover(editor, documentation)
                }
            }
        })

        registerAceLanguage(name, rules)

        const languageObject = {
            name: displayName,
            icon: iconPath,
            customIcon: true,
            mode: name
        }

        if ("mode" in rules) {
            languageObject.mode = rules.mode
        }

        extensions.forEach(id => {
            languageObject.id = id
            Languages.add(languageObject)
        })
    })
    window.electron.onNewLanguageIconsRegister((data) => {
        Object.keys(data).forEach(k => {
            if (k in Languages.list()) {
                let originalData = Languages.list()[k]
                originalData["icon"] = data[k]
                originalData["customIcon"] = true

                Languages.update(k, originalData)
            }
            else {
                let newLanguageIconData = {
                    id: k,
                    name: k,
                    icon: data[k],
                    customIcon: true
                }

                Languages.add(newLanguageIconData)
            }
        })
    })
    window.electron.onNewDirIconRegister((data) => {
        Object.keys(data).forEach(k => {
            Dirs.add(
                {
                    id: k,
                    icon: data[k],
                    ext: "svg",
                    customIcon: true
                }
            )
        })
    })
    // dynamic editor change

    const dynamicRules = new Map()
    let currentEditor = null

    function refreshEditorHighlight() {
        if (!currentEditor) return

        const mode = currentEditor.session.$mode
        const startRules = mode.$highlightRules.$rules.start

        mode.$highlightRules.$rules.start = startRules.filter(
            rule => !rule._dynamicId
        )

        for (const [id, rule] of dynamicRules) {
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

    bus.addEventListener("aceModeChanged", (d) => {
        currentEditor = d.detail.editor
        refreshEditorHighlight()
    })

    window.electron.onEditorChangeNewHLRules((data) => {
        const { action, id, rule } = data

        if (action === "add") {
            dynamicRules.set(id, rule)
        }

        if (action === "remove") {
            dynamicRules.delete(id)
        }

        refreshEditorHighlight()
    })

    window.electron.onNotification((name, data) => {
        if("content" in data) {
            data["content"] = `(${name}) ${data.content}`
        }
        if("time" in data) {
            if(data.time > 15000) data.time = 4000 
        }

        createNotify(data)
    })
}