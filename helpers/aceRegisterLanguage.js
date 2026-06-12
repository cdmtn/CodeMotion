import { bus, sendEvent } from "../assets/js/bus.js"
import { createHighlightRules } from "./aceLanguageRegister/createHighlightRules.js"
import { registerAutocomplete } from "./aceLanguageRegister/registerAutocomplete.js"
import { enableAutoBrackets } from "./aceLanguageRegister/enableAutoBrackets.js"

const registeredCompleters = new Set()
const registeredModes = new Set()

export function registerAceLanguage(id, config = {}) {
    if (registeredModes.has(id)) return
    registeredModes.add(id)

    const highlightModuleId = `ace/mode/${id}_highlight_rules`
    const modeModuleId = `ace/mode/${id}`

    const rules = createHighlightRules(config.syntax)

    registerAutocomplete({ 
        id: id,
        config: config,
        registeredCompleters: registeredCompleters
    })

    bus.addEventListener("ace-mode-changed", (data) => {
        const properties = data.detail
        
        if (config?.autocomplete?.auto) {
            enableAutoBrackets(id, properties.editor)
        }
    })

    const registerMode = () => {
        ace.define(highlightModuleId, [
            "require", "exports", "module",
            "ace/lib/oop",
            "ace/mode/text_highlight_rules",
            null
        ].filter(Boolean), function(require, exports, module) {

            const oop = require("ace/lib/oop")

            const BaseHighlightRules = require("ace/mode/text_highlight_rules").TextHighlightRules

            const CustomHighlightRules = function() {
                BaseHighlightRules.call(this)

                const customRules = rules

                if (customRules && customRules.start && customRules.start.length > 0) {
                    if (this.$rules && this.$rules.start) {
                        this.$rules.start.unshift(...customRules.start)
                    } else if (this.$rules) {
                        this.$rules.start = [...customRules.start, ...(this.$rules.start || [])]
                    } else {
                        this.$rules = customRules
                    }
                }
            }

            oop.inherits(CustomHighlightRules, BaseHighlightRules)

            exports.HighlightRules = CustomHighlightRules
        })

        ace.define(modeModuleId, [
            "require", "exports", "module",
            "ace/lib/oop",
            "ace/mode/text",
            highlightModuleId
        ], function(require, exports, module) {

            const oop = require("ace/lib/oop")

            const BaseMode = require("ace/mode/text").Mode

            const HighlightRules = require(highlightModuleId).HighlightRules

            const Mode = function() {
                BaseMode.call(this)

                this.HighlightRules = HighlightRules
                this.$id = modeModuleId
            }

            oop.inherits(Mode, BaseMode)

            exports.Mode = Mode
        })
    }

    registerMode()
}