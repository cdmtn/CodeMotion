import { bus } from "../bus.js"
import { readSettings } from "../global.js"

export class _GLS {
    constructor(registry, currentLang) {
        this.registry = registry
        this.currentLang = currentLang
    }

    static _create(registry, currentLang) {
        const gls = new _GLS(registry, currentLang)

        bus.addEventListener("extension-localization-register", (event) => {
            const name = event.detail.langName
            const content = event.detail.configContent

            registry[name] = content
        })

        return gls
    }

    static async init(language) {
        const settings = await readSettings()
        const baseLanguages = await window.electron.getAllLanguagesJSON()

        const registry = { ...baseLanguages }
        const currentLang = language ?? settings?.app?.language

        return this._create(registry, currentLang)
    }
    static initLocal() {
        const registry = JSON.parse(localStorage.getItem("gls") ?? "{}")
        const currentLang = localStorage.getItem("gls.current")

        return this._create(registry, currentLang)
    }

    setLanguage(lang) {
        this.currentLang = lang
    }

    get(key, replacements, depth = 0) {
        if (depth > 10) return key

        const langPack = this.registry[this.currentLang]
        if (!langPack) return key

        const parts = key.split(".")
        let current = langPack

        for (let i = 0; i < parts.length; i++) {
            if (current == null) return key
            current = current[parts[i]]
            if (current === undefined) return key
        }

        if (typeof current !== "string") {
            current = String(current)
        }

        current = current.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, path) => {
            return this.get(path.trim(), replacements, depth + 1)
        })

        if (typeof replacements === "object" && !Array.isArray(replacements)) {
            for (const r in replacements) {
                current = current.replaceAll(`%{${r}}`, String(replacements[r]))
            }
        }

        return current
    }
}