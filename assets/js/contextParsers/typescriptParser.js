import { JavascriptParser } from "./javascriptParser.js";

export class TypescriptParser extends JavascriptParser {
    traverse(node, row, chain) {
        if (!node || typeof node !== "object") return;

        if (node.loc && row >= node.loc.start.line && row <= node.loc.end.line) {
            switch (node.type) {
                case "InterfaceDeclaration":
                    chain.push({ icon: "integration_instructions", label: node.id?.name, class: "class" });
                    break;

                case "InterfaceMethod":
                    chain.push({
                        icon: "function",
                        label: `${node.id?.name}()${node.returnType ? `: ${node.returnType}` : ""}${node.isOptional ? "?" : ""}`,
                        class: "method",
                    });
                    break;

                case "InterfaceProperty":
                    chain.push({
                        icon: node.isReadonly ? "lock" : "data_object",
                        label: `${node.id?.name}${node.isOptional ? "?" : ""}${node.typeAnnotation ? `: ${node.typeAnnotation}` : ""}`,
                        class: "variable",
                    });
                    break;

                case "TypeAlias":
                    chain.push({ icon: "type_specimen", label: node.id?.name, class: "class" });
                    break;

                case "EnumDeclaration":
                    chain.push({ icon: "format_list_numbered", label: `${node.isConst ? "const " : ""}${node.id?.name}`, class: "class" });
                    break;

                case "EnumMember":
                    chain.push({ icon: "data_object", label: node.id?.name, class: "variable" });
                    break;

                case "IndexSignature":
                    chain.push({ icon: "tag", label: "[index]", class: "variable" });
                    break;

                case "ClassDeclaration": {
                    let label = node.id?.name;
                    if (node.extends?.length)    label += ` extends ${node.extends.join(", ")}`;
                    if (node.implements?.length) label += ` implements ${node.implements.join(", ")}`;
                    chain.push({ icon: node.isAbstract ? "indeterminate_check_box" : "category", label, class: "class" });
                    break;
                }

                case "MethodDefinition": {
                    const name = node.key?.name || "";
                    const ret  = node.returnType ? `: ${node.returnType}` : "";
                    if (node.isConstructor) {
                        chain.push({ icon: "construction",   label: "constructor",              class: "method" });
                    } else if (node.isGetter) {
                        chain.push({ icon: "output",         label: `get ${name}${ret}`,        class: "method" });
                    } else if (node.isSetter) {
                        chain.push({ icon: "input",          label: `set ${name}`,              class: "method" });
                    } else if (node.isAbstract) {
                        chain.push({ icon: "function",       label: `abstract ${name}()${ret}`, class: "method" });
                    } else if (node.isOverride) {
                        chain.push({ icon: "function",       label: `override ${name}()${ret}`, class: "method" });
                    } else if (node.isStatic && node.isAsync) {
                        chain.push({ icon: "function",       label: `static async ${name}()${ret}`, class: "method" });
                    } else if (node.isStatic) {
                        chain.push({ icon: "function",       label: `static ${name}()${ret}`,   class: "method" });
                    } else if (node.isAsync) {
                        chain.push({ icon: "function",       label: `async ${name}()${ret}`,    class: "method" });
                    } else if (node.isPrivate) {
                        chain.push({ icon: "lock",           label: `${name}()${ret}`,          class: "method" });
                    } else if (node.isProtected) {
                        chain.push({ icon: "shield",         label: `${name}()${ret}`,          class: "method" });
                    } else {
                        chain.push({ icon: "function",       label: `${name}()${ret}`,          class: "method" });
                    }
                    break;
                }

                case "ClassProperty": {
                    const name = node.id?.name || "";
                    const type = node.typeAnnotation ? `: ${node.typeAnnotation}` : "";
                    let prefix = "";
                    if (node.isStatic)   prefix += "static ";
                    if (node.isReadonly) prefix += "readonly ";
                    if (node.isAbstract) prefix += "abstract ";
                    chain.push({
                        icon: node.isPrivate || node.isProtected ? "lock" : "data_object",
                        label: `${prefix}${name}${type}`,
                        class: "variable",
                    });
                    break;
                }

                case "FunctionDeclaration": {
                    const ret = node.returnType ? `: ${node.returnType}` : "";
                    const prefix = node.isAsync ? "async " : "";
                    chain.push({ icon: "function", label: `${prefix}${node.id?.name || "anonymous"}()${ret}`, class: "function" });
                    break;
                }

                case "VariableDeclarator": {
                    if (node.isArrow) {
                        const ret = node.returnType ? `: ${node.returnType}` : "";
                        const prefix = node.isAsync ? "async " : "";
                        chain.push({ icon: "function", label: `${prefix}${node.id?.name || "anonymous"}()${ret}`, class: "function" });
                    } else {
                        const type = node.typeAnnotation ? `: ${node.typeAnnotation}` : "";
                        chain.push({ icon: "data_object", label: `${node.id?.name}${type}`, class: "variable" });
                    }
                    break;
                }

                default:
                    super.traverse(node, row, chain);
                    return;
            }
        }

        for (const key of ["body", "declarations", "properties", "members"]) {
            const val = node[key];
            if (Array.isArray(val)) val.forEach(v => this.traverse(v, row, chain));
            else if (val && typeof val === "object" && val.type) this.traverse(val, row, chain);
        }
    }
}