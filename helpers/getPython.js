const { exec } = require("child_process");
const { ipcMain } = require("electron");

function getPythonInfo() {
    return new Promise((resolve) => {
        const commands = ["python3", "python", "py"];

        let checked = 0;
        let resolved = false;

        for (const cmd of commands) {
            exec(`${cmd} --version`, (err, stdout, stderr) => {
                if (resolved) return;
                if (!err) {
                    const versionOutput = stdout || stderr;
                    resolved = true;

                    exec(process.platform === "win32" ? `where ${cmd}` : `which ${cmd}`, (err2, stdout2) => {
                        if (!err2) {
                            resolve({
                                version: versionOutput.replace("Python", "").trim(),
                                path: stdout2.split("\n")[0].trim(),
                                command: cmd
                            });
                        } else {
                            resolve({
                                version: versionOutput.replace("Python", "").trim(),
                                path: null,
                                command: cmd
                            });
                        }
                    });

                } else {
                    checked++;
                    if (checked === commands.length) {
                        resolve(false);
                    }
                }
            });
        }
    });
}

ipcMain.handle("get-python-info", async (event) => {
    return await getPythonInfo()
})