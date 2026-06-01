import { renderSeparator } from "./globals.js";

export class JSONParser {
    showJSONContext(editor, contextPanel) {
        const code = editor.getValue();
        const pos = editor.getCursorPosition();
        let data;

        try {
            data = JSON.parse(code);
        } catch (err) {
            contextPanel.textContent = "Incorrect JSON";
            return;
        }

        const lines = code.split("\n");
        const currentLine = lines[pos.row];
        const path = this.getJSONPath(code, pos);
        this.renderContext(path, contextPanel);
    }

    getJSONPath(code, pos) {
        const lines = code.split("\n");
        const upToCursor = lines.slice(0, pos.row + 1).join("\n");
        const jsonText = upToCursor.replace(/\s+/g, "");

        let path = [];
        const stack = [];
        let key = "";
        let buffer = "";
        let insideString = false;

        for (let i = 0; i < jsonText.length; i++) {
            const ch = jsonText[i];
            if (ch === '"' && jsonText[i - 1] !== "\\") {
                insideString = !insideString;
                if (!insideString && buffer) {
                    key = buffer;
                    buffer = "";
                } else {
                    buffer = "";
                }
            } else if (insideString) {
                buffer += ch;
            } else if (ch === "{") {
                if (key) stack.push({ type: "object", key });
                else stack.push({ type: "object", key: null });
                key = "";
            } else if (ch === "[") {
                if (key) stack.push({ type: "array", key });
                else stack.push({ type: "array", key: null });
                key = "";
            } else if (ch === "}" || ch === "]") {
                stack.pop();
            }
        }

        path = stack.map(e => {
            let icon = e.type === "object" ? "data_object" : "data_array";
            let className = e.type === "object" ? "object" : "array";
            let label = e.key ? e.key : "";
            return { icon, label, className };
        });

        if (/\"[a-zA-Z0-9_]+\"/.test(lines[pos.row])) {
            const match = lines[pos.row].match(/\"([a-zA-Z0-9_]+)\"/);
            if (match) path.push({ icon: "token", label: match[1], className: "object" });
        }

        return path;
    }

    renderContext(chain, contextPanel) {
        contextPanel.innerHTML = "";
        if (!chain.length) {
            contextPanel.textContent = "No context";
            return;
        }

        contextPanel.style.opacity = "1";

        chain.forEach((item, i) => {
            const el = document.createElement("div");
            el.className = "context-item";
            el.innerHTML = `
            <span class="material-symbols-rounded ${item.className}">${item.icon}</span>
            ${item.label.length > 0 ? `<span>${item.label}</span>` : ""}
            `;
            contextPanel.appendChild(el);

            if (i < chain.length - 1) {
                const sep = renderSeparator()
                contextPanel.appendChild(sep);
            }
        });
    }
}