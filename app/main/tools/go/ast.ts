import { ipcMain } from "electron";

interface Position {
    line: number;
    column: number;
}

interface Loc {
    start: Position;
    end: Position;
}

interface ImportPath {
    path: string;
    alias: string | null;
}

interface Param {
    names: string[];
    paramType: string;
}

interface Receiver {
    name: string;
    typeName: string;
}

interface AstNode {
    type: string;
    loc: Loc;
    [key: string]: any;
}

type TokenKind = "ident" | "keyword" | "string" | "char" | "number" | "op" | "semi";

interface Token {
    kind: TokenKind;
    value: string;
    start: number;
    end: number;
    line: number;
    col: number;
    endLine: number;
    endCol: number;
}

const KEYWORDS = new Set([
    "break", "case", "chan", "const", "continue", "default", "defer", "else",
    "fallthrough", "for", "func", "go", "goto", "if", "import", "interface",
    "map", "package", "range", "return", "select", "struct", "switch", "type", "var",
]);

const OPERATORS = [
    "<<=", ">>=", "&^=", "...", "&&", "||", "<-", "++", "--", "==", "!=", "<=", ">=",
    ":=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<", ">>", "&^",
];

const IDENT_START = /[\p{L}_]/u;
const IDENT_PART = /[\p{L}\p{N}_]/u;
const PLAIN_IDENT = /^[\p{L}_][\p{L}\p{N}_]*$/u;
const TYPE_KEYWORDS = new Set(["func", "map", "chan", "struct", "interface"]);
const TOP_LEVEL_KEYWORDS = new Set(["func", "type", "var", "const", "import"]);

function tokenize(src: string): Token[] {
    const tokens: Token[] = [];
    const n = src.length;
    let i = 0;
    let line = 1;
    let col = 0;

    const advance = (count: number) => {
        for (let k = 0; k < count && i < n; k++) {
            if (src[i] === "\n") {
                line++;
                col = 0;
            } else {
                col++;
            }
            i++;
        }
    };

    const needsSemicolon = () => {
        const last = tokens[tokens.length - 1];
        if (!last || last.kind === "semi") return false;
        if (last.kind === "ident" || last.kind === "string" || last.kind === "char" || last.kind === "number") return true;
        if (last.kind === "keyword") return ["break", "continue", "fallthrough", "return"].includes(last.value);
        return last.kind === "op" && [")", "]", "}", "++", "--"].includes(last.value);
    };

    const pushSemicolon = () => {
        tokens.push({ kind: "semi", value: "\n", start: i, end: i, line, col, endLine: line, endCol: col });
    };

    while (i < n) {
        const ch = src[i];

        if (ch === "\n") {
            if (needsSemicolon()) pushSemicolon();
            advance(1);
            continue;
        }

        if (ch === " " || ch === "\t" || ch === "\r" || ch === "﻿") {
            advance(1);
            continue;
        }

        if (ch === "/" && src[i + 1] === "/") {
            while (i < n && src[i] !== "\n") advance(1);
            continue;
        }

        if (ch === "/" && src[i + 1] === "*") {
            let hadNewline = false;
            advance(2);
            while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
                if (src[i] === "\n") hadNewline = true;
                advance(1);
            }
            advance(2);
            if (hadNewline && needsSemicolon()) pushSemicolon();
            continue;
        }

        const start = i;
        const sLine = line;
        const sCol = col;
        const push = (kind: TokenKind) => {
            tokens.push({ kind, value: src.slice(start, i), start, end: i, line: sLine, col: sCol, endLine: line, endCol: col });
        };

        if (ch === '"' || ch === "'") {
            advance(1);
            while (i < n && src[i] !== ch && src[i] !== "\n") {
                advance(src[i] === "\\" && i + 1 < n && src[i + 1] !== "\n" ? 2 : 1);
            }
            if (src[i] === ch) advance(1);
            push(ch === '"' ? "string" : "char");
            continue;
        }

        if (ch === "`") {
            advance(1);
            while (i < n && src[i] !== "`") advance(1);
            advance(1);
            push("string");
            continue;
        }

        if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[i + 1] || ""))) {
            while (i < n) {
                const c = src[i];
                const prev = src[i - 1];
                if (/[0-9A-Za-z_.]/.test(c) || ((c === "+" || c === "-") && /[eEpP]/.test(prev))) {
                    advance(1);
                } else {
                    break;
                }
            }
            push("number");
            continue;
        }

        if (IDENT_START.test(ch)) {
            while (i < n && IDENT_PART.test(src[i])) advance(1);
            push(KEYWORDS.has(src.slice(start, i)) ? "keyword" : "ident");
            continue;
        }

        if (ch === ";") {
            advance(1);
            push("semi");
            continue;
        }

        const op = OPERATORS.find(o => src.startsWith(o, i));
        advance(op ? op.length : 1);
        push("op");
    }

    if (needsSemicolon()) pushSemicolon();
    return tokens;
}

