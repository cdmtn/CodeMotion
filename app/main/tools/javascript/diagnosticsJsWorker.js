const { workerData, parentPort } = require("worker_threads");
const parser = require("@babel/parser");

const JS_PLUGINS = [
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

const TS_PLUGINS = [...JS_PLUGINS, "typescript"];

function getDiagnostics(code, isTS = false) {
    let recoveredErrors = [];
    const plugins = isTS ? TS_PLUGINS : JS_PLUGINS;

    try {
        parser.parse(code, {
            sourceType: "unambiguous",
            allowImportExportEverywhere: true,
            allowReturnOutsideFunction: true,
            allowSuperOutsideMethod: true,
            errorRecovery: true,
            plugins,
        });
        recoveredErrors = ast.errors || []
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
            plugins,
        });
    } catch (e) {
        if (e && e.loc) {
            if (e?.loc) return [formatError(e, code)];
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
        message: e.reasonCode
            ? `${e.message} [${e.reasonCode}]`
            : e.message,
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
        console.error("diagnosticsJsWorker error:", e);
        parentPort.postMessage({ id, diagnostics: [] });
    }
});