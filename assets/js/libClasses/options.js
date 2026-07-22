import { transparentColor } from "../lib.js";

export class _Options {
    static instances = new Map();

    constructor(id) {
        if (_Options.instances.has(id)) {
            return _Options.instances.get(id);
        }

        const optionsElement = document.createElement("div");
        optionsElement.className = "options-selector__wrapper";
        optionsElement.id = id;

        optionsElement.innerHTML = `
            <div class="options-selector">
                <p id="current"></p>
           </div>
       <div class="options-selector__items hidden"></div>
        `;

        this.id = id;
        this.el = optionsElement;

        optionsElement.addEventListener("click", () => {
            optionsElement
                .querySelector(".options-selector__items")
                .classList.toggle("hidden");
        });

        _Options.instances.set(id, this);
    }

    clear() {
        this.el.querySelector(".options-selector__items").innerHTML = ""
    }

    static edit(id) {
        return _Options.instances.get(id) || null;
    }

    static seeAll() {
        return Array.from(_Options.instances.values());
    }

    #makeDefault(item) {
        this.el.querySelectorAll(".options-selector__item").forEach(el => {
            el.removeAttribute("default");
        });

        item.setAttribute("default", true);
        this.el.querySelector("#current").textContent = item.querySelector("#option_name").textContent;
    }

    add(id, value, additional = {}) {
        const item = document.createElement("div");
        item.className = "options-selector__item";

        const itemName = document.createElement("div")
        itemName.textContent = value
        itemName.id = "option_name"
        
        item.appendChild(itemName)
        item.id = id;

        if(typeof additional == "object") {
            if("secondary" in additional && typeof additional.secondary == "string") {
                const secondaryItem = document.createElement("div")
                secondaryItem.className = "secondary"
                secondaryItem.textContent = additional.secondary

                item.appendChild(secondaryItem)
            }
            if("color" in additional && typeof additional.color == "string") {
                item.style.color = additional.color
            }
            if("badge" in additional && typeof additional.badge == "object" && !Array.isArray(additional.badge)) {
                const badgeWrapper = document.createElement("div")
                badgeWrapper.classList.add("modal-badge")

                const icon = document.createElement("span")
                icon.classList.add("material-symbols-rounded")
                
                if("icon" in additional.badge) {
                    icon.textContent = additional.badge.icon
                    badgeWrapper.appendChild(icon)
                }

                if("color" in additional.badge) {
                    icon.style.background = transparentColor(additional.badge.color, 0.2)
                    icon.style.color = additional.badge.color
                }

                item.appendChild(badgeWrapper)
            }
        }

        this.el.querySelector(".options-selector__items").appendChild(item);

        item.addEventListener("click", () => {
            this.#makeDefault(item);
        });

        return {
            default: () => this.#makeDefault(item),
            element: item
        };
    }

    on(eventName, callback) {
        const events = ["click", "dblclick"];

        if (events.includes(eventName)) {
            this.el.querySelectorAll(".options-selector__item").forEach(item => {
                item.addEventListener(eventName, () => {
                    callback(item);
                });
            });
        }
    }

    get(id) {
        let item = this.el.querySelector(`.options-selector__item[id="${id}"]`);

        if (item) {
            return {
                el: item,
                default: () => this.#makeDefault(item)
            };
        }

        return false;
    }

    appendTo(element) {
        element.appendChild(this.el)
    }
}