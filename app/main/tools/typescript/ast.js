const { ipcMain } = require("electron");
const ts = require("typescript");

function convertNode(node, sourceFile) {
    const result = {};

    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const end = sourceFile.getLineAndCharacterOfPosition(node.end);
    result.loc = {
        start: { line: start.line + 1, column: start.character },
        end:   { line: end.line + 1,   column: end.character },
    };

    // VariableStatement → VariableDeclaration + declarations[]
    if (node.kind === ts.SyntaxKind.VariableStatement) {
        result.type = "VariableDeclaration";
        result.declarations = node.declarationList.declarations.map(d => {
            const dStart = sourceFile.getLineAndCharacterOfPosition(d.getStart(sourceFile));
            const dEnd = sourceFile.getLineAndCharacterOfPosition(d.end);
            const loc = {
                start: { line: dStart.line + 1, column: dStart.character },
                end:   { line: dEnd.line + 1,   column: dEnd.character },
            };
            const name = d.name?.text || "";
            const init = d.initializer;

            if (init?.kind === ts.SyntaxKind.ArrowFunction) {
                return {
                    type: "VariableDeclarator",
                    isArrow: true,
                    isAsync: init.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword),
                    returnType: init.type ? init.type.getText(sourceFile) : null,
                    id: { name },
                    loc,
                    body: collectChildren(init, sourceFile),
                };
            }

            if (init?.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                return {
                    type: "VariableDeclarator",
                    isObject: true,
                    id: { name },
                    loc,
                    properties: init.properties.map(p => convertProperty(p, sourceFile)),
                };
            }

            return {
                type: "VariableDeclarator",
                id: { name },
                typeAnnotation: d.type ? d.type.getText(sourceFile) : null,
                loc,
            };
        });
        return result;
    }

    // ClassDeclaration
    if (node.kind === ts.SyntaxKind.ClassDeclaration) {
        result.type = "ClassDeclaration";
        result.id = { name: node.name?.text || "anonymous" };
        result.isAbstract = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AbstractKeyword);
        result.implements = node.heritageClauses
            ?.filter(h => h.token === ts.SyntaxKind.ImplementsKeyword)
            ?.flatMap(h => h.types.map(t => t.expression?.text)) || [];
        result.extends = node.heritageClauses
            ?.filter(h => h.token === ts.SyntaxKind.ExtendsKeyword)
            ?.flatMap(h => h.types.map(t => t.expression?.text)) || [];
        result.body = node.members.map(m => convertClassMember(m, sourceFile)).filter(Boolean);
        return result;
    }

    // InterfaceDeclaration
    if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
        result.type = "InterfaceDeclaration";
        result.id = { name: node.name?.text || "" };
        result.extends = node.heritageClauses
            ?.flatMap(h => h.types.map(t => t.expression?.text)) || [];
        result.body = node.members.map(m => convertInterfaceMember(m, sourceFile)).filter(Boolean);
        return result;
    }

    // TypeAliasDeclaration: type Foo = ...
    if (node.kind === ts.SyntaxKind.TypeAliasDeclaration) {
        result.type = "TypeAlias";
        result.id = { name: node.name?.text || "" };
        result.typeParams = node.typeParameters?.map(p => p.name?.text) || [];
        result.loc = result.loc;
        return result;
    }

    // EnumDeclaration
    if (node.kind === ts.SyntaxKind.EnumDeclaration) {
        result.type = "EnumDeclaration";
        result.id = { name: node.name?.text || "" };
        result.isConst = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ConstKeyword);
        result.members = node.members.map(m => {
            const ms = sourceFile.getLineAndCharacterOfPosition(m.getStart(sourceFile));
            const me = sourceFile.getLineAndCharacterOfPosition(m.end);
            return {
                type: "EnumMember",
                id: { name: m.name?.text || "" },
                loc: {
                    start: { line: ms.line + 1, column: ms.character },
                    end:   { line: me.line + 1, column: me.character },
                },
            };
        });
        return result;
    }

    // FunctionDeclaration
    if (node.kind === ts.SyntaxKind.FunctionDeclaration) {
        result.type = "FunctionDeclaration";
        result.id = { name: node.name?.text || "anonymous" };
        result.isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
        result.returnType = node.type ? node.type.getText(sourceFile) : null;
        result.typeParams = node.typeParameters?.map(p => p.name?.text) || [];
        result.body = collectChildren(node.body, sourceFile);
        return result;
    }

    // CallExpression
    if (node.kind === ts.SyntaxKind.CallExpression) {
        result.type = "CallExpression";
        const callee = node.expression;
        let name = "";
        if (callee.kind === ts.SyntaxKind.PropertyAccessExpression) {
            const obj = callee.expression?.text || callee.expression?.escapedText || "<...>";
            const prop = callee.name?.text || "<...>";
            name = `${obj}.${prop}()`;
        } else {
            name = callee.text || callee.escapedText || "<...>";
            if (name && name !== "<...>") name += "()";
        }
        result.calleeName = name;
        result.body = collectChildren(node, sourceFile);
        return result;
    }

    result.type = mapKind(node.kind);
    if (node.name?.text) result.id = { name: node.name.text };

    const children = collectChildren(node, sourceFile);
    if (node.kind === ts.SyntaxKind.SourceFile) {
        result.type = "Program";
        result.body = children;
    } else if (children.length) {
        result.body = children;
    }

    return result;
}

