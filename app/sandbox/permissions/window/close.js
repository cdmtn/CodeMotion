const { app, dialog, BrowserWindow } = require("electron");

function callback(data) {
    const mainWindow = BrowserWindow.getAllWindows().find(w => w.title && !w.title.includes("Debugger"));
    const choice = dialog.showMessageBoxSync(mainWindow || undefined, {
        type: "warning",
        buttons: ["Quit", "Cancel"],
        defaultId: 1,
        title: "Quit Application",
        message: `Extension "${data.extensionName}" wants to quit the application.`,
        detail: "Any unsaved work will be lost. Are you sure?"
    });
    if (choice === 0) {
        app.quit();
    }
}

module.exports = { callback }