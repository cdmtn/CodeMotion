const { ipcMain } = require("electron");
const ts = require("typescript");

function convertNode(node, sourceFile) {
    const result = {};

    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const end = sourceFile.getLineAndCharacterOfPosition(node.end);
    result.loc = {
        start: { line: start.line + 1, column: start.character },
        end: { line: end.line + 1, column: end.character },
    };

    if (node.kind === ts.SyntaxKind.VariableStatement) {
        result.type = "VariableDeclaration";
        result.declarations = node.declarationList.declarations.map(d => {
            const dStart = sourceFile.getLineAndCharacterOfPosition(d.getStart(sourceFile));
            const dEnd = sourceFile.getLineAndCharacterOfPosition(d.end);
            const loc = {
                start: { line: dStart.line + 1, column: dStart.character },
                end: { line: dEnd.line + 1, column: dEnd.character },
            };
            const name = d.name?.text || "";
            const init = d.initializer;

            // const fn = () => {}
            if (init?.kind === ts.SyntaxKind.ArrowFunction) {
                return {
                    type: "VariableDeclarator",
                    isArrow: true,
                    id: { name },
                    loc,
                    body: collectChildren(init, sourceFile),
                };
            }

            // const data = { ... }
            if (init?.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                return {
                    type: "VariableDeclarator",
                    isObject: true,
                    id: { name },
                    loc,
                    properties: init.properties.map(p => convertProperty(p, sourceFile)),
                };
            }

            return { type: "VariableDeclarator", id: { name }, loc };
        });
        return result;
    }

    if (node.kind === ts.SyntaxKind.ClassDeclaration) {
        result.type = "ClassDeclaration";
        result.id = { name: node.name?.text || "anonymous" };
        result.body = node.members.map(m => convertClassMember(m, sourceFile)).filter(Boolean);
        return result;
    }

    result.type = mapKind(node.kind);
    if (node.name?.text) result.id = { name: node.name.text };

    // CallExpression: console.log(), fn()
    if (node.kind === ts.SyntaxKind.CallExpression) {
        const callee = node.expression;
        let name = "";
        if (callee.kind === ts.SyntaxKind.PropertyAccessExpression) {
            const obj = callee.expression?.text || callee.expression?.escapedText || "<...>";
            const prop = callee.name?.text || "<...>";
            name = `${obj}.${prop}()`;
        } else {
            name = callee.text || callee.escapedText || "<...>";
            if (name !== "<...>") name += "()";
        }
        result.calleeName = name;
    }

    const children = collectChildren(node, sourceFile);
    if (node.kind === ts.SyntaxKind.SourceFile) {
        result.type = "Program";
        result.body = children;
    } else if (children.length) {
        result.body = children;
    }

    return result;
}

function convertProperty(node, sourceFile) {
    const s = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const e = sourceFile.getLineAndCharacterOfPosition(node.end);
    const name = node.name?.text || "";
    const loc = {
        start: { line: s.line + 1, column: s.character },
        end: { line: e.line + 1, column: e.character },
    };

    // method in object
    if (node.kind === ts.SyntaxKind.MethodDeclaration) {
        return { type: "ObjectMethod", id: { name }, loc, body: collectChildren(node.body, sourceFile) };
    }

    // for matryoshka object
    if (node.initializer?.kind === ts.SyntaxKind.ObjectLiteralExpression) {
        return {
            type: "Property",
            id: { name },
            loc,
            isObject: true,
            properties: node.initializer.properties.map(p => convertProperty(p, sourceFile)),
        };
    }

    // arrow functions
    if (node.initializer?.kind === ts.SyntaxKind.ArrowFunction) {
        return { type: "Property", isArrow: true, id: { name }, loc, body: collectChildren(node.initializer, sourceFile) };
    }

    return { type: "Property", id: { name }, loc };
}

function convertClassMember(node, sourceFile) {
    const s = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const e = sourceFile.getLineAndCharacterOfPosition(node.end);
    const loc = {
        start: { line: s.line + 1, column: s.character },
        end: { line: e.line + 1, column: e.character },
    };

    if (node.kind === ts.SyntaxKind.Constructor) {
        return { type: "MethodDefinition", isConstructor: true, key: { name: "constructor" }, loc, body: collectChildren(node.body, sourceFile) };
    }

    if (node.kind === ts.SyntaxKind.MethodDeclaration) {
        const isStatic = node.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword);
        const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
        const isPrivate = node.modifiers?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword)
            || node.name?.text?.startsWith("#");
        return {
            type: "MethodDefinition",
            key: { name: node.name?.text || "" },
            isStatic,
            isAsync,
            isPrivate,
            loc,
            body: collectChildren(node.body, sourceFile),
        };
    }

    // getters and setters
    if (node.kind === ts.SyntaxKind.GetAccessor) {
        return { type: "MethodDefinition", isGetter: true, key: { name: node.name?.text || "" }, loc, body: collectChildren(node.body, sourceFile) };
    }
    if (node.kind === ts.SyntaxKind.SetAccessor) {
        return { type: "MethodDefinition", isSetter: true, key: { name: node.name?.text || "" }, loc, body: collectChildren(node.body, sourceFile) };
    }

    // class field: x = 1 или static x = 1
    if (node.kind === ts.SyntaxKind.PropertyDeclaration) {
        const isStatic = node.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword);
        const isPrivate = node.modifiers?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword)
            || node.name?.text?.startsWith("#");
        return { type: "ClassProperty", id: { name: node.name?.text || "" }, isStatic, isPrivate, loc };
    }

    return null;
}

function collectChildren(node, sourceFile) {
    if (!node) return [];
    const children = [];
    ts.forEachChild(node, child => {
        const c = convertNode(child, sourceFile);
        if (c) children.push(c);
    });
    return children;
}

function mapKind(kind) {
    switch (kind) {
        case ts.SyntaxKind.GetAccessor: return "MethodDefinition";
        case ts.SyntaxKind.SetAccessor: return "MethodDefinition";
        case ts.SyntaxKind.FunctionDeclaration: return "FunctionDeclaration";
        case ts.SyntaxKind.FunctionExpression: return "FunctionExpression";
        case ts.SyntaxKind.ArrowFunction: return "ArrowFunction";
        case ts.SyntaxKind.ClassDeclaration: return "ClassDeclaration";
        case ts.SyntaxKind.MethodDeclaration: return "MethodDefinition";
        case ts.SyntaxKind.Constructor: return "MethodDefinition";
        case ts.SyntaxKind.VariableDeclaration: return "VariableDeclarator";
        case ts.SyntaxKind.VariableStatement: return "VariableDeclaration";
        case ts.SyntaxKind.CallExpression: return "CallExpression";
        case ts.SyntaxKind.ObjectLiteralExpression: return "ObjectExpression";
        case ts.SyntaxKind.PropertyAssignment: return "Property";
        case ts.SyntaxKind.ExpressionStatement: return "ExpressionStatement";
        case ts.SyntaxKind.Block: return "BlockStatement";
        case ts.SyntaxKind.SourceFile: return "Program";
        default: return ts.SyntaxKind[kind];
    }
}

function buildAST(code) {
    const sourceFile = ts.createSourceFile(
        "file.js",
        code,
        ts.ScriptTarget.ES2020,
        true,
        ts.ScriptKind.JS
    );
    return convertNode(sourceFile, sourceFile);
}

ipcMain.handle("javascript-ast", (_, code) => {
    return buildAST(code);
});