import { Modal } from "../modalsHandler/engine.js"
import { GLS } from "../lib.js"

import { generalPage } from "./settingsModal/general.js"
import { sidebarPage } from "./settingsModal/sidebar.js"
import { terminalPage } from "./settingsModal/terminal.js"
import { fileWindowPage } from "./settingsModal/fileWindow.js"
import { editorPage } from "./settingsModal/editor.js"
import { extensionsPage } from "./settingsModal/extensions.js"
import { gitPage } from "./settingsModal/git.js"

export async function getSettingsModal({ platform }) {
    const gls = await GLS.initLocal()

    function lgls(string, replacements) {
        return gls.get(`modals.appearance.${string}`, replacements)
    }

    // shared context handed to every category page builder
    const ctx = { lgls, gls, platform }

    const appearanceModal = Modal.create({
        id: "appearance",
        name: "MyModal",
        modalClassList: ["window"],
        title: lgls("title"),

        pages: [
            generalPage(ctx),
            sidebarPage(ctx),
            terminalPage(ctx),
            fileWindowPage(ctx),
            editorPage(ctx),
            extensionsPage(ctx),

            { divider: true },

            gitPage(ctx),

            // {
            //     name: lgls("gitlab.title"),
            //     icon: "gitlab",
            //     content: [
            //
            //     ]
            // }
        ]
    })

    return appearanceModal
}
