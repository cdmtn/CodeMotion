const { workerData, parentPort } = require("worker_threads");
const ts = require("typescript");

const compilerOptions = {
    noEmit: true,
    allowJs: true,
    checkJs: false,
    strict: false,
    target: ts.ScriptTarget.ES2020,
    lib: ["lib.es2020.d.ts", "lib.dom.d.ts"],
};

let cachedContent = "";
let languageService = null;

function createService() {
    const serviceHost = {
        getScriptFileNames: () => ["file.js"],
        getScriptVersion: () => String(cachedContent.length),
        getScriptSnapshot: (fileName) => {
            if (fileName === "file.js") return ts.ScriptSnapshot.fromString(cachedContent);
            const fs = require("fs");
            if (fs.existsSync(fileName)) return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName, "utf8"));
            return undefined;
        },
        getCurrentDirectory: () => process.cwd(),
        getCompilationSettings: () => compilerOptions,
        getDefaultLibFileName: (opts) => ts.getDefaultLibFilePath(opts),
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile,
        readDirectory: ts.sys.readDirectory,
    };

    languageService = ts.createLanguageService(serviceHost, ts.createDocumentRegistry());
}

parentPort.on("message", (code) => {
    cachedContent = code;

    if (!languageService) createService();

    const diagnostics = languageService.getSyntacticDiagnostics("file.js").map(d => {
        let line, col;
        if (d.file && d.start !== undefined) {
            const { line: l, character } = ts.getLineAndCharacterOfPosition(d.file, d.start);
            line = l + 1;
            col = character + 1;
        }
        return {
            message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
            start: d.start,
            length: d.length,
            line,
            col,
        };
    });

    parentPort.postMessage(diagnostics);
});