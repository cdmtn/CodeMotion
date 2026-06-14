const { ipcMain } = require("electron");
const parser = require("@babel/parser");

const BABEL_PLUGINS = [
    "typescript",
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

function getLoc(node) {
    return {
        start: { line: node.loc.start.line, column: node.loc.start.column },
        end: { line: node.loc.end.line, column: node.loc.end.column },
    };
}

function getTypeAnnotation(node) {
    const ann = node?.typeAnnotation ?? node?.returnType;
    if (!ann) return null;
    return serializeType(ann.typeAnnotation ?? ann);
}

function getTypeParams(node) {
    return node?.typeParameters?.params?.map(p => p.name?.name || p.name || "") || [];
}

function serializeType(node) {
    if (!node) return null;
    switch (node.type) {
        case "TSStringKeyword": return "string";
        case "TSNumberKeyword": return "number";
        case "TSBooleanKeyword": return "boolean";
        case "TSAnyKeyword": return "any";
        case "TSUnknownKeyword": return "unknown";
        case "TSNeverKeyword": return "never";
        case "TSVoidKeyword": return "void";
        case "TSNullKeyword": return "null";
        case "TSUndefinedKeyword": return "undefined";
        case "TSObjectKeyword": return "object";
        case "TSSymbolKeyword": return "symbol";
        case "TSBigIntKeyword": return "bigint";
        case "TSArrayType": return `${serializeType(node.elementType)}[]`;
        case "TSUnionType": return node.types.map(serializeType).join(" | ");
        case "TSIntersectionType": return node.types.map(serializeType).join(" & ");
        case "TSTypeReference": {
            const name = node.typeName?.name || node.typeName?.right?.name || "";
            const params = node.typeParameters?.params?.map(serializeType).join(", ");
            return params ? `${name}<${params}>` : name;
        }
        case "TSLiteralType":
            return String(node.literal?.value ?? "");
        case "TSParenthesizedType":
            return `(${serializeType(node.typeAnnotation)})`;
        case "TSOptionalType":
            return `${serializeType(node.typeAnnotation)}?`;
        case "TSRestType":
            return `...${serializeType(node.typeAnnotation)}`;
        case "TSTupleType":
            return `[${node.elementTypes?.map(serializeType).join(", ")}]`;
        case "TSFunctionType": {
            const params = node.parameters?.map(p => {
                const t = getTypeAnnotation(p);
                return t ? `${p.name || ""}: ${t}` : (p.name || "");
            }).join(", ");
            return `(${params}) => ${serializeType(node.typeAnnotation?.typeAnnotation)}`;
        }
        case "TSTypePredicate":
            return `${node.parameterName?.name} is ${serializeType(node.typeAnnotation?.typeAnnotation)}`;
        case "TSMappedType":
            return "{...}";
        case "TSConditionalType":
            return `${serializeType(node.checkType)} extends ${serializeType(node.extendsType)} ? ${serializeType(node.trueType)} : ${serializeType(node.falseType)}`;
        case "TSIndexedAccessType":
            return `${serializeType(node.objectType)}[${serializeType(node.indexType)}]`;
        default:
            return node.type || null;
    }
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
                declarations: node.declarations.map(convertVariableDeclarator),
            };

        case "ClassDeclaration":
        case "ClassExpression": {
            const heritage = node.superClass
                ? [node.superClass.name || ""].filter(Boolean)
                : [];
            const impl = node.implements?.map(i => i.expression?.name || "") || [];
            return {
                type: "ClassDeclaration",
                id: { name: node.id?.name || "anonymous" },
                isAbstract: node.abstract ?? false,
                extends: heritage,
                implements: impl,
                loc: getLoc(node),
                body: node.body.body.map(convertClassMember).filter(Boolean),
            };
        }

        case "TSInterfaceDeclaration":
            return {
                type: "InterfaceDeclaration",
                id: { name: node.id?.name || "" },
                extends: node.extends?.map(e => e.expression?.name || "") || [],
                loc: getLoc(node),
                body: node.body.body.map(convertInterfaceMember).filter(Boolean),
            };

        case "TSTypeAliasDeclaration":
            return {
                type: "TypeAlias",
                id: { name: node.id?.name || "" },
                typeParams: getTypeParams(node),
                loc: getLoc(node),
            };

        case "TSEnumDeclaration":
            return {
                type: "EnumDeclaration",
                id: { name: node.id?.name || "" },
                isConst: node.const ?? false,
                members: node.members.map(m => ({
                    type: "EnumMember",
                    id: { name: m.id?.name || m.id?.value || "" },
                    loc: getLoc(m),
                })),
                loc: getLoc(node),
            };

        case "FunctionDeclaration":
            return {
                type: "FunctionDeclaration",
                id: { name: node.id?.name || "anonymous" },
                isAsync: node.async ?? false,
                returnType: getTypeAnnotation(node),
                typeParams: getTypeParams(node),
                loc: getLoc(node),
                body: collectChildren(node.body),
            };

        case "ExpressionStatement":
            return convertExpressionStatement(node);

        case "CallExpression":
        case "OptionalCallExpression":
            return convertCallExpression(node);

        case "TSModuleDeclaration":
        case "TSDeclareFunction":
            return convertGeneric(node);

        default:
            return convertGeneric(node);
    }
}

