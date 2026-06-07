import { bus } from "../../../bus.js"
import { enableAceHover } from "../../helpers/aceHover.js"

export function onNewDocumentationRegisterCallback({ data }) {
    const docs = data.config
    const onMode = data.props.onMode
    
    bus.addEventListener("ace-mode-changed", (e) => {
        let detail = e.detail
        let mode = detail.mode.split("ace/mode/")[1].trim()
        let extension = detail.extension
        let editor = detail.editor

        if (mode == onMode) {
            enableAceHover(editor, docs, data.props)
        }
    })
}