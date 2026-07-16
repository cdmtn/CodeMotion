const { ipcMain } = require("electron");

function loc(startLine, endLine) {
    return {
        start: { line: startLine, column: 0 },
        end:   { line: endLine,   column: 0 },
    };
}

function findClosingBrace(lines, startLine) {
    let depth = 0;
    let found = false;
    for (let i = startLine - 1; i < lines.length; i++) {
        for (const ch of lines[i]) {
            if (ch === "{") { depth++; found = true; }
            if (ch === "}") {
                depth--;
                if (found && depth === 0) return i + 1;
            }
        }
    }
    return lines.length;
}

function parseParams(raw) {
    if (!raw || !raw.trim()) return [];
    const params = [];
    let depth = 0, current = "";
    for (const ch of raw) {
        if (ch === "(" || ch === "[") { depth++; current += ch; continue; }
        if (ch === ")" || ch === "]") { depth--; current += ch; continue; }
        if (ch === "," && depth === 0) { params.push(current.trim()); current = ""; continue; }
        current += ch;
    }
    if (current.trim()) params.push(current.trim());

    return params.map(p => {
        const variadic = p.startsWith("...");
        const clean = variadic ? p.slice(3) : p;
        const parts = clean.trim().split(/\s+/);
        if (parts.length === 1) return { names: [], paramType: (variadic ? "..." : "") + parts[0] };
        const typePart = parts[parts.length - 1];
        const names = parts.slice(0, -1).map(n => n.replace(/,$/, ""));
        return { names, paramType: (variadic ? "..." : "") + typePart };
    });
}

function parseReceiver(raw) {
    if (!raw) return null;
    const clean = raw.trim();
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return { name: "", typeName: parts[0] };
    return { name: parts[0], typeName: parts.slice(1).join(" ") };
}

function parseReturnType(after) {
    if (!after) return null;
    const clean = after.trim().replace(/\{.*$/, "").trim();
    return clean || null;
}

function parseImports(lines, body) {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lineNum = i + 1;

        const single = line.match(/^import\s+"([^"]+)"/);
        if (single) {
            body.push({ type: "ImportDeclaration", paths: [{ path: single[1], alias: null }], loc: loc(lineNum, lineNum) });
            continue;
        }

        if (line.match(/^import\s*\(/)) {
            const paths = [];
            let j = i + 1;
            while (j < lines.length && !lines[j].trim().startsWith(")")) {
                const l = lines[j].trim();
                const m = l.match(/^(?:(\w+|\.|_)\s+)?"([^"]+)"/);
                if (m) paths.push({ path: m[2], alias: m[1] || null });
                j++;
            }
            body.push({ type: "ImportDeclaration", paths, loc: loc(lineNum, j + 1) });
        }
    }
}

