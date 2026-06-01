import { renderSeparator } from "./globals.js";

export class JavascriptParser {
    getContextChain(ast, row) {
        const chain = [];
        this.traverse(ast, row, chain);
        return chain;
    }

    traverse(node, row, chain) {
        if (!node || typeof node !== "object") return;

        if (node.loc && row >= node.loc.start.line && row <= node.loc.end.line) {
            switch (node.type) {
                case "FunctionDeclaration":
                case "FunctionExpression":
                    chain.push({ icon: "function", label: node.id?.name || "anonymous()", class: "function" });
                    break;

                case "VariableDeclarator":
                    if (node.isArrow) {
                        chain.push({ icon: "function", label: node.id?.name || "anonymous()", class: "function" });
                    } else {
                        chain.push({ icon: "data_object", label: node.id?.name, class: "variable" });
                    }
                    break;

                case "ClassDeclaration":
                    chain.push({ icon: "category", label: node.id?.name, class: "class" });
                    break;

                case "MethodDefinition": {
                    const name = node.key?.name || "";
                    if (node.isConstructor) {
                        chain.push({ icon: "construction", label: "constructor", class: "method" });
                    } else if (node.isGetter) {
                        chain.push({ icon: "output", label: `get ${name}`, class: "method" });
                    } else if (node.isSetter) {
                        chain.push({ icon: "input", label: `set ${name}`, class: "method" });
                    } else if (node.isStatic && node.isAsync) {
                        chain.push({ icon: "function", label: `static async ${name}()`, class: "method" });
                    } else if (node.isStatic) {
                        chain.push({ icon: "function", label: `static ${name}()`, class: "method" });
                    } else if (node.isAsync) {
                        chain.push({ icon: "function", label: `async ${name}()`, class: "method" });
                    } else if (node.isPrivate) {
                        chain.push({ icon: "lock", label: `${name}()`, class: "method" });
                    } else {
                        chain.push({ icon: "function", label: `${name}()`, class: "method" });
                    }
                    break;
                }

                case "ClassProperty":
                    chain.push({
                        icon: node.isStatic ? "variable_add" : "data_object",
                        label: (node.isStatic ? "static " : "") + node.id?.name,
                        class: "variable",
                    });
                    break;

                case "ObjectMethod":
                    chain.push({ icon: "function", label: `${node.id?.name}()`, class: "method" });
                    break;

                case "Property":
                    if (node.isArrow) {
                        chain.push({ icon: "function",    label: `${node.id?.name}()`, class: "function" });
                    } else if (node.isObject) {
                        chain.push({ icon: "data_object", label: node.id?.name,        class: "variable" });
                    } else {
                        chain.push({ icon: "data_object", label: node.id?.name,        class: "variable" });
                    }
                    break;

                case "CallExpression":
                    if (node.calleeName) {
                        chain.push({ icon: "deployed_code", label: node.calleeName, class: "object" });
                    }
                    break;
            }
        }

        for (const key of ["body", "declarations", "properties"]) {
            const val = node[key];
            if (Array.isArray(val)) val.forEach(v => this.traverse(v, row, chain));
            else if (val && typeof val === "object" && val.type) this.traverse(val, row, chain);
        }
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
                    <span class="material-symbols-rounded ${item.class}" style="font-size:16px;">${item.icon}</span>
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