function convertVariableDeclarator(d) {
    const name = d.id?.name || "";
    const init = d.init;
    const loc = getLoc(d);

    if (init?.type === "ArrowFunctionExpression") {
        return {
            type: "VariableDeclarator",
            isArrow: true,
            isAsync: init.async ?? false,
            returnType: getTypeAnnotation(init),
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

    return {
        type: "VariableDeclarator",
        id: { name },
        typeAnnotation: getTypeAnnotation(d.id),
        loc,
    };
}

function convertProperty(node) {
    if (!node) return null;
    const loc = getLoc(node);

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

    const isStatic = node.static ?? false;
    const isAsync = node.async ?? false;
    const isAbstract = node.abstract ?? false;
    const isOverride = node.override ?? false;
    const isReadonly = node.readonly ?? false;
    const isPrivate = node.access === "private" || (node.key?.name || node.key?.id?.name || "").startsWith("#");
    const isProtected = node.access === "protected";

    if (node.type === "ClassMethod") {
        if (node.kind === "constructor") {
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
            key: { name: node.key?.name || node.key?.value || "" },
            returnType: getTypeAnnotation(node),
            typeParams: getTypeParams(node),
            isStatic, isAsync, isPrivate, isAbstract, isOverride, isProtected,
            isGetter: node.kind === "get",
            isSetter: node.kind === "set",
            loc,
            body: collectChildren(node.body),
        };
    }

    if (node.type === "ClassPrivateMethod") {
        return {
            type: "MethodDefinition",
            key: { name: "#" + (node.key?.id?.name || "") },
            isPrivate: true,
            isStatic, isAsync,
            isGetter: node.kind === "get",
            isSetter: node.kind === "set",
            loc,
            body: collectChildren(node.body),
        };
    }

    if (node.type === "ClassProperty" || node.type === "ClassAccessorProperty") {
        return {
            type: "ClassProperty",
            id: { name: node.key?.name || node.key?.value || "" },
            typeAnnotation: getTypeAnnotation(node),
            isStatic, isPrivate, isReadonly, isAbstract, isProtected,
            loc,
        };
    }

    if (node.type === "ClassPrivateProperty") {
        return {
            type: "ClassProperty",
            id: { name: "#" + (node.key?.id?.name || "") },
            isPrivate: true,
            isStatic, isReadonly,
            loc,
        };
    }

    if (node.type === "TSIndexSignature") {
        return { type: "IndexSignature", loc };
    }

    if (node.type === "TSDeclareMethod") {
        return {
            type: "MethodDefinition",
            key: { name: node.key?.name || "" },
            isAbstract: true,
            isStatic, isPrivate, isProtected,
            returnType: getTypeAnnotation(node),
            typeParams: getTypeParams(node),
            loc,
        };
    }

    return null;
}

function convertInterfaceMember(node) {
    if (!node) return null;
    const loc = getLoc(node);

    if (node.type === "TSMethodSignature") {
        return {
            type: "InterfaceMethod",
            id: { name: node.key?.name || node.key?.value || "" },
            returnType: getTypeAnnotation(node),
            isOptional: node.optional ?? false,
            loc,
        };
    }

    if (node.type === "TSPropertySignature") {
        return {
            type: "InterfaceProperty",
            id: { name: node.key?.name || node.key?.value || "" },
            typeAnnotation: getTypeAnnotation(node),
            isOptional: node.optional ?? false,
            isReadonly: node.readonly ?? false,
            loc,
        };
    }

    if (node.type === "TSIndexSignature") {
        return { type: "IndexSignature", loc };
    }

    return null;
}

function convertExpressionStatement(node) {
    const expr = node.expression;
    if (expr?.type === "CallExpression" || expr?.type === "OptionalCallExpression") {
        return convertCallExpression(expr);
    }
    return convertGeneric(node);
}

function convertCallExpression(node) {
    const callee = node.callee;
    let calleeName;

    if (callee?.type === "MemberExpression" || callee?.type === "OptionalMemberExpression") {
        const obj = callee.object?.name || "<...>";
        const prop = callee.property?.name || callee.property?.value || "<...>";
        calleeName = `${obj}.${prop}()`;
    } else {
        const raw = callee?.name || "";
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

const SKIP_KEYS = new Set([
    "loc", "start", "end", "extra",
    "trailingComments", "leadingComments", "innerComments",
    "typeAnnotation", "returnType", "typeParameters",
]);

function collectChildren(node) {
    if (!node) return [];
    const children = [];

    for (const key of Object.keys(node)) {
        if (SKIP_KEYS.has(key)) continue;
        const val = node[key];

        if (Array.isArray(val)) {
            for (const child of val) {
                if (child && typeof child === "object" && child.type) {
                    const c = convertNode(child);
                    if (c) children.push(c);
                }
            }
        } else if (val && typeof val === "object" && val.type) {
            if (key === "body" || key === "declarations") {
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
        case "TSInterfaceDeclaration": return "InterfaceDeclaration";
        case "TSTypeAliasDeclaration": return "TypeAlias";
        case "TSEnumDeclaration": return "EnumDeclaration";
        case "Program": return "Program";
        default: return type;
    }
}

function buildAST(code) {
    const ast = parser.parse(code, {
        sourceType: "unambiguous",
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        allowSuperOutsideMethod: true,
        errorRecovery: true,
        plugins: BABEL_PLUGINS,
    });

    return convertNode(ast);
}

ipcMain.handle("typescript-ast", (_, code) => {
    try {
        return buildAST(code);
    } catch (e) {
        return { type: "Program", loc: null, body: [] };
    }
});