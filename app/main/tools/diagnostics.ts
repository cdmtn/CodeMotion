import { ipcMain, IpcMainInvokeEvent } from "electron"
import { Worker } from "worker_threads"
import path from "path"

type DiagnosticResult = unknown

type WorkerMap = {
    js: Worker
    ts: Worker
}

interface PendingEntry {
    id: number
    resolve: (value: DiagnosticResult) => void
}

type PendingMap = {
    js: Map<number, PendingEntry>
    ts: Map<number, PendingEntry>
}

let nextId = 1

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
    js: new Map(),
    ts: new Map(),
}

workers.js.on("message", (msg: { id?: number; diagnostics: DiagnosticResult }) => {
    const entry = pending.js.get(msg.id ?? 0)
    if (entry) {
        entry.resolve(msg.diagnostics)
        pending.js.delete(msg.id ?? 0)
    }
})

workers.ts.on("message", (msg: { id?: number; diagnostics: DiagnosticResult }) => {
    const entry = pending.ts.get(msg.id ?? 0)
    if (entry) {
        entry.resolve(msg.diagnostics)
        pending.ts.delete(msg.id ?? 0)
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
        const id = nextId++
        pending.js.set(id, { id, resolve })
        workers.js.postMessage({ id, code })
    })
})

ipcMain.handle("typescript-diagnostic", (_event: IpcMainInvokeEvent, code: string): Promise<DiagnosticResult> => {
    return new Promise((resolve) => {
        const id = nextId++
        pending.ts.set(id, { id, resolve })
        workers.ts.postMessage({ id, code })
    })
})