const { ipcMain } = require("electron");
const parser = require("@babel/parser");

function getLoc(node) {
    return {
        start: { line: node.loc.start.line, column: node.loc.start.column },
        end: { line: node.loc.end.line, column: node.loc.end.column },
    };
}

function convertNode(node) {
    if (!node || !node.type) return null;

    switch (node.type) {
        case "File":
            return convertNode(node.program);

        case "Program":
            return {
                type: "Program",
                loc: getLoc(node),
                body: node.body.map(convertNode).filter(Boolean),
            };

        case "VariableDeclaration":
            return {
                type: "VariableDeclaration",
                loc: getLoc(node),
                declarations: node.declarations.map(d => convertVariableDeclarator(d)),
            };

        case "ClassDeclaration":
        case "ClassExpression":
            return {
                type: "ClassDeclaration",
                id: { name: node.id?.name || "anonymous" },
                loc: getLoc(node),
                body: node.body.body.map(convertClassMember).filter(Boolean),
            };

        case "FunctionDeclaration":
            return {
                type: "FunctionDeclaration",
                id: node.id ? { name: node.id.name } : undefined,
                loc: getLoc(node),
                body: collectChildren(node.body),
            };

        case "ExpressionStatement":
            return convertExpressionStatement(node);

        case "CallExpression":
        case "OptionalCallExpression":
            return convertCallExpression(node);

        default:
            return convertGeneric(node);
    }
}

function convertVariableDeclarator(d) {
    const name = d.id?.name || d.id?.left?.name || "";
    const init = d.init;
    const loc = getLoc(d);

    if (init?.type === "ArrowFunctionExpression") {
        return {
            type: "VariableDeclarator",
            isArrow: true,
            id: { name },
            loc,
            body: collectChildren(init.body),
        };
    }

    if (init?.type === "ObjectExpression") {
        return {
            type: "VariableDeclarator",
            isObject: true,
            id: { name },
            loc,
            properties: init.properties.map(convertProperty).filter(Boolean),
        };
    }

    return { type: "VariableDeclarator", id: { name }, loc };
}

function convertProperty(node) {
    if (!node) return null;
    const loc = getLoc(node);

    // shorthand method: { foo() {} }
    if (node.type === "ObjectMethod") {
        return {
            type: "ObjectMethod",
            id: { name: node.key?.name || node.key?.value || "" },
            loc,
            body: collectChildren(node.body),
        };
    }

    if (node.type === "ObjectProperty") {
        const name = node.key?.name || node.key?.value || "";
        const value = node.value;

        if (value?.type === "ObjectExpression") {
            return {
                type: "Property",
                isObject: true,
                id: { name },
                loc,
                properties: value.properties.map(convertProperty).filter(Boolean),
            };
        }

        if (value?.type === "ArrowFunctionExpression") {
            return {
                type: "Property",
                isArrow: true,
                id: { name },
                loc,
                body: collectChildren(value.body),
            };
        }

        return { type: "Property", id: { name }, loc };
    }

    return null;
}

function convertClassMember(node) {
    if (!node) return null;
    const loc = getLoc(node);

    if (node.type === "ClassMethod" || node.type === "TSDeclareMethod") {
        const name = node.key?.name || node.key?.value || "";
        const isConstructor = node.kind === "constructor";

        if (isConstructor) {
            return {
                type: "MethodDefinition",
                isConstructor: true,
                key: { name: "constructor" },
                loc,
                body: collectChildren(node.body),
            };
        }

        return {
            type: "MethodDefinition",
            key: { name },
            isStatic: node.static ?? false,
            isAsync: node.async ?? false,
            isPrivate: node.access === "private" || name.startsWith("#"),
            isGetter: node.kind === "get",
            isSetter: node.kind === "set",
            loc,
            body: collectChildren(node.body),
        };
    }

    if (node.type === "ClassProperty" || node.type === "ClassAccessorProperty") {
        const name = node.key?.name || node.key?.value || "";
        return {
            type: "ClassProperty",
            id: { name },
            isStatic: node.static ?? false,
            isPrivate: node.access === "private" || name.startsWith("#"),
            loc,
        };
    }

    if (node.type === "ClassPrivateMethod") {
        return {
            type: "MethodDefinition",
            key: { name: "#" + (node.key?.id?.name || "") },
            isPrivate: true,
            isStatic: node.static ?? false,
            isAsync: node.async ?? false,
            loc,
            body: collectChildren(node.body),
        };
    }

    if (node.type === "ClassPrivateProperty") {
        return {
            type: "ClassProperty",
            id: { name: "#" + (node.key?.id?.name || "") },
            isPrivate: true,
            isStatic: node.static ?? false,
            loc,
        };
    }

    return null;
}