function convertClassMember(node, sourceFile) {
    const s = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const e = sourceFile.getLineAndCharacterOfPosition(node.end);
    const loc = {
        start: { line: s.line + 1, column: s.character },
        end:   { line: e.line + 1, column: e.character },
    };

    const isStatic   = node.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword);
    const isAsync    = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
    const isPrivate  = node.modifiers?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword) || node.name?.text?.startsWith("#");
    const isReadonly = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ReadonlyKeyword);
    const isAbstract = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AbstractKeyword);
    const isOverride = node.modifiers?.some(m => m.kind === ts.SyntaxKind.OverrideKeyword);
    const isProtected = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ProtectedKeyword);

    if (node.kind === ts.SyntaxKind.Constructor) {
        return {
            type: "MethodDefinition",
            isConstructor: true,
            key: { name: "constructor" },
            loc,
            body: collectChildren(node.body, sourceFile),
        };
    }

    if (node.kind === ts.SyntaxKind.MethodDeclaration) {
        return {
            type: "MethodDefinition",
            key: { name: node.name?.text || "" },
            returnType: node.type ? node.type.getText(sourceFile) : null,
            typeParams: node.typeParameters?.map(p => p.name?.text) || [],
            isStatic, isAsync, isPrivate, isAbstract, isOverride, isProtected,
            loc,
            body: collectChildren(node.body, sourceFile),
        };
    }

    if (node.kind === ts.SyntaxKind.GetAccessor) {
        return {
            type: "MethodDefinition",
            isGetter: true,
            key: { name: node.name?.text || "" },
            returnType: node.type ? node.type.getText(sourceFile) : null,
            isStatic, isPrivate, isProtected,
            loc,
            body: collectChildren(node.body, sourceFile),
        };
    }

    if (node.kind === ts.SyntaxKind.SetAccessor) {
        return {
            type: "MethodDefinition",
            isSetter: true,
            key: { name: node.name?.text || "" },
            isStatic, isPrivate, isProtected,
            loc,
            body: collectChildren(node.body, sourceFile),
        };
    }

    if (node.kind === ts.SyntaxKind.PropertyDeclaration) {
        return {
            type: "ClassProperty",
            id: { name: node.name?.text || "" },
            typeAnnotation: node.type ? node.type.getText(sourceFile) : null,
            isStatic, isPrivate, isReadonly, isAbstract, isProtected,
            loc,
        };
    }

    // index signature: [key: string]: number
    if (node.kind === ts.SyntaxKind.IndexSignature) {
        return { type: "IndexSignature", loc };
    }

    return null;
}

