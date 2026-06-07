import { DocumentationTypes } from "./documentationTypes.js"
import { escapeHtml, truncateString } from "../../lib.js"
import { themeEditors } from "../../explorerTree/tabHandler.js"

export function enableAceHover(editor, docs, props) {
    const tooltip = document.createElement("div")
    tooltip.classList.add("ace-documentation__tooltip", "hidden")
    tooltip.style.position = "fixed"
    tooltip.style.display = "none"
    tooltip.style.zIndex = 9999
    tooltip.style.maxWidth = "800px"
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

        if (data.example.length > 0) {
            let exampleContent = escapeHtml(data.example)
            exampleContent = truncateString(exampleContent, 300)

            tooltip.innerHTML += `
                <div class="ace-documentation__tooltip-example">
                    <div class="note">Example</div>
                    <div id="${key}" class="editor">${exampleContent}</div>
                </div>
            `;

            requestAnimationFrame(() => {
                const editor = ace.edit(tooltip.querySelector(`#${key}`));

                editor.setTheme(`ace/theme/${themeEditors.current.ace}`)

                editor.renderer.setPadding(0);
                editor.session.setUseWorker(false);
                editor.setShowPrintMargin(false);
                editor.setReadOnly(true);
                editor.renderer.setShowGutter(false);
                editor.setHighlightActiveLine(false);

                editor.setOptions({
                    maxLines: Infinity,
                    minLines: 1,
                    autoScrollEditorIntoView: true
                });

                editor.session.setMode(`ace/mode/${props.onMode}`);
                editor.resize();
            });
        }

        if (data.sources.length > 0) {
            let sources = data.sources.map(s =>
                `<a target="_blank" title="${s.url}" href="https://${escapeHtml(s.url)}/">${escapeHtml(s.title)}</a>`
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