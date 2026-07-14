const { ipcMain } = require("electron");
const Parser = require("tree-sitter");
const Go = require("tree-sitter-go");

const parser = new Parser();
parser.setLanguage(Go);

function getLoc(node) {
    return {
        start: { line: node.startPosition.row + 1, column: node.startPosition.column },
        end: { line: node.endPosition.row + 1, column: node.endPosition.column },
    };
}

function childByType(node, type) {
    return node.children.find(c => c.type === type) || null;
}

function childrenByType(node, type) {
    return node.children.filter(c => c.type === type);
}

function nodeText(node) {
    return node ? node.text : "";
}

function extractType(node) {
    if (!node) return null;
    switch (node.type) {
        case "type_identifier":
        case "qualified_type": return node.text;
        case "pointer_type": return "*" + extractType(node.children.find(c => c.type !== "*"));
        case "slice_type": return "[]" + extractType(node.children.find(c => c.type !== "[" && c.type !== "]"));
        case "array_type": {
            const size = childByType(node, "int_literal");
            const elem = node.children.find(c => c.type !== "[" && c.type !== "]" && c.type !== "int_literal");
            return `[${nodeText(size)}]${extractType(elem)}`;
        }
        case "map_type": {
            const key = node.children.find(c => c.type !== "map" && c.type !== "[" && c.type !== "]");
            const val = node.children.slice(-1)[0];
            return `map[${extractType(key)}]${extractType(val)}`;
        }
        case "channel_type": return "chan " + extractType(node.children.find(c => c.type !== "chan" && c.type !== "<-"));
        case "interface_type": return "interface{}";
        case "function_type": return "func(...)";
        case "struct_type": return "struct{...}";
        default: return node.text;
    }
}

function extractTag(node) {
    if (!node) return null;
    if (node.type === "raw_string_literal") {
        const content = childByType(node, "raw_string_literal_content");
        return content ? content.text : null;
    }
    return null;
}

function extractCalleeName(node) {
    if (!node) return "<...>";
    if (node.type === "selector_expression") {
        const obj = node.children[0];
        const prop = node.children[2];
        return `${nodeText(obj)}.${nodeText(prop)}`;
    }
    if (node.type === "identifier") return node.text;
    return node.text || "<...>";
}

function convertSourceFile(node) {
    return {
        type: "Program",
        loc: getLoc(node),
        body: node.children.map(convertTopLevel).filter(Boolean),
    };
}

function convertTopLevel(node) {
    switch (node.type) {
        case "package_clause": return convertPackage(node);
        case "import_declaration": return convertImport(node);
        case "function_declaration": return convertFunction(node);
        case "method_declaration": return convertMethod(node);
        case "type_declaration": return convertTypeDecl(node);
        case "var_declaration": return convertVarDecl(node);
        case "const_declaration": return convertConstDecl(node);
        default: return null;
    }
}

function convertPackage(node) {
    const nameNode = childByType(node, "package_identifier");
    return {
        type: "PackageDeclaration",
        id: { name: nodeText(nameNode) },
        loc: getLoc(node),
    };
}

function convertImport(node) {
    const paths = [];

    function collectSpec(spec) {
        const alias = childByType(spec, "package_identifier") || childByType(spec, "dot") || childByType(spec, "blank_identifier");
        const pathNode = childByType(spec, "interpreted_string_literal");
        if (pathNode) {
            const raw = nodeText(pathNode).replace(/^"|"$/g, "");
            paths.push({ path: raw, alias: alias ? nodeText(alias) : null });
        }
    }

    const specList = childByType(node, "import_spec_list");
    if (specList) {
        childrenByType(specList, "import_spec").forEach(collectSpec);
    } else {
        const spec = childByType(node, "import_spec");
        if (spec) collectSpec(spec);
    }

    return { type: "ImportDeclaration", paths, loc: getLoc(node) };
}

function convertFunction(node) {
    const nameNode = childByType(node, "identifier");
    const paramList = childByType(node, "parameter_list");
    const block = childByType(node, "block");

    return {
        type: "FunctionDeclaration",
        id: { name: nodeText(nameNode) },
        params: convertParams(paramList),
        returnType: extractReturnType(node),
        loc: getLoc(node),
        body: block ? convertBlock(block) : [],
    };
}

function convertMethod(node) {
    const paramLists = childrenByType(node, "parameter_list");
    const receiver = paramLists[0] ? convertReceiver(paramLists[0]) : null;
    const nameNode = childByType(node, "identifier") || childByType(node, "field_identifier");
    const block = childByType(node, "block");

    return {
        type: "MethodDeclaration",
        id: { name: nodeText(nameNode) },
        receiver,
        params: convertParams(paramLists[1] || null),
        returnType: extractReturnType(node),
        loc: getLoc(node),
        body: block ? convertBlock(block) : [],
    };
}

