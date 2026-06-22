import { ipcMain, IpcMainInvokeEvent } from "electron";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

interface ToolResult {
    success: boolean;
    output: string;
    error?: string;
}

// Tool: read_file
async function toolReadFile(filePath: string): Promise<ToolResult> {
    try {
        const content = fs.readFileSync(filePath, "utf-8");
        return { success: true, output: content };
    } catch (e: any) {
        return { success: false, output: "", error: e.message };
    }
}

// Tool: write_file
async function toolWriteFile(filePath: string, content: string): Promise<ToolResult> {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content, "utf-8");
        return { success: true, output: `File written: ${filePath}` };
    } catch (e: any) {
        return { success: false, output: "", error: e.message };
    }
}

// Tool: edit_file (search and replace)
async function toolEditFile(filePath: string, oldString: string, newString: string): Promise<ToolResult> {
    try {
        const content = fs.readFileSync(filePath, "utf-8");
        if (!content.includes(oldString)) {
            return { success: false, output: "", error: "Search string not found in file" };
        }
        const updated = content.replace(oldString, newString);
        fs.writeFileSync(filePath, updated, "utf-8");
        return { success: true, output: `File edited: ${filePath}` };
    } catch (e: any) {
        return { success: false, output: "", error: e.message };
    }
}

// Tool: list_dir
async function toolListDir(dirPath: string): Promise<ToolResult> {
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const lines = entries.map(e => {
            const type = e.isDirectory() ? "dir" : "file";
            return `${type}: ${e.name}`;
        });
        return { success: true, output: lines.join("\n") };
    } catch (e: any) {
        return { success: false, output: "", error: e.message };
    }
}

// Tool: run_terminal
async function toolRunTerminal(cmd: string, cwd?: string): Promise<ToolResult> {
    try {
        const { stdout, stderr } = await execAsync(cmd, { cwd, timeout: 30000 });
        return { success: true, output: stdout || stderr };
    } catch (e: any) {
        return { success: false, output: e.stdout || "", error: e.stderr || e.message };
    }
}

// Tool: search_code
async function toolSearchCode(rootPath: string, query: string): Promise<ToolResult> {
    try {
        // Simple grep-like search
        const { stdout } = await execAsync(
            `powershell -Command "Get-ChildItem -Path '${rootPath}' -Recurse -File | Select-String -Pattern '${query}' | Select-Object -First 20"`,
            { timeout: 15000 }
        );
        return { success: true, output: stdout || "No matches found" };
    } catch (e: any) {
        return { success: false, output: "", error: e.message };
    }
}

// Tool dispatcher
ipcMain.handle("ai-agent-tool", async (_event: IpcMainInvokeEvent, toolName: string, args: any) => {
    switch (toolName) {
        case "read_file":
            return toolReadFile(args.path);
        case "write_file":
            return toolWriteFile(args.path, args.content);
        case "edit_file":
            return toolEditFile(args.path, args.oldString, args.newString);
        case "list_dir":
            return toolListDir(args.path);
        case "run_terminal":
            return toolRunTerminal(args.command, args.cwd);
        case "search_code":
            return toolSearchCode(args.path, args.query);
        default:
            return { success: false, output: "", error: `Unknown tool: ${toolName}` };
    }
});

// Streaming AI Chat with tool support
interface AiMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    name?: string;
    tool_calls?: any[];
}

const TOOLS_SCHEMA = [
    {
        type: "function",
        function: {
            name: "read_file",
            description: "Read the contents of a file",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "Absolute file path" }
                },
                required: ["path"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "write_file",
            description: "Create or overwrite a file with given content",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "Absolute file path" },
                    content: { type: "string", description: "File content" }
                },
                required: ["path", "content"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "edit_file",
            description: "Edit a file by replacing oldString with newString",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "Absolute file path" },
                    oldString: { type: "string", description: "Text to search for" },
                    newString: { type: "string", description: "Replacement text" }
                },
                required: ["path", "oldString", "newString"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "list_dir",
            description: "List files and directories in a path",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "Absolute directory path" }
                },
                required: ["path"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "run_terminal",
            description: "Run a terminal command",
            parameters: {
                type: "object",
                properties: {
                    command: { type: "string", description: "Command to run" },
                    cwd: { type: "string", description: "Working directory" }
                },
                required: ["command"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "search_code",
            description: "Search for text pattern across files",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "Root directory to search" },
                    query: { type: "string", description: "Search pattern" }
                },
                required: ["path", "query"]
            }
        }
    }
];

const SYSTEM_PROMPT = `You are an AI coding agent. You help users write, edit, and understand code.

You have access to tools to interact with the filesystem. Think step by step:
1. Understand the user's request
2. Use tools to gather information (read files, list directories)
3. Plan your changes
4. Execute changes using tools
5. Report what you did

Always confirm destructive actions with the user before executing them.
When editing files, make precise changes using edit_file (search/replace).
When creating files, write the complete content.
`;

ipcMain.handle("ai-agent-chat", async (_event, payload: {
    provider: string;
    apiKey: string;
    model: string;
    messages: AiMessage[];
    temperature?: number;
    maxTokens?: number;
    enableTools?: boolean;
}) => {
    try {
        const body: any = {
            model: payload.model,
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...payload.messages],
            temperature: payload.temperature ?? 0.7,
            max_tokens: payload.maxTokens ?? 8192,
        };

        if (payload.enableTools !== false) {
            body.tools = TOOLS_SCHEMA;
            body.tool_choice = "auto";
        }

        let url = "";
        let headers: any = {
            "Content-Type": "application/json",
        };

        if (payload.provider === "openrouter") {
            url = "https://openrouter.ai/api/v1/chat/completions";
            headers["Authorization"] = `Bearer ${payload.apiKey}`;
            headers["HTTP-Referer"] = "https://codemotion.app";
            headers["X-Title"] = "CodeMotion IDE";
            body.include_reasoning = true;
            body.transforms = ["middle-out"];
        } else if (payload.provider === "openai") {
            url = "https://api.openai.com/v1/chat/completions";
            headers["Authorization"] = `Bearer ${payload.apiKey}`;
        } else if (payload.provider === "anthropic") {
            // Anthropic doesn't support tools the same way, fallback
            url = "https://api.anthropic.com/v1/messages";
            headers["x-api-key"] = payload.apiKey;
            headers["anthropic-version"] = "2023-06-01";
            const systemMsg = body.messages.find((m: any) => m.role === "system")?.content || "";
            const otherMessages = body.messages.filter((m: any) => m.role !== "system").map((m: any) => ({
                role: m.role,
                content: m.content
            }));
            return {
                success: true,
                content: "Anthropic provider does not support agent tools in this version. Please use OpenRouter or OpenAI.",
                tool_calls: []
            };
        } else {
            throw new Error("Unknown provider");
        }

        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`${response.status}: ${err}`);
        }

        const result: any = await response.json();
        const choice = result.choices?.[0];
        const message = choice?.message;

        let content = message?.content || "";
        const tool_calls = message?.tool_calls || [];
        const reasoning = message?.reasoning || "";

        // Prepend reasoning if present
        if (reasoning && !content.startsWith(reasoning)) {
            content = reasoning + (content ? "\n\n" + content : "");
        }

        return {
            success: true,
            content,
            tool_calls,
            raw: result
        };
    } catch (error: unknown) {
        return {
            success: false,
            error: String(error)
        };
    }
});