function matchBrackets(tokens: Token[]): number[] {
    const match = new Array<number>(tokens.length).fill(-1);
    const stack: number[] = [];
    const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

    tokens.forEach((t, idx) => {
        if (t.kind === "keyword" && t.col === 0 && TOP_LEVEL_KEYWORDS.has(t.value) && stack.length) {
            for (const open of stack) match[open] = idx - 1;
            stack.length = 0;
            return;
        }

        if (t.kind !== "op") return;
        if (t.value === "(" || t.value === "[" || t.value === "{") {
            stack.push(idx);
        } else if (t.value in pairs) {
            for (let s = stack.length - 1; s >= 0; s--) {
                if (tokens[stack[s]].value === pairs[t.value]) {
                    const open = stack[s];
                    stack.length = s;
                    match[open] = idx;
                    match[idx] = open;
                    break;
                }
            }
        }
    });

    return match;
}

function splitTopLevel(raw: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = "";
    for (const ch of raw) {
        if (ch === "(" || ch === "[" || ch === "{") depth++;
        if (ch === ")" || ch === "]" || ch === "}") depth--;
        if (ch === "," && depth === 0) {
            parts.push(current.trim());
            current = "";
            continue;
        }
        current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    return parts.filter(Boolean);
}

function splitNameAndType(entry: string): { name: string | null; type: string } {
    const match = entry.match(/^(\S+)\s+(.+)$/s);
    if (match && PLAIN_IDENT.test(match[1]) && !TYPE_KEYWORDS.has(match[1])) {
        return { name: match[1], type: match[2].trim() };
    }
    return { name: null, type: entry };
}

function parseParams(raw: string): Param[] {
    const entries = splitTopLevel(raw || "").map(splitNameAndType);
    if (!entries.some(e => e.name)) {
        return entries.map(e => ({ names: [], paramType: e.type }));
    }

    const params: Param[] = [];
    let pending: string[] = [];
    for (const entry of entries) {
        if (entry.name) {
            params.push({ names: [...pending, entry.name], paramType: entry.type });
            pending = [];
        } else {
            pending.push(entry.type);
        }
    }
    if (pending.length) params.push({ names: pending, paramType: "" });
    return params;
}

function parseReceiver(raw: string): Receiver | null {
    if (!raw || !raw.trim()) return null;
    const { name, type } = splitNameAndType(raw.trim());
    return { name: name || "", typeName: type };
}

function truncate(text: string, max = 48): string {
    return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

class GoAstParser {
    private tokens: Token[];
    private match: number[];
    private src: string;

    constructor(src: string) {
        this.src = src;
        this.tokens = tokenize(src);
        this.match = matchBrackets(this.tokens);
    }

    private tok(idx: number): Token | undefined {
        return this.tokens[idx];
    }

    private isOp(idx: number, value: string): boolean {
        const t = this.tokens[idx];
        return !!t && t.kind === "op" && t.value === value;
    }

    private isKw(idx: number, value: string): boolean {
        const t = this.tokens[idx];
        return !!t && t.kind === "keyword" && t.value === value;
    }

    private isSemi(idx: number): boolean {
        return this.tokens[idx]?.kind === "semi";
    }

    private closeOf(idx: number, limit: number): number {
        const m = this.match[idx];
        return m > idx ? m : limit - 1;
    }

    private text(a: number, b: number): string {
        if (a > b || !this.tokens[a] || !this.tokens[b]) return "";
        return this.src.slice(this.tokens[a].start, this.tokens[b].end).replace(/\s+/g, " ").trim();
    }

    private loc(a: number, b: number): Loc {
        const s = this.tokens[a] || this.tokens[this.tokens.length - 1];
        const e = this.tokens[b] || s;
        return {
            start: { line: s.line, column: s.col },
            end: { line: e.endLine, column: e.endCol },
        };
    }

    private isOpen(idx: number): boolean {
        const t = this.tokens[idx];
        return !!t && t.kind === "op" && (t.value === "(" || t.value === "[" || t.value === "{");
    }

    private isCompositeLiteral(braceIdx: number): boolean {
        let j = braceIdx - 1;
        const prev = this.tokens[j];
        if (!prev) return false;

        if (prev.kind === "op" && prev.value === "}") {
            const open = this.match[j];
            return open > 0 && (this.isKw(open - 1, "struct") || this.isKw(open - 1, "interface"));
        }

        if (prev.kind !== "ident") return false;

        j--;
        while (this.isOp(j, ".") && this.tokens[j - 1]?.kind === "ident") j -= 2;
        while (this.isOp(j, "*")) j--;

        return this.isOp(j, "]");
    }

    private findBodyBrace(from: number, limit: number): number {
        let k = from;
        while (k < limit) {
            if (this.isOp(k, "(") || this.isOp(k, "[")) {
                k = this.closeOf(k, limit) + 1;
                continue;
            }
            if (this.isOp(k, "{")) {
                if (this.isCompositeLiteral(k)) {
                    k = this.closeOf(k, limit) + 1;
                    continue;
                }
                return k;
            }
            k++;
        }
        return -1;
    }

    private endOfStatement(s: number, limit: number): number {
        const head = this.tokens[s];
        if (head?.kind === "keyword" && ["if", "for", "switch", "select"].includes(head.value)) {
            let bi = this.findBodyBrace(s + 1, limit);
            if (bi < 0) return limit;
            let k = this.closeOf(bi, limit) + 1;

            if (head.value === "if") {
                while (this.isKw(k, "else")) {
                    if (this.isKw(k + 1, "if")) {
                        bi = this.findBodyBrace(k + 2, limit);
                        if (bi < 0) return limit;
                        k = this.closeOf(bi, limit) + 1;
                    } else if (this.isOp(k + 1, "{")) {
                        k = this.closeOf(k + 1, limit) + 1;
                        break;
                    } else {
                        break;
                    }
                }
            }

            while (k < limit && !this.isSemi(k)) k++;
            return Math.min(k, limit);
        }

        let k = s;
        while (k < limit) {
            if (this.isSemi(k)) return k;
            if (this.isOpen(k)) {
                k = this.closeOf(k, limit) + 1;
                continue;
            }
            k++;
        }
        return limit;
    }

    private readType(from: number, limit: number): { text: string; next: number } {
        let k = from;
        while (k < limit) {
            const t = this.tokens[k];
            if (t.kind === "semi") break;
            if (t.kind === "op" && t.value === "{") {
                if (this.isKw(k - 1, "struct") || this.isKw(k - 1, "interface")) {
                    k = this.closeOf(k, limit) + 1;
                    continue;
                }
                break;
            }
            if (t.kind === "op" && (t.value === "(" || t.value === "[")) {
                k = this.closeOf(k, limit) + 1;
                continue;
            }
            if (t.kind === "op" && (t.value === ")" || t.value === "]" || t.value === "}" || t.value === "=" || t.value === ",")) break;
            k++;
        }
        return { text: k > from ? this.text(from, k - 1) : "", next: k };
    }

    private collectFuncLiterals(a: number, b: number): AstNode[] {
        const literals: AstNode[] = [];
        let k = a;
        while (k < b) {
            if (this.isKw(k, "func") && this.isOp(k + 1, "(")) {
                const pc = this.closeOf(k + 1, b);
                const result = this.readType(pc + 1, b);
                if (this.isOp(result.next, "{")) {
                    const bc = this.closeOf(result.next, b);
                    literals.push({
                        type: "FuncLiteral",
                        params: parseParams(this.text(k + 2, pc - 1)),
                        returnType: result.text || null,
                        body: this.parseStatements(result.next + 1, bc),
                        loc: this.loc(k, bc),
                    });
                    k = bc + 1;
                    continue;
                }
                k = pc + 1;
                continue;
            }
            k++;
        }
        return literals;
    }

    private callee(a: number, b: number): string | null {
        let k = a;
        if (this.tokens[k]?.kind !== "ident") return null;
        k++;
        while (this.isOp(k, ".") && this.tokens[k + 1]?.kind === "ident") k += 2;
        if (this.isOp(k, "[")) k = this.closeOf(k, b) + 1;
        return this.isOp(k, "(") && k < b ? this.text(a, k - 1) + "()" : null;
    }

    parseFile(): AstNode {
        const body: AstNode[] = [];
        const limit = this.tokens.length;
        let p = 0;

        while (p < limit) {
            const t = this.tokens[p];

            if (t.kind === "semi") {
                p++;
                continue;
            }

            if (this.isKw(p, "package") && this.tokens[p + 1]?.kind === "ident") {
                body.push({ type: "PackageDeclaration", id: { name: this.tokens[p + 1].value }, loc: this.loc(p, p + 1) });
                p = this.endOfStatement(p, limit) + 1;
                continue;
            }

            if (this.isKw(p, "import")) {
                p = this.parseImport(p, limit, body);
                continue;
            }

            if (this.isKw(p, "func")) {
                p = this.parseFuncDecl(p, limit, body);
                continue;
            }

            if (this.isKw(p, "type")) {
                p = this.parseTypeDecl(p, limit, body);
                continue;
            }

            if (this.isKw(p, "var") || this.isKw(p, "const")) {
                p = this.parseVarConst(p, limit, body);
                continue;
            }

            p = this.endOfStatement(p, limit) + 1;
        }

        const last = this.tokens[this.tokens.length - 1];
        return {
            type: "Program",
            loc: { start: { line: 1, column: 0 }, end: { line: last ? last.endLine : 1, column: last ? last.endCol : 0 } },
            body,
        };
    }

    private parseImportSpec(a: number, b: number): ImportPath | null {
        let alias: string | null = null;
        let k = a;
        if (this.tokens[k]?.kind === "ident" || this.isOp(k, ".")) {
            alias = this.tokens[k].value;
            k++;
        }
        const pathTok = this.tokens[k];
        if (k >= b || !pathTok || pathTok.kind !== "string") return null;
        return { path: pathTok.value.slice(1, -1), alias };
    }

    private parseImport(p: number, limit: number, out: AstNode[]): number {
        if (this.isOp(p + 1, "(")) {
            const close = this.closeOf(p + 1, limit);
            const paths: ImportPath[] = [];
            let s = p + 2;
            while (s < close) {
                if (this.isSemi(s)) {
                    s++;
                    continue;
                }
                const e = this.endOfStatement(s, close);
                const spec = this.parseImportSpec(s, e);
                if (spec) paths.push(spec);
                s = e + 1;
            }
            out.push({ type: "ImportDeclaration", paths, loc: this.loc(p, close) });
            return this.endOfStatement(close, limit) + 1;
        }

        const e = this.endOfStatement(p, limit);
        const spec = this.parseImportSpec(p + 1, e);
        out.push({ type: "ImportDeclaration", paths: spec ? [spec] : [], loc: this.loc(p, e - 1) });
        return e + 1;
    }

    private parseFuncDecl(p: number, limit: number, out: AstNode[]): number {
        const start = p;
        let k = p + 1;
        let receiver: Receiver | null = null;

        if (this.isOp(k, "(")) {
            const rc = this.closeOf(k, limit);
            receiver = parseReceiver(this.text(k + 1, rc - 1));
            k = rc + 1;
        }

        if (this.tokens[k]?.kind !== "ident") {
            return this.endOfStatement(start, limit) + 1;
        }

        const name = this.tokens[k].value;
        k++;

        let typeParams: string | null = null;
        if (this.isOp(k, "[")) {
            const tc = this.closeOf(k, limit);
            typeParams = this.text(k + 1, tc - 1) || null;
            k = tc + 1;
        }

        let paramsText = "";
        if (this.isOp(k, "(")) {
            const pc = this.closeOf(k, limit);
            paramsText = this.text(k + 1, pc - 1);
            k = pc + 1;
        }

        const result = this.readType(k, limit);
        k = result.next;

        let end = k - 1;
        let body: AstNode[] = [];
        if (this.isOp(k, "{")) {
            const bc = this.closeOf(k, limit);
            body = this.parseStatements(k + 1, bc);
            end = bc;
            k = bc + 1;
        }

        out.push({
            type: receiver ? "MethodDeclaration" : "FunctionDeclaration",
            id: { name },
            receiver,
            typeParams,
            params: parseParams(paramsText),
            returnType: result.text || null,
            body,
            loc: this.loc(start, end),
        });

        if (this.isSemi(k)) return k + 1;
        return k > start ? k : this.endOfStatement(start, limit) + 1;
    }

    private isTypeParams(bracket: number, limit: number): boolean {
        const close = this.closeOf(bracket, limit);
        if (close <= bracket + 1) return false;
        return this.tokens[bracket + 1]?.kind === "ident" && close > bracket + 2;
    }

    private parseTypeSpec(s: number, e: number): AstNode | null {
        if (this.tokens[s]?.kind !== "ident") return null;
        const name = this.tokens[s].value;
        let k = s + 1;

        if (this.isOp(k, "[") && this.isTypeParams(k, e)) k = this.closeOf(k, e) + 1;
        if (this.isOp(k, "=")) k++;

        if (this.isKw(k, "struct") && this.isOp(k + 1, "{")) {
            const close = this.closeOf(k + 1, e + 1);
            return { type: "StructDeclaration", id: { name }, fields: this.parseStructFields(k + 2, close), loc: this.loc(s, close) };
        }

        if (this.isKw(k, "interface") && this.isOp(k + 1, "{")) {
            const close = this.closeOf(k + 1, e + 1);
            return { type: "InterfaceDeclaration", id: { name }, methods: this.parseInterfaceElems(k + 2, close), loc: this.loc(s, close) };
        }

        return { type: "TypeAlias", id: { name }, aliasFor: this.text(k, e - 1) || null, loc: this.loc(s, e - 1) };
    }

    private parseTypeDecl(p: number, limit: number, out: AstNode[]): number {
        if (this.isOp(p + 1, "(")) {
            const close = this.closeOf(p + 1, limit);
            let s = p + 2;
            while (s < close) {
                if (this.isSemi(s)) {
                    s++;
                    continue;
                }
                const e = this.endOfStatement(s, close);
                const node = this.parseTypeSpec(s, e);
                if (node) out.push(node);
                s = e + 1;
            }
            return this.endOfStatement(close, limit) + 1;
        }

        const e = this.endOfStatement(p, limit);
        const node = this.parseTypeSpec(p + 1, e);
        if (node) {
            node.loc.start = this.loc(p, p).start;
            out.push(node);
        }
        return e + 1;
    }

    private parseStructFields(a: number, b: number): AstNode[] {
        const fields: AstNode[] = [];
        let s = a;
        while (s < b) {
            if (this.isSemi(s)) {
                s++;
                continue;
            }
            const e = this.endOfStatement(s, b);
            let last = e - 1;
            let tag: string | null = null;
            if (last > s && this.tokens[last]?.kind === "string") {
                tag = this.tokens[last].value.slice(1, -1);
                last--;
            }

            let names: string[] = [];
            let fieldType = "";
            let embedded = false;

            if (this.tokens[s]?.kind === "ident" && this.isOp(s + 1, ",")) {
                let k = s;
                while (this.tokens[k]?.kind === "ident") {
                    names.push(this.tokens[k].value);
                    if (!this.isOp(k + 1, ",")) {
                        k++;
                        break;
                    }
                    k += 2;
                }
                fieldType = this.text(k, last);
            } else if (this.tokens[s]?.kind === "ident" && last > s && !this.isOp(s + 1, ".")) {
                names = [this.tokens[s].value];
                fieldType = this.text(s + 1, last);
            } else {
                embedded = true;
                fieldType = this.text(s, last);
            }

            fields.push({ type: "StructField", names, fieldType: truncate(fieldType), tag, embedded, loc: this.loc(s, e - 1) });
            s = e + 1;
        }
        return fields;
    }

    private parseInterfaceElems(a: number, b: number): AstNode[] {
        const elems: AstNode[] = [];
        let s = a;
        while (s < b) {
            if (this.isSemi(s)) {
                s++;
                continue;
            }
            const e = this.endOfStatement(s, b);

            if (this.tokens[s]?.kind === "ident" && this.isOp(s + 1, "(")) {
                const pc = this.closeOf(s + 1, e);
                const result = this.readType(pc + 1, e);
                elems.push({
                    type: "InterfaceMethod",
                    id: { name: this.tokens[s].value },
                    params: parseParams(this.text(s + 2, pc - 1)),
                    returnType: result.text || null,
                    loc: this.loc(s, e - 1),
                });
            } else {
                elems.push({ type: "InterfaceEmbed", id: { name: truncate(this.text(s, e - 1)) }, loc: this.loc(s, e - 1) });
            }
            s = e + 1;
        }
        return elems;
    }

    private specNames(s: number, e: number): string[] {
        const names: string[] = [];
        let k = s;
        while (k < e && this.tokens[k]?.kind === "ident") {
            names.push(this.tokens[k].value);
            if (!this.isOp(k + 1, ",")) break;
            k += 2;
        }
        return names;
    }

    private parseVarConst(p: number, limit: number, out: AstNode[]): number {
        const kind = this.tokens[p].value;
        const declaratorType = kind === "const" ? "ConstDeclarator" : "VariableDeclarator";
        const declarations: AstNode[] = [];
        const children: AstNode[] = [];
        let end: number;

        if (this.isOp(p + 1, "(")) {
            const close = this.closeOf(p + 1, limit);
            let s = p + 2;
            while (s < close) {
                if (this.isSemi(s)) {
                    s++;
                    continue;
                }
                const e = this.endOfStatement(s, close);
                declarations.push({ type: declaratorType, names: this.specNames(s, e), loc: this.loc(s, e - 1) });
                children.push(...this.collectFuncLiterals(s, e));
                s = e + 1;
            }
            end = close;
        } else {
            const e = this.endOfStatement(p, limit);
            declarations.push({ type: declaratorType, names: this.specNames(p + 1, e), loc: this.loc(p + 1, e - 1) });
            children.push(...this.collectFuncLiterals(p + 1, e));
            end = e - 1;
        }

        out.push({
            type: kind === "const" ? "ConstDeclaration" : "VariableDeclaration",
            kind,
            declarations,
            children,
            loc: this.loc(p, end),
        });

        return this.endOfStatement(end + 1, limit) + 1;
    }

    private parseStatements(a: number, b: number): AstNode[] {
        const out: AstNode[] = [];
        let s = a;
        while (s < b) {
            if (this.isSemi(s)) {
                s++;
                continue;
            }
            const e = this.endOfStatement(s, b);
            this.parseStatement(s, e, out);
            s = e + 1;
        }
        return out;
    }

    private parseStatement(s: number, e: number, out: AstNode[]): void {
        while (this.tokens[s]?.kind === "ident" && this.isOp(s + 1, ":") && s + 2 < e) s += 2;
        if (s >= e) return;

        const head = this.tokens[s];

        if (head.kind === "keyword") {
            switch (head.value) {
                case "if":
                    out.push(this.parseIf(s, e, false));
                    return;
                case "for":
                    out.push(this.parseFor(s, e));
                    return;
                case "switch":
                case "select":
                    out.push(this.parseSwitch(s, e));
                    return;
                case "go":
                case "defer": {
                    const isLiteral = this.isKw(s + 1, "func");
                    const callee = isLiteral ? "" : (this.callee(s + 1, e) || truncate(this.text(s + 1, e - 1), 36));
                    out.push({
                        type: head.value === "go" ? "GoStatement" : "DeferStatement",
                        call: { type: "CallExpression", calleeName: callee, args: [], loc: this.loc(s + 1, e - 1) },
                        children: this.collectFuncLiterals(s + 1, e),
                        loc: this.loc(s, e - 1),
                    });
                    return;
                }
                case "var":
                case "const":
                    this.parseVarConst(s, e, out);
                    return;
                case "type":
                    this.parseTypeDecl(s, e, out);
                    return;
            }
        }

        if (this.isOp(s, "{")) {
            const close = this.closeOf(s, e);
            out.push({ type: "BlockStatement", body: this.parseStatements(s + 1, close), loc: this.loc(s, close) });
            return;
        }

        let define = -1;
        for (let k = s; k < e; k++) {
            if (this.isOpen(k)) {
                k = this.closeOf(k, e);
                continue;
            }
            if (this.isOp(k, ":=")) {
                define = k;
                break;
            }
        }

        const children = this.collectFuncLiterals(s, e);

        if (define > s) {
            const names = this.text(s, define - 1).split(",").map(x => x.trim()).filter(Boolean);
            const callee = this.callee(define + 1, e);
            out.push({
                type: "ShortVarDeclaration",
                names,
                values: callee ? [{ type: "CallExpression", calleeName: callee, args: [], loc: this.loc(define + 1, e - 1) }] : [],
                children,
                loc: this.loc(s, e - 1),
            });
            return;
        }

        const callee = this.callee(s, e);
        if (callee) {
            out.push({ type: "CallExpression", calleeName: callee, args: [], children, loc: this.loc(s, e - 1) });
            return;
        }

        if (children.length) {
            out.push({ type: "Statement", children, loc: this.loc(s, e - 1) });
        }
    }

    private parseIf(s: number, e: number, elseIf: boolean): AstNode {
        const bi = this.findBodyBrace(s + 1, e);
        if (bi < 0) {
            return { type: "IfStatement", elseIf, condition: truncate(this.text(s + 1, e - 1)), body: [], loc: this.loc(s, e - 1) };
        }

        const bc = this.closeOf(bi, e);
        const node: AstNode = {
            type: "IfStatement",
            elseIf,
            condition: truncate(this.text(s + 1, bi - 1)),
            body: this.parseStatements(bi + 1, bc),
            loc: this.loc(s, bc),
        };

        if (this.isKw(bc + 1, "else")) {
            if (this.isKw(bc + 2, "if")) {
                node.alternate = this.parseIf(bc + 2, e, true);
                node.loc.end = node.alternate.loc.end;
            } else if (this.isOp(bc + 2, "{")) {
                const ec = this.closeOf(bc + 2, e);
                node.alternate = { type: "ElseClause", body: this.parseStatements(bc + 3, ec), loc: this.loc(bc + 1, ec) };
                node.loc.end = node.alternate.loc.end;
            }
        }

        return node;
    }

    private parseFor(s: number, e: number): AstNode {
        const bi = this.findBodyBrace(s + 1, e);
        if (bi < 0) {
            return { type: "ForStatement", header: truncate(this.text(s + 1, e - 1)), body: [], loc: this.loc(s, e - 1) };
        }
        const bc = this.closeOf(bi, e);
        return {
            type: "ForStatement",
            header: truncate(this.text(s + 1, bi - 1)),
            body: this.parseStatements(bi + 1, bc),
            loc: this.loc(s, bc),
        };
    }

    private parseSwitch(s: number, e: number): AstNode {
        const keyword = this.tokens[s].value;
        const bi = this.findBodyBrace(s + 1, e);
        if (bi < 0) {
            return { type: "SwitchStatement", keyword, header: truncate(this.text(s + 1, e - 1)), cases: [], loc: this.loc(s, e - 1) };
        }

        const bc = this.closeOf(bi, e);
        const clauseStarts: number[] = [];
        for (let k = bi + 1; k < bc; k++) {
            if (this.isOpen(k)) {
                k = this.closeOf(k, bc);
                continue;
            }
            if (this.isKw(k, "case") || this.isKw(k, "default")) clauseStarts.push(k);
        }

        const cases = clauseStarts.map((cs, idx) => {
            const clauseEnd = idx + 1 < clauseStarts.length ? clauseStarts[idx + 1] : bc;
            let colon = cs + 1;
            while (colon < clauseEnd) {
                if (this.isOpen(colon)) {
                    colon = this.closeOf(colon, clauseEnd) + 1;
                    continue;
                }
                if (this.isOp(colon, ":")) break;
                colon++;
            }

            const isDefault = this.isKw(cs, "default");
            let lastTok = clauseEnd - 1;
            while (lastTok > colon && this.isSemi(lastTok)) lastTok--;

            return {
                type: "CaseClause",
                label: isDefault ? "default" : "case " + truncate(this.text(cs + 1, colon - 1), 36),
                body: this.parseStatements(colon + 1, clauseEnd),
                loc: this.loc(cs, Math.max(colon, lastTok)),
            };
        });

        return {
            type: "SwitchStatement",
            keyword,
            header: truncate(this.text(s + 1, bi - 1)),
            cases,
            loc: this.loc(s, bc),
        };
    }
}

export function parseGo(code: string): AstNode {
    return new GoAstParser(code).parseFile();
}

ipcMain.handle("golang-ast", (_: unknown, code: string): AstNode | { type: string; loc: Loc | null; body: AstNode[] } => {
    try {
        return parseGo(code);
    } catch (e) {
        console.error("Go AST parse error:", e);
        return { type: "Program", loc: null, body: [] };
    }
});
