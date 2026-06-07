import { ipcMain } from "electron";

type AceData = {
    editorId: string;
    [key: string]: any;
};

type AceChangedCallback = (data: AceData) => void;
type AceClickedCallback = (data: any) => void;

let aceChangedCallback: AceChangedCallback | null = null;
let aceClickedCallback: AceClickedCallback | null = null;

ipcMain.on("ace-changed-event", (_: any, data: AceData) => {
    if (aceChangedCallback) {
        aceChangedCallback(data);
    }
});

ipcMain.on("ace-clicked-event", (_: any, data: any) => {
    if (aceClickedCallback) {
        aceClickedCallback(data);
    }
});

ipcMain.on("file-opened-event", () => {
    aceChangedCallback = null;
    aceClickedCallback = null;
});

export function setAceChangedCallback(cb: AceChangedCallback): void {
    aceChangedCallback = cb;
}

export function setAceClickedCallback(cb: AceClickedCallback): void {
    aceClickedCallback = cb;
}