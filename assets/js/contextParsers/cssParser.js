import { renderSeparator } from "./globals.js";

export class CSSParser {
    getContextChain(code, row) {
        const chain = [];
        const lines = code.split("\n");
        this._findContext(lines, row, chain);
        return chain;
    }

    _findContext(lines, row, chain) {
        const stack = [];

        for (let i = 0; i < row; i++) {
            const line = lines[i].trim();

            if (line.includes("{")) {
                const selector = this._parseSelector(line);
                if (selector) stack.push({ type: selector.type, label: selector.label, line: i + 1 });
            }

            if (line.includes("}")) {
                stack.pop();
            }
        }

        for (const item of stack) {
            chain.push(item);
        }

        const currentLine = lines[row - 1]?.trim() || "";
        const prop = this._parseProperty(currentLine);
        if (prop) chain.push(prop);
    }

    _parseSelector(line) {
        const raw = line.replace("{", "").trim();
        if (!raw) return null;

        if (raw.startsWith("@keyframes")) {
            const name = raw.replace("@keyframes", "").trim();
            return { type: "keyframes", label: name, icon: "animation", class: "keyframes" };
        }

        if (raw.startsWith("@media")) {
            const query = raw.replace("@media", "").trim();
            return { type: "media", label: query, icon: "devices", class: "media" };
        }

        if (raw.startsWith("@supports")) {
            const query = raw.replace("@supports", "").trim();
            return { type: "supports", label: query, icon: "check_circle", class: "media" };
        }

        if (raw.startsWith("@layer")) {
            const name = raw.replace("@layer", "").trim();
            return { type: "layer", label: name, icon: "layers", class: "media" };
        }

        if (raw.startsWith("@container")) {
            const name = raw.replace("@container", "").trim();
            return { type: "container", label: name, icon: "crop_free", class: "media" };
        }

        if (raw.match(/^\d+%$/) || raw === "from" || raw === "to") {
            return { type: "keyframe-stop", label: raw, icon: "radio_button_checked", class: "method" };
        }

        if (raw.startsWith("#")) {
            return { type: "id", label: raw, icon: "tag", class: "variable" };
        }

        if (raw.startsWith(".")) {
            const pseudo = this._extractPseudo(raw);
            return { type: "class", label: raw, icon: pseudo ? "filter_alt" : "circle", class: "function" };
        }

        if (raw.includes(":")) {
            return { type: "pseudo", label: raw, icon: "filter_alt", class: "method" };
        }

        if (raw.includes("[") && raw.includes("]")) {
            return { type: "attribute", label: raw, icon: "data_object", class: "variable" };
        }

        if (raw.includes(",")) {
            const short = raw.split(",").map(s => s.trim()).join(", ");
            return { type: "selector", label: short, icon: "select_all", class: "function" };
        }

        return { type: "element", label: raw, icon: "html", class: "class" };
    }

    _extractPseudo(selector) {
        const match = selector.match(/:{1,2}[\w-]+/);
        return match ? match[0] : null;
    }

    _parseProperty(line) {
        if (!line || line.includes("{") || line.includes("}") || line.startsWith("//") || line.startsWith("/*")) return null;

        const match = line.match(/^([\w-]+)\s*:\s*(.+?);?$/);
        if (!match) return null;

        const [, prop, value] = match;
        return {
            type: "property",
            label: `${prop}: ${value.trim()}`,
            icon: this._iconForProperty(prop),
            class: "variable",
        };
    }

    _iconForProperty(prop) {
        if (["color", "background", "background-color", "border-color", "outline-color"].includes(prop)) return "palette";
        if (["width", "height", "min-width", "max-width", "min-height", "max-height"].includes(prop)) return "straighten";
        if (["margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
             "padding", "padding-top", "padding-right", "padding-bottom", "padding-left"].includes(prop)) return "space_bar";
        if (["font", "font-size", "font-family", "font-weight", "font-style", "line-height", "letter-spacing"].includes(prop)) return "text_fields";
        if (["display", "flex", "flex-direction", "flex-wrap", "justify-content", "align-items", "align-self", "gap"].includes(prop)) return "grid_view";
        if (["position", "top", "right", "bottom", "left", "z-index"].includes(prop)) return "open_with";
        if (["transition", "animation", "transform"].includes(prop)) return "animation";
        if (["border", "border-radius", "border-top", "border-right", "border-bottom", "border-left"].includes(prop)) return "border_style";
        if (["opacity", "visibility", "overflow", "pointer-events"].includes(prop)) return "visibility";
        if (["grid", "grid-template", "grid-template-columns", "grid-template-rows", "grid-column", "grid-row"].includes(prop)) return "grid_on";
        if (["cursor"].includes(prop)) return "mouse";
        if (["content"].includes(prop)) return "notes";
        if (["box-shadow", "text-shadow"].includes(prop)) return "shadow";
        return "css";
    }

    renderContext(chain) {
        const container = document.querySelector(".code-structure");
        container.innerHTML = "";

        if (chain.length === 0) {
            container.textContent = "No context";
            return;
        }

        chain.forEach((item, i) => {
            const el = document.createElement("div");
            el.className = "context-item";
            el.innerHTML = `
                <span class="material-symbols-rounded ${item.class}" style="font-size:16px;">${item.icon == undefined ? "code" : item.icon}</span>
                <span>${item.label}</span>
            `;
            container.appendChild(el);

            if (i < chain.length - 1) {
                const sep = renderSeparator()
                container.appendChild(sep);
            }
        });
    }
}