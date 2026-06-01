import { setTabNameCounter, escapeHtml } from "../lib.js"
import { ELEMENTS_EMPTY_TEXT_COMPONENT } from "./components.js"

const root = document.querySelector(`.explorer-elements[data-tab="history"] .elements`);

const typeIcons = {
    "created": 'add',
    "file-open": 'file_open',
    "tab-open": 'layers',
    "bug-added": 'bug_report',
    "file-saved": 'file_save'
};

export function handleHistoryTab(historyObject) {
    if (root) root.innerHTML = "";

    let historyKeys = Object.keys(historyObject)
    setTabNameCounter(historyKeys.length);

    Object.keys(historyObject).forEach(i => {
        const rec = historyObject[i];

        let value = rec.value
        let desc = rec.description
        let time = rec.time
        let action = rec.action

        root?.insertAdjacentHTML("beforeend", `
            <div class="column-element">
                <div class="column-element__title">
                    <div class="column-element__title-element ${action}">
                        <span class="material-symbols-rounded">${typeIcons[action] || ""}</span>
                    </div>
                    <div class="column-element__title-element">
                        <p class="column-element__title-element__name">${escapeHtml(value)}</p>
                        <p class="column-element__title-element__description">${escapeHtml(desc)}</p>
                    </div>
                </div>
                <div class="column-element__time"><p>${time}</p></div>
            </div>`);
    });

    if(historyKeys.length == 0) {
        root.innerHTML = ELEMENTS_EMPTY_TEXT_COMPONENT
    }
}