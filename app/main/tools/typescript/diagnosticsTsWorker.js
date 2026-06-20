const { parentPort } = require("worker_threads");
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

function getDiagnostics(code) {
    let recoveredErrors = [];

    try {
        const ast = parser.parse(code, {
            sourceType: "unambiguous",
            allowImportExportEverywhere: true,
            allowReturnOutsideFunction: true,
            allowSuperOutsideMethod: true,
            errorRecovery: true,
            plugins: BABEL_PLUGINS,
        });
        recoveredErrors = ast.errors || [];
    } catch (_) {}

    if (recoveredErrors.length > 0) {
        return recoveredErrors.map(e => formatError(e, code));
    }

    try {
        parser.parse(code, {
            sourceType: "unambiguous",
            allowImportExportEverywhere: true,
            allowReturnOutsideFunction: true,
            allowSuperOutsideMethod: true,
            errorRecovery: false,
            plugins: BABEL_PLUGINS,
        });
    } catch (e) {
        if (e?.loc) {
            return [formatError(e, code)];
        }
    }

    return [];
}

function formatError(e, code) {
    const line = e.loc?.line ?? null;
    const col = e.loc?.column ?? null;

    let start = e.pos ?? null;
    if (start === null && line !== null && col !== null) {
        start = lineColToOffset(code, line, col);
    }

    const length = guessLength(code, start);

    return {
        message: e.reasonCode ? `${e.message} [${e.reasonCode}]` : e.message,
        category: "Error",
        start,
        length,
        line,
        col: col !== null ? col + 1 : null,
    };
}

function lineColToOffset(code, line, col) {
    const lines = code.split("\n");
    let offset = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
        offset += lines[i].length + 1;
    }
    return offset + col;
}

function guessLength(code, start) {
    if (start === null || !code) return 1;
    let end = start;
    while (end < code.length && /\w/.test(code[end])) end++;
    return Math.max(1, end - start);
}

parentPort.on("message", (msg) => {
    const code = typeof msg === "object" && msg !== null ? msg.code : msg;
    const id = typeof msg === "object" && msg !== null ? msg.id : undefined;
    try {
        const diagnostics = getDiagnostics(code);
        parentPort.postMessage({ id, diagnostics });
    } catch (e) {
        console.error("diagnosticsTsWorker error:", e);
        parentPort.postMessage({ id, diagnostics: [] });
    }
});