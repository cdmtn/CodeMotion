const esbuild = require("esbuild");

esbuild.build({
    entryPoints: ["src/index.js"],
    bundle: true,
    format: "iife",
    globalName: "CodeMirrorBundle",
    outfile: "dist/codemirror.js",
    minify: false
}).catch(() => process.exit(1));