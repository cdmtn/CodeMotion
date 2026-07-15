import { idify } from "../lib.js"

export class ContextMenu {
    constructor(id, elements = {}) {
        const context = document.createElement("div")
        context.classList.add("context-menu", "hidden")
        context.id = idify(id)
        this.context = context

        context.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        document.body.appendChild(context)

        if(Object.keys(elements).length == 0) {
            Object.keys(elements).forEach(el => {
                this.add(el)
            })
        }
    }

    on(eventName, callback) {
        const events = {
            open: "contextmenu"
        }

        if(eventName in events) {
            this.scope.addEventListener(events[eventName], () => { 
                callback(
                    {
                        element: this.context
                    }
                ) 
            })
        }
    }

    removeItem(id) {
        if(document.querySelector(`.context-menu__item[id="${id}"]`)) {
            document.querySelector(`.context-menu__item[id="${id}"]`).remove()
        }
    }

    add({ id, content, icon, shortcut, func, type }) {
        if(document.querySelector(`.context-menu__item[id="${id}"]`)) {
            return
        }

        let iconHTML = icon == undefined ? "" : `<span class="material-symbols-rounded">${icon}</span>`
        type = type == undefined ? "default" : type

        const item = document.createElement("div")
        item.classList.add("context-menu__item")
        item.id = id
        item.innerHTML = `
            <div class="context-menu__item-block ${icon != undefined ? `` : `no-icon`}">
                ${iconHTML}
                <div class="content">${content}</div>
            </div>
            <div class="context-menu__item-block">
                ${shortcut != undefined ? `<div class="shortcut">${shortcut}</div>` : ""}
            </div>
        `

        if(type == "divider") {
            item.innerHTML = ""
            item.className = "context-menu__item-divider"
            item.innerHTML = `<div></div>`
            item.removeAttribute("id")
        }

        this.context.appendChild(item)

        item.addEventListener("click", () => {
            this._hide()
            func()
        })
    }

    _show(x, y) {
        const menuW = this.context.offsetWidth || 250;
        const menuH = this.context.offsetHeight || 300;
        if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 5;
        if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 5;
        this.context.style.left = x + "px";
        this.context.style.top = y + "px";
        if (this.context.classList.contains("hidden")) {
            this.context.classList.add("closing");
            this.context.classList.remove("hidden");
            void this.context.offsetWidth;
            this.context.classList.remove("closing");
        }
    }

    _hide() {
        if (this.context.classList.contains("hidden")) return;
        this.context.classList.add("closing");
        const onEnd = () => {
            this.context.removeEventListener("transitionend", onEnd);
            if (this.context.classList.contains("closing")) {
                this.context.classList.add("hidden");
            }
        };
        this.context.addEventListener("transitionend", onEnd);
    }

    bindOn(scope) {
        if(scope) {
            this.scope = scope
            scope.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                this._show(e.clientX, e.clientY);
            });

            document.addEventListener("click", () => {
                this._hide();
            });
        }
    }

    bindOnEditor(editor, editorContainer) {
        this.scope = editorContainer;

        this._showMenu = (x, y) => {
            document.querySelectorAll(".context-menu").forEach(m => {
                if (m !== this.context) m.classList.add("hidden");
            });
            this._show(x, y);
        };

        this._onDocMouseDown = (e) => {
            if (e.button !== 2) return;
            if (!editorContainer.contains(e.target)) return;
            e.preventDefault();
            this._showMenu(e.clientX, e.clientY);
        };
        document.addEventListener("mousedown", this._onDocMouseDown);

        this._onNativeCtx = (e) => {
            const domEvent = e.domEvent || e;
            domEvent.preventDefault();
        };
        editor.on("nativecontextmenu", this._onNativeCtx);

        this._onDocClick = (e) => {
            if (e.button !== 0) return;
            if (!this.context.contains(e.target)) {
                this._hide();
            }
        };
        document.addEventListener("mousedown", this._onDocClick);

        this._onKey = (e) => {
            if (e.key === "Escape") {
                this._hide();
            }
        };
        document.addEventListener("keydown", this._onKey);
    }
}