function convertExpressionStatement(node) {
    const expr = node.expression;
    if (
        expr?.type === "CallExpression" ||
        expr?.type === "OptionalCallExpression"
    ) {
        return convertCallExpression(expr);
    }
    return convertGeneric(node);
}

function convertCallExpression(node) {
    const callee = node.callee;
    let calleeName;

    if (callee?.type === "MemberExpression" || callee?.type === "OptionalMemberExpression") {
        const obj = callee.object?.name || callee.object?.escapedText || "<...>";
        const prop = callee.property?.name || callee.property?.value || "<...>";
        calleeName = `${obj}.${prop}()`;
    } else {
        const raw = callee?.name || callee?.escapedText || "";
        calleeName = raw ? `${raw}()` : "<...>";
    }

    return {
        type: "CallExpression",
        calleeName,
        loc: getLoc(node),
        body: collectChildren(node),
    };
}

function convertGeneric(node) {
    const result = {
        type: mapType(node.type),
        loc: getLoc(node),
    };

    if (node.id?.name) result.id = { name: node.id.name };
    if (node.key?.name) result.id = { name: node.key.name };

    const children = collectChildren(node);
    if (children.length) result.body = children;

    return result;
}

const SKIP_CHILD_KEYS = new Set(["loc", "start", "end", "extra", "trailingComments", "leadingComments", "innerComments"]);

function collectChildren(node) {
    if (!node) return [];
    const children = [];

    for (const key of Object.keys(node)) {
        if (SKIP_CHILD_KEYS.has(key)) continue;
        const val = node[key];

        if (Array.isArray(val)) {
            for (const child of val) {
                if (child && typeof child === "object" && child.type) {
                    const c = convertNode(child);
                    if (c) children.push(c);
                }
            }
        } else if (val && typeof val === "object" && val.type) {
            if (key === "body" || key === "declarations" || key === "properties" || key === "members") {
                const c = convertNode(val);
                if (c) children.push(c);
            }
        }
    }

    return children;
}

function mapType(type) {
    switch (type) {
        case "ArrowFunctionExpression": return "ArrowFunction";
        case "FunctionExpression": return "FunctionExpression";
        case "FunctionDeclaration": return "FunctionDeclaration";
        case "ClassDeclaration":
        case "ClassExpression": return "ClassDeclaration";
        case "ClassMethod":
        case "ObjectMethod": return "MethodDefinition";
        case "VariableDeclaration": return "VariableDeclaration";
        case "VariableDeclarator": return "VariableDeclarator";
        case "CallExpression":
        case "OptionalCallExpression": return "CallExpression";
        case "ObjectExpression": return "ObjectExpression";
        case "ObjectProperty": return "Property";
        case "ExpressionStatement": return "ExpressionStatement";
        case "BlockStatement": return "BlockStatement";
        case "Program": return "Program";
        default: return type;
    }
}

function buildAST(code, isTS = false) {
    const plugins = [
        "jsx",
        "decorators-legacy",
        "classProperties",
        "classPrivateMethods",
        "classPrivateProperties",
        "dynamicImport",
        "exportDefaultFrom",
        "optionalChaining",
        "nullishCoalescingOperator",
        "logicalAssignment",
    ];

    if (isTS) plugins.push("typescript");

    const ast = parser.parse(code, {
        sourceType: "unambiguous",
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        allowSuperOutsideMethod: true,
        errorRecovery: true,
        createParenthesizedExpressions: false,
        plugins,
    });

    return convertNode(ast);
}

ipcMain.handle("javascript-ast", (_, code, isTS = false) => {
    try {
        return buildAST(code, isTS);
    } catch (e) {
        return { type: "Program", loc: null, body: [] };
    }
});