function parseStructFields(lines, startLine, endLine) {
    const fields = [];
    for (let i = startLine; i < endLine - 1; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith("//") || line === "{" || line === "}") continue;
        const m = line.match(/^([\w,\s]+?)\s+([\w\[\]*\.]+(?:\[[\w*\.]+\])?)\s*(`[^`]*`)?\s*$/);
        if (m) {
            const names = m[1].split(",").map(s => s.trim()).filter(Boolean);
            fields.push({
                type: "StructField",
                names,
                fieldType: m[2],
                tag: m[3] ? m[3].slice(1, -1) : null,
                loc: loc(i + 1, i + 1),
            });
        }
    }
    return fields;
}

function parseInterfaceMethods(lines, startLine, endLine) {
    const methods = [];
    for (let i = startLine; i < endLine - 1; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith("//") || line === "{" || line === "}") continue;
        const m = line.match(/^(\w+)\s*\(([^)]*)\)(.*)?$/);
        if (m) {
            methods.push({
                type: "InterfaceMethod",
                id: { name: m[1] },
                params: parseParams(m[2]),
                returnType: parseReturnType(m[3]),
                loc: loc(i + 1, i + 1),
            });
            continue;
        }
        const embed = line.match(/^(\w+)$/);
        if (embed) {
            methods.push({ type: "InterfaceEmbed", id: { name: embed[1] }, loc: loc(i + 1, i + 1) });
        }
    }
    return methods;
}

function parseBlock(lines, startLine, endLine) {
    const stmts = [];
    for (let i = startLine; i < endLine - 1; i++) {
        const line = lines[i].trim();
        const lineNum = i + 1;
        if (!line || line.startsWith("//")) continue;

        // short var :=
        const shortVar = line.match(/^([\w,\s]+?)\s*:=\s*(.+)$/);
        if (shortVar) {
            const names = shortVar[1].split(",").map(s => s.trim()).filter(Boolean);
            const callMatch = shortVar[2].trim().match(/^([\w.]+)\s*\(/);
            const values = callMatch
                ? [{ type: "CallExpression", calleeName: callMatch[1] + "()", args: [], loc: loc(lineNum, lineNum) }]
                : [];
            stmts.push({ type: "ShortVarDeclaration", names, values, loc: loc(lineNum, lineNum) });
            continue;
        }

        // if / for
        if (line.match(/^if\s+/)) {
            const end = findClosingBrace(lines, lineNum);
            stmts.push({ type: "IfStatement", loc: loc(lineNum, end), body: [] });
            continue;
        }
        if (line.match(/^for[\s{]/)) {
            const end = findClosingBrace(lines, lineNum);
            stmts.push({ type: "ForStatement", loc: loc(lineNum, end), body: [] });
            continue;
        }

        // go / defer
        const goStmt = line.match(/^go\s+([\w.]+)\s*\(/);
        if (goStmt) {
            stmts.push({ type: "GoStatement", call: { type: "CallExpression", calleeName: goStmt[1] + "()", args: [], loc: loc(lineNum, lineNum) }, loc: loc(lineNum, lineNum) });
            continue;
        }
        const deferStmt = line.match(/^defer\s+([\w.]+)\s*\(/);
        if (deferStmt) {
            stmts.push({ type: "DeferStatement", call: { type: "CallExpression", calleeName: deferStmt[1] + "()", args: [], loc: loc(lineNum, lineNum) }, loc: loc(lineNum, lineNum) });
            continue;
        }

        // call expression
        const callStmt = line.match(/^([\w.]+)\s*\(/);
        if (callStmt) {
            stmts.push({ type: "CallExpression", calleeName: callStmt[1] + "()", args: [], loc: loc(lineNum, lineNum) });
        }
    }
    return stmts;
}

function parse(code) {
    const lines = code.split("\n");
    const body = [];

    const pkgMatch = lines[0]?.match(/^package\s+(\w+)/);
    if (pkgMatch) {
        body.push({ type: "PackageDeclaration", id: { name: pkgMatch[1] }, loc: loc(1, 1) });
    }

    parseImports(lines, body);

    for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i];

        // method: func (recv) Name(params) ret {
        const methodMatch = line.match(/^func\s+\(([^)]+)\)\s+(\w+)\s*\(([^)]*)\)(.*?)\s*\{?\s*$/);
        if (methodMatch) {
            const end = findClosingBrace(lines, lineNum);
            body.push({
                type: "MethodDeclaration",
                id: { name: methodMatch[2] },
                receiver: parseReceiver(methodMatch[1]),
                params: parseParams(methodMatch[3]),
                returnType: parseReturnType(methodMatch[4]),
                loc: loc(lineNum, end),
                body: parseBlock(lines, lineNum, end),
            });
            continue;
        }

        // function: func Name(params) ret {
        const funcMatch = line.match(/^func\s+(\w+)\s*\(([^)]*)\)(.*?)\s*\{?\s*$/);
        if (funcMatch) {
            const end = findClosingBrace(lines, lineNum);
            body.push({
                type: "FunctionDeclaration",
                id: { name: funcMatch[1] },
                params: parseParams(funcMatch[2]),
                returnType: parseReturnType(funcMatch[3]),
                loc: loc(lineNum, end),
                body: parseBlock(lines, lineNum, end),
            });
            continue;
        }

        // struct
        const structMatch = line.match(/^type\s+(\w+)\s+struct\s*\{/);
        if (structMatch) {
            const end = findClosingBrace(lines, lineNum);
            body.push({
                type: "StructDeclaration",
                id: { name: structMatch[1] },
                fields: parseStructFields(lines, lineNum, end),
                loc: loc(lineNum, end),
            });
            continue;
        }

        // interface
        const ifaceMatch = line.match(/^type\s+(\w+)\s+interface\s*\{/);
        if (ifaceMatch) {
            const end = findClosingBrace(lines, lineNum);
            body.push({
                type: "InterfaceDeclaration",
                id: { name: ifaceMatch[1] },
                methods: parseInterfaceMethods(lines, lineNum, end),
                loc: loc(lineNum, end),
            });
            continue;
        }

        // type alias
        const typeAliasMatch = line.match(/^type\s+(\w+)\s+(?!=)([\w\[\]*]+(?:\[[\w*]+\])?)\s*$/);
        if (typeAliasMatch && !line.includes("struct") && !line.includes("interface")) {
            body.push({
                type: "TypeAlias",
                id: { name: typeAliasMatch[1] },
                aliasFor: typeAliasMatch[2] || null,
                loc: loc(lineNum, lineNum),
            });
            continue;
        }

        // var
        const varMatch = line.match(/^var\s+(.+)/);
        if (varMatch) {
            const names = varMatch[1].split(/\s+/)[0].split(",").map(s => s.trim()).filter(Boolean);
            body.push({
                type: "VariableDeclaration",
                kind: "var",
                declarations: [{ type: "VariableDeclarator", names, loc: loc(lineNum, lineNum) }],
                loc: loc(lineNum, lineNum),
            });
            continue;
        }

        // const
        const constMatch = line.match(/^const\s+(.+)/);
        if (constMatch) {
            const names = constMatch[1].split(",").map(s => s.trim().split(/\s+/)[0]).filter(Boolean);
            body.push({
                type: "ConstDeclaration",
                declarations: [{ type: "ConstDeclarator", names, loc: loc(lineNum, lineNum) }],
                loc: loc(lineNum, lineNum),
            });
        }
    }

    return { type: "Program", loc: loc(1, lines.length), body };
}

ipcMain.handle("golang-ast", (_, code) => {
    try {
        return parse(code);
    } catch (e) {
        console.error("Go AST parse error:", e);
        return { type: "Program", loc: null, body: [] };
    }
});