function convertReceiver(node) {
    const decl = childByType(node, "parameter_declaration");
    if (!decl) return { name: "", typeName: nodeText(node) };
    const ident = childByType(decl, "identifier");
    const typeNode = decl.children.find(c => c !== ident && c.type !== "," && c.type !== "(" && c.type !== ")");
    return {
        name: nodeText(ident),
        typeName: extractType(typeNode),
    };
}

function convertParams(node) {
    if (!node) return [];
    return childrenByType(node, "parameter_declaration")
        .concat(childrenByType(node, "variadic_parameter_declaration"))
        .map(p => {
            const idents = p.children.filter(c => c.type === "identifier");
            const isVariadic = p.type === "variadic_parameter_declaration";
            const typeNode = p.children.find(c =>
                c.type !== "identifier" && c.type !== "," && c.type !== "..." &&
                c.type !== "(" && c.type !== ")"
            );
            return {
                names: idents.map(nodeText),
                paramType: (isVariadic ? "..." : "") + extractType(typeNode),
            };
        });
}

function extractReturnType(node) {
    const children = node.children;
    const blockIdx = children.findIndex(c => c.type === "block");
    const after = blockIdx > -1 ? children.slice(0, blockIdx) : children;
    const paramLists = after.filter(c => c.type === "parameter_list");
    const lastPL = paramLists[paramLists.length - 1];
    const lastPLIdx = lastPL ? after.indexOf(lastPL) : -1;
    const retNodes = after.slice(lastPLIdx + 1).filter(c =>
        c.type !== "func" && c.type !== "identifier" && c.type !== "field_identifier"
    );
    if (retNodes.length === 0) return null;
    if (retNodes.length === 1 && retNodes[0].type === "parameter_list") {
        return nodeText(retNodes[0]);
    }
    return retNodes.map(n => extractType(n) || nodeText(n)).join(", ").trim() || null;
}

function convertTypeDecl(node) {
    const specs = childrenByType(node, "type_spec");
    if (specs.length === 0) return null;
    if (specs.length === 1) return convertTypeSpec(specs[0]);
    return {
        type: "TypeGroup",
        loc: getLoc(node),
        body: specs.map(convertTypeSpec).filter(Boolean),
    };
}

function convertTypeSpec(node) {
    const nameNode = childByType(node, "type_identifier");
    const name = nodeText(nameNode);
    const typeNode = node.children.find(c => c !== nameNode && c.type !== "=" && c.type !== "type_identifier");

    if (!typeNode) return { type: "TypeAlias", id: { name }, loc: getLoc(node) };

    if (typeNode.type === "struct_type") {
        return {
            type: "StructDeclaration",
            id: { name },
            fields: convertStructFields(typeNode),
            loc: getLoc(node),
        };
    }

    if (typeNode.type === "interface_type") {
        return {
            type: "InterfaceDeclaration",
            id: { name },
            methods: convertInterfaceBody(typeNode),
            loc: getLoc(node),
        };
    }

    return {
        type: "TypeAlias",
        id: { name },
        aliasFor: extractType(typeNode),
        loc: getLoc(node),
    };
}

function convertStructFields(node) {
    const fieldList = childByType(node, "field_declaration_list");
    if (!fieldList) return [];

    return childrenByType(fieldList, "field_declaration").map(f => {
        const idents = f.children.filter(c => c.type === "field_identifier");
        const typeNode = f.children.find(c =>
            c.type !== "field_identifier" && c.type !== "," &&
            c.type !== "raw_string_literal" && c.type !== "interpreted_string_literal"
        );
        const tagNode = f.children.find(c =>
            c.type === "raw_string_literal" || c.type === "interpreted_string_literal"
        );
        return {
            type: "StructField",
            names: idents.map(nodeText),
            fieldType: extractType(typeNode),
            tag: extractTag(tagNode),
            loc: getLoc(f),
        };
    });
}

function convertInterfaceBody(node) {
    const body = childByType(node, "interface_body") || node;
    const methods = [];

    for (const child of body.children) {
        if (child.type === "method_elem") {
            const nameNode = childByType(child, "field_identifier");
            const paramList = childByType(child, "parameter_list");
            methods.push({
                type: "InterfaceMethod",
                id: { name: nodeText(nameNode) },
                params: convertParams(paramList),
                returnType: extractReturnType(child),
                loc: getLoc(child),
            });
        }
        if (child.type === "type_identifier") {
            methods.push({
                type: "InterfaceEmbed",
                id: { name: nodeText(child) },
                loc: getLoc(child),
            });
        }
    }

    return methods;
}

