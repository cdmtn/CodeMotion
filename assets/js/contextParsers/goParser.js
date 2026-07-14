import { renderSeparator } from "./globals.js";

export class GoParser {
    getContextChain(ast, row) {
        const chain = [];
        this.traverse(ast, row, chain);
        return chain;
    }

    traverse(node, row, chain) {
        if (!node || typeof node !== "object") return;

        const inRange = node.loc &&
            row >= node.loc.start.line &&
            row <= node.loc.end.line;

        if (inRange) {
            const item = this.nodeToChainItem(node, row);
            if (item) chain.push(item);
        }

        this.recurse(node, row, chain);
    }

    nodeToChainItem(node, row) {
        switch (node.type) {
            case "FunctionDeclaration": {
                const params = this.formatParams(node.params);
                const ret = node.returnType ? ` → ${node.returnType}` : "";
                return {
                    icon: "function",
                    label: `${node.id?.name || "anonymous"}(${params})${ret}`,
                    class: "function",
                };
            }

            case "MethodDeclaration": {
                const params = this.formatParams(node.params);
                const ret = node.returnType ? ` → ${node.returnType}` : "";
                const receiver = node.receiver?.typeName ? `(${node.receiver.typeName}) ` : "";
                return {
                    icon: "function",
                    label: `${receiver}${node.id?.name || "anonymous"}(${params})${ret}`,
                    class: "method",
                };
            }

            case "StructDeclaration":
                return {
                    icon: "category",
                    label: node.id?.name || "struct",
                    class: "class",
                };

            case "StructField": {
                const names = (node.names || []).join(", ");
                const type = node.fieldType || "";
                const tag = node.tag ? ` \`${node.tag}\`` : "";
                return {
                    icon: "data_object",
                    label: `${names}  ${type}${tag}`,
                    class: "variable",
                };
            }

            case "InterfaceDeclaration":
                return {
                    icon: "contract",
                    label: node.id?.name || "interface",
                    class: "class",
                };

            case "InterfaceMethod": {
                const params = this.formatParams(node.params);
                const ret = node.returnType ? ` → ${node.returnType}` : "";
                return {
                    icon: "function",
                    label: `${node.id?.name || ""}(${params})${ret}`,
                    class: "method",
                };
            }

            case "InterfaceEmbed":
                return {
                    icon: "input",
                    label: node.id?.name || "",
                    class: "class",
                };

            case "TypeAlias":
                return {
                    icon: "data_object",
                    label: node.aliasFor
                        ? `${node.id?.name} = ${node.aliasFor}`
                        : (node.id?.name || "type"),
                    class: "variable",
                };

            case "ShortVarDeclaration": {
                const names = (node.names || []).join(", ");
                const call = (node.values || []).find(v => v?.type === "CallExpression");
                const suffix = call ? ` := ${call.calleeName}` : " :=";
                return {
                    icon: "data_object",
                    label: names + suffix,
                    class: "variable",
                };
            }

            case "VariableDeclaration": {
                const names = (node.names || [])
                    .concat((node.declarations || []).flatMap(d => d.names || []));
                if (!names.length) return null;
                return {
                    icon: "data_object",
                    label: names.join(", "),
                    class: "variable",
                };
            }

            case "ConstDeclaration": {
                const names = (node.declarations || []).flatMap(d => d.names || []);
                if (!names.length) return null;
                return {
                    icon: "pin",
                    label: names.join(", "),
                    class: "variable",
                };
            }

            case "CallExpression":
                return node.calleeName ? {
                    icon: "deployed_code",
                    label: node.calleeName,
                    class: "object",
                } : null;

            case "IfStatement":
                return { icon: "alt_route", label: "if", class: "object" };

            case "ForStatement":
                return { icon: "loop", label: "for", class: "object" };

            case "GoStatement":
                return { icon: "rocket", label: "go " + (node.call?.calleeName || ""), class: "function" };

            case "DeferStatement":
                return { icon: "hourglass_empty", label: "defer " + (node.call?.calleeName || ""), class: "function" };

            default:
                return null;
        }
    }

    recurse(node, row, chain) {
        for (const key of ["body", "declarations", "methods", "fields", "values", "call"]) {
            const val = node[key];
            if (Array.isArray(val)) {
                val.forEach(v => this.traverse(v, row, chain));
            } else if (val && typeof val === "object" && val.loc) {
                this.traverse(val, row, chain);
            }
        }
    }

    formatParams(params) {
        if (!params || params.length === 0) return "";
        return params.map(p => {
            const names = (p.names || []).join(", ");
            return names ? `${names} ${p.paramType}` : p.paramType;
        }).join(", ");
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
                const sep = renderSeparator();
                container.appendChild(sep);
            }
        });
    }
}