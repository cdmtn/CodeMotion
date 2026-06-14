import { ipcMain, IpcMainInvokeEvent } from "electron"
import { Worker } from "worker_threads"
import path from "path"

type DiagnosticResult = unknown

type PendingResolver = ((value: DiagnosticResult) => void) | null

type WorkerMap = {
    js: Worker
    ts: Worker
}

type PendingMap = {
    js: PendingResolver
    ts: PendingResolver
}

function createWorker(filename: string): Worker {
    const worker = new Worker(path.join(__dirname, filename))

    worker.on("error", (err: Error) => {
        console.error(`Worker error (${filename}):`, err)
    })

    worker.on("exit", (code: number) => {
        if (code !== 0) {
            console.error(`Worker (${filename}) exited with code ${code}`)
        }
    })

    return worker
}

const workers: WorkerMap = {
    js: createWorker("javascript/diagnosticsJsWorker.js"),
    ts: createWorker("typescript/diagnosticsTsWorker.js"),
}

const pending: PendingMap = {
    js: null,
    ts: null,
}

workers.js.on("message", (diagnostics: DiagnosticResult) => {
    if (pending.js) {
        pending.js(diagnostics)
        pending.js = null
    }
})

workers.ts.on("message", (diagnostics: DiagnosticResult) => {
    if (pending.ts) {
        pending.ts(diagnostics)
        pending.ts = null
    }
})

workers.js.on("error", (err) => {
    console.error("JS worker error:", err)
})
workers.ts.on("error", (err) => {
    console.error("TS worker error:", err)
})

ipcMain.handle("javascript-diagnostic", (_event: IpcMainInvokeEvent, code: string): Promise<DiagnosticResult> => {
    return new Promise((resolve) => {
        pending.js = resolve
        workers.js.postMessage(code)
    })
})

ipcMain.handle("typescript-diagnostic", (_event: IpcMainInvokeEvent, code: string): Promise<DiagnosticResult> => {
    return new Promise((resolve) => {
        pending.ts = resolve
        workers.ts.postMessage(code)
    })
})