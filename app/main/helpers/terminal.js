const { spawn, spawnSync } = require('child_process');
const { ipcMain } = require('electron');
const fs = require('fs');
const os = require('os');

class TerminalManager {
    constructor() {
        this.activeProcess = null;
        this.inputHandler = null;
    }

    getShell() {
        const isWindows = process.platform === 'win32';
        return isWindows ? 'cmd.exe' : '/bin/bash';
    }

    validateWorkDir(cwd) {
        if (!cwd || !fs.existsSync(cwd)) {
            console.log("[Terminal] Path does not exist, using default: " + process.cwd());
            return process.cwd();
        }

        const stat = fs.statSync(cwd);
        
        if (stat.isFile()) {
            const path = require('path');
            const dirname = path.dirname(cwd);
            console.log(`[Terminal] Path is a file, using directory: ${dirname}`);
            return dirname;
        }

        if (stat.isDirectory()) {
            return cwd;
        }

        console.log("[Terminal] Path is neither file nor directory, using default: " + process.cwd());
        return process.cwd();
    }

    handleOutput(data, type, event) {
        const output = data.toString();
        const prefix = type === 'stderr' ? '[ERR] ' : '';

        console.log(`[Terminal ${type}] ${output}`);

        if (!event.sender.isDestroyed()) {
            event.sender.send("terminal-result", {
                type: type === 'stderr' ? 'error' : 'output',
                data: prefix + output,
                timestamp: Date.now()
            });
        }
    }

    cleanupInputHandler() {
        if (this.inputHandler) {
            ipcMain.removeListener("terminal-input", this.inputHandler);
            this.inputHandler = null;
        }
    }

    terminateProcess() {
        if (this.activeProcess && !this.activeProcess.killed) {
            this.killProcessTree(false);
        }
    }

    killProcessTree(force = true) {
        if (!this.activeProcess || this.activeProcess.killed) return;

        const pid = this.activeProcess.pid;

        try {
            if (process.platform === 'win32') {
                const args = ['/pid', String(pid), '/T'];
                if (force) args.push('/F');

                spawnSync('taskkill.exe', args, {
                    windowsHide: true,
                    stdio: 'ignore'
                });
            } else {
                this.activeProcess.kill(force ? 'SIGKILL' : 'SIGTERM');
            }
        } catch (err) {
            console.error(`[Terminal] Error killing process tree: ${err.message}`);
        }
    }

    executeCommand(event, data) {
        let { cmd, cwd } = data;

        if (typeof cmd !== 'string') {
            event.sender.send("terminal-result", {
                type: 'error',
                data: 'Invalid command: must be a string\r\n'
            });
            return;
        }

        cmd = cmd.trim();
        if (!cmd) {
            event.sender.send("terminal-result", {
                type: 'error',
                data: 'Empty command\r\n'
            });
            return;
        }

        if (cmd.length > 5000) {
            event.sender.send("terminal-result", {
                type: 'error',
                data: 'Command too long (max 5000 chars)\r\n'
            });
            return;
        }

        if (this.activeProcess) {
            event.sender.send("terminal-result", {
                type: 'warning',
                data: 'Another process is already running. Kill it first.\r\n'
            });
            return;
        }

        const workDir = this.validateWorkDir(cwd);
        const shell = this.getShell();

        console.log(`[Terminal] Executing command: "${cmd}" in "${workDir}"`);
        console.log(`[Terminal] Using shell: ${shell}`);

        try {
            const isWindows = process.platform === 'win32';
            const spawnArgs = isWindows ? ['/c', cmd] : ['-c', cmd];
            const spawnShell = isWindows ? 'cmd.exe' : shell;

            this.activeProcess = spawn(spawnShell, spawnArgs, {
                cwd: workDir,
                shell: false,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    TERM: 'xterm-256color'
                }
            });

            if (!this.activeProcess || !this.activeProcess.pid) {
                const errorMsg = 'Failed to spawn process - check shell path and arguments';
                console.error(`[Terminal] ${errorMsg}`);
                throw new Error(errorMsg);
            }

            console.log(`[Terminal] Process spawned with PID: ${this.activeProcess.pid}`);

            this.activeProcess.stdout.on("data", (data) => {
                this.handleOutput(data, 'stdout', event);
            });

            this.activeProcess.stderr.on("data", (data) => {
                this.handleOutput(data, 'stderr', event);
            });

            this.activeProcess.on("close", (code) => {
                console.log(`[Terminal] Process exited with code ${code}`);
                
                event.sender.send("terminal-result", {
                    type: 'exit',
                    data: `\r\nProcess exited with code ${code}\r\n`,
                    exitCode: code
                });

                this.activeProcess = null;
                this.cleanupInputHandler();
            });

            this.activeProcess.on("error", (err) => {
                console.error(`[Terminal] Error: ${err.message}`);
                
                event.sender.send("terminal-result", {
                    type: 'error',
                    data: `Error: ${err.message}\r\n`
                });

                this.activeProcess = null;
                this.cleanupInputHandler();
            });

            this.cleanupInputHandler();

            this.inputHandler = (e, input) => {
                if (this.activeProcess && !this.activeProcess.killed) {
                    try {
                        const str = String(input ?? '');
                        const inputWithNewline = str.endsWith('\n') ? str : str + '\n';
                        this.activeProcess.stdin.write(inputWithNewline);
                        console.log(`[Terminal] Sent input: ${str}`);
                    } catch (err) {
                        console.error("Error writing to stdin:", err.message);
                        event.sender.send("terminal-result", {
                            type: 'error',
                            data: `Error writing to stdin: ${err.message}\r\n`
                        });
                    }
                }
            };

            ipcMain.on("terminal-input", this.inputHandler);

        } catch (err) {
            console.error(`[Terminal] Catch error: ${err.message}`);
            
            event.sender.send("terminal-result", {
                type: 'error',
                data: `Failed to execute command: ${err.message}\r\n`
            });

            this.activeProcess = null;
        }
    }

    killProcess(event) {
        if (!this.activeProcess) {
            console.log("[Terminal] No active process to kill");
            return;
        }

        if (this.activeProcess.killed) {
            console.log("[Terminal] Process is already killed");
            return;
        }

        console.log(`[Terminal] Killing process with PID: ${this.activeProcess.pid}`);

        try {
            this.killProcessTree(false);

            const forceKillTimeout = setTimeout(() => {
                if (this.activeProcess && !this.activeProcess.killed) {
                    console.log(`[Terminal] Force killing process`);
                    this.killProcessTree(true);
                }
            }, 2000);

            this.activeProcess.on('exit', () => {
                clearTimeout(forceKillTimeout);
            });

        } catch (err) {
            console.error(`[Terminal] Error killing process: ${err.message}`);
            event.sender.send("terminal-result", {
                type: 'error',
                data: `Error killing process: ${err.message}\r\n`
            });
        }
    }
}

const terminalManager = new TerminalManager();

ipcMain.on("terminal-command", (event, data) => {
    terminalManager.executeCommand(event, data);
});

ipcMain.on("terminal-kill", (event) => {
    terminalManager.killProcess(event);
});

ipcMain.on("terminal-cleanup", (event) => {
    console.log("[Terminal] Cleanup requested");
    terminalManager.killProcessTree(true);
    terminalManager.cleanupInputHandler();
});

module.exports = { TerminalManager, terminalManager };