function convertVarDecl(node) {
    const specs = childrenByType(node, "var_spec");
    return {
        type: "VariableDeclaration",
        kind: "var",
        declarations: specs.map(s => {
            const idents = s.children.filter(c => c.type === "identifier");
            const typeNode = s.children.find(c =>
                c.type !== "identifier" && c.type !== "=" &&
                c.type !== "," && c.type !== "expression_list"
            );
            return {
                type: "VariableDeclarator",
                names: idents.map(nodeText),
                varType: extractType(typeNode),
                loc: getLoc(s),
            };
        }),
        loc: getLoc(node),
    };
}

function convertConstDecl(node) {
    const specs = childrenByType(node, "const_spec");
    return {
        type: "ConstDeclaration",
        declarations: specs.map(s => ({
            type: "ConstDeclarator",
            names: s.children.filter(c => c.type === "identifier").map(nodeText),
            loc: getLoc(s),
        })),
        loc: getLoc(node),
    };
}

function convertBlock(node) {
    const stmtList = childByType(node, "statement_list");
    const source = stmtList || node;
    return source.children.map(convertStatement).filter(Boolean);
}

function convertStatement(node) {
    switch (node.type) {
        case "short_var_declaration": return convertShortVar(node);
        case "var_declaration": return convertVarDecl(node);
        case "const_declaration": return convertConstDecl(node);
        case "assignment_statement": return convertAssignment(node);
        case "expression_statement": return convertExprStatement(node);
        case "call_expression": return convertCallExpr(node);
        case "if_statement": return convertIf(node);
        case "for_statement": return convertFor(node);
        case "return_statement": return { type: "ReturnStatement", loc: getLoc(node) };
        case "go_statement": return { type: "GoStatement", call: convertCallExpr(childByType(node, "call_expression")), loc: getLoc(node) };
        case "defer_statement": return { type: "DeferStatement", call: convertCallExpr(childByType(node, "call_expression")), loc: getLoc(node) };
        case "block": return { type: "Block", loc: getLoc(node), body: convertBlock(node) };
        default: return null;
    }
}

function convertShortVar(node) {
    const leftList = node.children[0];
    const rightList = node.children[2];
    const names = leftList?.children.filter(c => c.type === "identifier").map(nodeText) || [];
    const values = rightList?.children.filter(c => c.type !== ",").map(convertExprNode).filter(Boolean) || [];
    return { type: "ShortVarDeclaration", names, values, loc: getLoc(node) };
}

function convertAssignment(node) {
    const leftList = node.children[0];
    const names = leftList?.children
        .filter(c => c.type === "identifier" || c.type === "selector_expression")
        .map(nodeText) || [];
    return { type: "AssignmentStatement", names, loc: getLoc(node) };
}

function convertExprStatement(node) {
    const inner = node.children[0];
    return inner ? convertExprNode(inner) : null;
}

function convertCallExpr(node) {
    if (!node) return null;
    const fnNode = node.children[0];
    const callee = extractCalleeName(fnNode);
    const argList = childByType(node, "argument_list");
    const args = argList
        ? argList.children
            .filter(c => c.type !== "," && c.type !== "(" && c.type !== ")")
            .map(convertExprNode).filter(Boolean)
        : [];
    return { type: "CallExpression", calleeName: callee + "()", args, loc: getLoc(node) };
}

function convertIf(node) {
    const block = childByType(node, "block");
    return { type: "IfStatement", loc: getLoc(node), body: block ? convertBlock(block) : [] };
}

function convertFor(node) {
    const block = childByType(node, "block");
    return { type: "ForStatement", loc: getLoc(node), body: block ? convertBlock(block) : [] };
}

function convertExprNode(node) {
    if (!node) return null;
    switch (node.type) {
        case "call_expression": return convertCallExpr(node);
        case "selector_expression": return { type: "SelectorExpression", text: node.text, loc: getLoc(node) };
        case "identifier": return { type: "Identifier", name: node.text, loc: getLoc(node) };
        case "interpreted_string_literal": return { type: "StringLiteral", value: node.text, loc: getLoc(node) };
        case "int_literal":
        case "float_literal": return { type: "NumericLiteral", value: node.text, loc: getLoc(node) };
        default: return { type: node.type, text: node.text, loc: getLoc(node) };
    }
}

function buildAST(code) {
    try {
        const tree = parser.parse(code);
        return convertSourceFile(tree.rootNode);
    } catch (e) {
        console.error("Go AST parse error:", e);
        return { type: "Program", loc: null, body: [] };
    }
}

ipcMain.handle("golang-ast", (_, code) => {
    return buildAST(code);
});