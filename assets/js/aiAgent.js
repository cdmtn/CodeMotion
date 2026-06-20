const AGENT_STORAGE_KEY = "codemotion.ai.agent.settings";

function getAgentSettings() {
    try {
        return JSON.parse(localStorage.getItem(AGENT_STORAGE_KEY) || "{}");
    } catch {
        return {};
    }
}

function saveAgentSettings(settings) {
    localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(settings));
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

export class AiAgent {
    constructor(options) {
        this.provider = options.provider;
        this.apiKey = options.apiKey;
        this.model = options.model;
        this.messages = [];
        this.isRunning = false;
        this.pendingActions = [];
        this.onUpdate = options.onUpdate || (() => {});
        this.onAction = options.onAction || (() => {});
        this.onComplete = options.onComplete || (() => {});
        this.onError = options.onError || (() => {});
    }

    async run(task) {
        if (this.isRunning) return;
        this.isRunning = true;
        this.messages = [{ role: "user", content: task }];
        this.pendingActions = [];

        try {
            await this.step();
        } catch (e) {
            this.onError(String(e));
        }
    }

    async step() {
        if (!this.isRunning) return;

        this.onUpdate({ type: "thinking", content: "AI is thinking..." });

        const result = await window.electron.aiAgentChat({
            provider: this.provider,
            apiKey: this.apiKey,
            model: this.model,
            messages: this.messages,
            temperature: 0.7,
            maxTokens: 8192,
            enableTools: true
        });

        if (!result.success) {
            this.onUpdate({ type: "error", content: result.error });
            this.isRunning = false;
            this.onComplete();
            return;
        }

        // Add assistant message to history
        const assistantMsg = {
            role: "assistant",
            content: result.content || ""
        };
        this.messages.push(assistantMsg);

        this.onUpdate({ type: "message", content: result.content || "" });

        // Handle tool calls
        if (result.tool_calls && result.tool_calls.length > 0) {
            this.pendingActions = result.tool_calls.map((tc, idx) => ({
                id: tc.id || `tool_${idx}`,
                name: tc.function?.name,
                arguments: tc.function?.arguments ? JSON.parse(tc.function.arguments) : {},
                approved: null, // null = pending, true = approved, false = rejected
                result: null
            }));

            this.onUpdate({ type: "actions", actions: this.pendingActions });

            // Wait for all actions to be resolved
            await this.waitForActions();

            // Execute approved actions and feed results back
            const toolResults = [];
            for (const action of this.pendingActions) {
                if (action.approved === true) {
                    const res = await window.electron.aiAgentTool(action.name, action.arguments);
                    action.result = res;
                    toolResults.push({
                        role: "tool",
                        tool_call_id: action.id,
                        content: res.success ? res.output : `Error: ${res.error}`
                    });
                }
            }

            // Add tool results to messages
            this.messages.push(...toolResults);

            this.onUpdate({ type: "action_results", actions: this.pendingActions });

            // Continue loop
            await this.step();
        } else {
            this.isRunning = false;
            this.onComplete();
        }
    }

    async waitForActions() {
        while (this.pendingActions.some(a => a.approved === null)) {
            await new Promise(r => setTimeout(r, 100));
        }
    }

    approveAction(actionId) {
        const action = this.pendingActions.find(a => a.id === actionId);
        if (action) action.approved = true;
    }

    rejectAction(actionId) {
        const action = this.pendingActions.find(a => a.id === actionId);
        if (action) action.approved = false;
    }

    stop() {
        this.isRunning = false;
    }
}