function convertInterfaceMember(node, sourceFile) {
    const s = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const e = sourceFile.getLineAndCharacterOfPosition(node.end);
    const loc = {
        start: { line: s.line + 1, column: s.character },
        end:   { line: e.line + 1, column: e.character },
    };

    if (node.kind === ts.SyntaxKind.MethodSignature) {
        return {
            type: "InterfaceMethod",
            id: { name: node.name?.text || "" },
            returnType: node.type ? node.type.getText(sourceFile) : null,
            isOptional: !!node.questionToken,
            loc,
        };
    }

    if (node.kind === ts.SyntaxKind.PropertySignature) {
        return {
            type: "InterfaceProperty",
            id: { name: node.name?.text || "" },
            typeAnnotation: node.type ? node.type.getText(sourceFile) : null,
            isOptional: !!node.questionToken,
            isReadonly: node.modifiers?.some(m => m.kind === ts.SyntaxKind.ReadonlyKeyword),
            loc,
        };
    }

    return null;
}

function convertProperty(node, sourceFile) {
    const s = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const e = sourceFile.getLineAndCharacterOfPosition(node.end);
    const loc = {
        start: { line: s.line + 1, column: s.character },
        end:   { line: e.line + 1, column: e.character },
    };

    if (node.kind === ts.SyntaxKind.MethodDeclaration) {
        return { type: "ObjectMethod", id: { name: node.name?.text || "" }, loc, body: collectChildren(node.body, sourceFile) };
    }

    if (node.initializer?.kind === ts.SyntaxKind.ObjectLiteralExpression) {
        return {
            type: "Property",
            isObject: true,
            id: { name: node.name?.text || "" },
            loc,
            properties: node.initializer.properties.map(p => convertProperty(p, sourceFile)),
        };
    }

    if (node.initializer?.kind === ts.SyntaxKind.ArrowFunction) {
        return { type: "Property", isArrow: true, id: { name: node.name?.text || "" }, loc, body: collectChildren(node.initializer, sourceFile) };
    }

    return { type: "Property", id: { name: node.name?.text || "" }, loc };
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
        case ts.SyntaxKind.FunctionDeclaration:        return "FunctionDeclaration";
        case ts.SyntaxKind.FunctionExpression:         return "FunctionExpression";
        case ts.SyntaxKind.ArrowFunction:              return "ArrowFunction";
        case ts.SyntaxKind.ClassDeclaration:           return "ClassDeclaration";
        case ts.SyntaxKind.MethodDeclaration:          return "MethodDefinition";
        case ts.SyntaxKind.Constructor:                return "MethodDefinition";
        case ts.SyntaxKind.GetAccessor:                return "MethodDefinition";
        case ts.SyntaxKind.SetAccessor:                return "MethodDefinition";
        case ts.SyntaxKind.VariableDeclaration:        return "VariableDeclarator";
        case ts.SyntaxKind.VariableStatement:          return "VariableDeclaration";
        case ts.SyntaxKind.CallExpression:             return "CallExpression";
        case ts.SyntaxKind.ObjectLiteralExpression:    return "ObjectExpression";
        case ts.SyntaxKind.PropertyAssignment:         return "Property";
        case ts.SyntaxKind.InterfaceDeclaration:       return "InterfaceDeclaration";
        case ts.SyntaxKind.TypeAliasDeclaration:       return "TypeAlias";
        case ts.SyntaxKind.EnumDeclaration:            return "EnumDeclaration";
        case ts.SyntaxKind.ExpressionStatement:        return "ExpressionStatement";
        case ts.SyntaxKind.Block:                      return "BlockStatement";
        case ts.SyntaxKind.SourceFile:                 return "Program";
        default: return ts.SyntaxKind[kind];
    }
}

function buildAST(code) {
    const sourceFile = ts.createSourceFile(
        "file.ts",
        code,
        ts.ScriptTarget.ES2020,
        true,
        ts.ScriptKind.TS
    );
    return convertNode(sourceFile, sourceFile);
}

ipcMain.handle("typescript-ast", (_, code) => {
    return buildAST(code);
});