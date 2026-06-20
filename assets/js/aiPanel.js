const STORAGE_KEY = "codemotion.ai.settings";

function getSettings() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
        return {};
    }
}

function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function parseMarkdownCode(text) {
    let html = escapeHtml(text);
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
    });
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\n/g, '<br>');
    return html;
}

import { AiAgent } from "./aiAgent.js";

export function initAiPanel(getCurrentFileContent, getCurrentFilePath, gls) {
    const setupPanel = document.getElementById("aiSetupPanel");
    const chatPanel = document.getElementById("aiChatPanel");
    const providerSelect = document.getElementById("aiProvider");
    const modelSelect = document.getElementById("aiModel");
    const apiKeyInput = document.getElementById("aiApiKey");
    const saveBtn = document.getElementById("aiSaveSettings");
    const settingsBtn = document.getElementById("aiOpenSettings");
    const backBtn = document.getElementById("aiBackToChat");
    const messagesEl = document.getElementById("aiMessages");
    const inputEl = document.getElementById("aiInput");
    const sendBtn = document.getElementById("aiSend");
    const modelNameEl = document.getElementById("aiModelName");
    const quickActions = document.querySelectorAll(".ai-panel__quick-actions button");

    // Mode toggle elements
    const modeChatBtn = document.getElementById("aiModeChat");
    const modeAgentBtn = document.getElementById("aiModeAgent");
    const chatModeEl = document.getElementById("aiChatMode");
    const agentModeEl = document.getElementById("aiAgentMode");

    // Agent elements
    const agentTaskInput = document.getElementById("aiAgentTask");
    const agentRunBtn = document.getElementById("aiAgentRun");
    const agentStatus = document.getElementById("aiAgentStatus");
    const agentStatusText = document.getElementById("aiAgentStatusText");
    const agentStopBtn = document.getElementById("aiAgentStop");
    const agentThoughts = document.getElementById("aiAgentThoughts");
    const agentThoughtsContent = document.getElementById("aiAgentThoughtsContent");
    const agentActions = document.getElementById("aiAgentActions");
    const agentMessages = document.getElementById("aiAgentMessages");

    let models = {};
    let messages = [];
    let isLoading = false;
    let currentMode = "chat";
    let agent = null;

    if (gls) {
        inputEl.setAttribute("placeholder", gls.get("ai.inputPlaceholder"));
    }

    async function loadModels() {
        try {
            models = await window.electron.aiGetModels();
            updateModelSelect();
        } catch (e) {
            console.error("Failed to load AI models:", e);
        }
    }

    function updateModelSelect() {
        const provider = providerSelect.value;
        modelSelect.innerHTML = "";
        const list = models[provider] || [];
        list.forEach(m => {
            const opt = document.createElement("option");
            opt.value = m.id;
            opt.textContent = m.name;
            modelSelect.appendChild(opt);
        });
    }

    function renderMessages() {
        messagesEl.innerHTML = "";
        messages.forEach((msg, idx) => {
            const div = document.createElement("div");
            div.className = `ai-message ${msg.role}`;

            const roleLabel = document.createElement("div");
            roleLabel.className = "ai-message__role";
            roleLabel.textContent = msg.role === "user" ? "You" : "AI";
            div.appendChild(roleLabel);

            const content = document.createElement("div");
            content.innerHTML = parseMarkdownCode(msg.content);
            div.appendChild(content);

            // Render attachments as collapsible spoilers
            if (msg.attachments && msg.attachments.length > 0) {
                msg.attachments.forEach(att => {
                    const attDiv = document.createElement("div");
                    attDiv.className = "ai-attachment";

                    const header = document.createElement("div");
                    header.className = "ai-attachment__header";
                    header.innerHTML = `<span class="material-symbols-rounded ai-attachment__icon">attachment</span>
                        <span class="ai-attachment__filename">${escapeHtml(att.filename)}</span>
                        <span class="material-symbols-rounded ai-attachment__toggle">expand_more</span>`;

                    header.addEventListener("click", () => {
                        attDiv.classList.toggle("expanded");
                    });

                    const codeBlock = document.createElement("pre");
                    codeBlock.className = "ai-attachment__content";
                    codeBlock.textContent = att.code;

                    attDiv.appendChild(header);
                    attDiv.appendChild(codeBlock);
                    div.appendChild(attDiv);
                });
            }

            if (msg.role === "assistant") {
                const actions = document.createElement("div");
                actions.className = "ai-message__actions";

                const copyBtn = document.createElement("button");
                copyBtn.textContent = "Copy";
                copyBtn.addEventListener("click", () => {
                    navigator.clipboard.writeText(msg.content);
                });
                actions.appendChild(copyBtn);

                const insertBtn = document.createElement("button");
                insertBtn.textContent = "Insert";
                insertBtn.addEventListener("click", () => {
                    const event = new CustomEvent("ai-insert-code", { detail: msg.content });
                    document.dispatchEvent(event);
                });
                actions.appendChild(insertBtn);

                div.appendChild(actions);
            }

            messagesEl.appendChild(div);
        });
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function addMessage(role, content, attachments = []) {
        messages.push({ role, content, attachments });
        renderMessages();
    }

    function showTyping() {
        const div = document.createElement("div");
        div.className = "ai-typing";
        div.id = "aiTypingIndicator";
        div.innerHTML = "<span></span><span></span><span></span>";
        messagesEl.appendChild(div);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function hideTyping() {
        const el = document.getElementById("aiTypingIndicator");
        if (el) el.remove();
    }

    function buildApiMessage(msg) {
        let content = String(msg.content || "");
        if (msg.attachments && msg.attachments.length > 0) {
            content += "\n\n" + msg.attachments.map(a => `File: ${a.filename}\n\`\`\`\n${a.code}\n\`\`\``).join("\n\n");
        }
        return { role: msg.role, content };
    }

    function mergeSystemIntoFirstUser(messages, systemText) {
        const result = messages.map(m => ({ ...m }));
        const firstUserIdx = result.findIndex(m => m.role === "user");
        if (firstUserIdx !== -1) {
            result[firstUserIdx].content = `${systemText}\n\n---\n\n${result[firstUserIdx].content}`;
        } else {
            result.unshift({ role: "user", content: systemText });
        }
        return result;
    }

    async function sendMessage(userContent, systemOverride, attachments = []) {
        if (isLoading) return;
        const settings = getSettings();
        if (!settings.apiKey) {
            addMessage("assistant", "Please configure your API key in settings.");
            return;
        }

        isLoading = true;
        sendBtn.disabled = true;

        if (userContent) {
            addMessage("user", userContent, attachments);
        }

        showTyping();

        // 1. Filter out ANY message with empty/whitespace-only content
        const validMessages = messages.filter(m => {
            const content = String(m.content || "").trim();
            return content.length > 0;
        });

        // 2. Build API payload
        const systemText = systemOverride || "You are a helpful coding assistant. Respond concisely with code examples where appropriate.";
        const mergedMessages = mergeSystemIntoFirstUser(validMessages, systemText);
        const chatMessages = mergedMessages.map(buildApiMessage);

        try {
            const result = await window.electron.aiChat({
                provider: settings.provider,
                apiKey: settings.apiKey,
                model: settings.model,
                messages: chatMessages,
                temperature: 0.7,
                maxTokens: 4096
            });

            hideTyping();

            if (result.success) {
                const text = result.content || "";
                if (!text.trim()) {
                    addMessage("assistant", "The model returned an empty response. This can happen with free-tier models or when the request is blocked. Try again or switch models.");
                } else {
                    addMessage("assistant", text);
                }
            } else {
                addMessage("assistant", `Error: ${result.error}`);
            }
        } catch (e) {
            hideTyping();
            addMessage("assistant", `Error: ${String(e)}`);
        }

        isLoading = false;
        sendBtn.disabled = false;
    }

    // ==================== MODE TOGGLE ====================
    function switchMode(mode) {
        currentMode = mode;
        if (mode === "chat") {
            modeChatBtn.classList.add("active");
            modeAgentBtn.classList.remove("active");
            chatModeEl.classList.remove("hidden");
            agentModeEl.classList.add("hidden");
        } else {
            modeAgentBtn.classList.add("active");
            modeChatBtn.classList.remove("active");
            agentModeEl.classList.remove("hidden");
            chatModeEl.classList.add("hidden");
        }
    }

    modeChatBtn.addEventListener("click", () => switchMode("chat"));
    modeAgentBtn.addEventListener("click", () => switchMode("agent"));

    // ==================== AGENT MODE ====================
    function renderAgentMessage(role, content) {
        const div = document.createElement("div");
        div.className = `ai-message ${role}`;

        const roleLabel = document.createElement("div");
        roleLabel.className = "ai-message__role";
        roleLabel.textContent = role === "user" ? "You" : "AI";
        div.appendChild(roleLabel);

        const contentDiv = document.createElement("div");
        contentDiv.innerHTML = parseMarkdownCode(content);
        div.appendChild(contentDiv);

        agentMessages.appendChild(div);
        agentMessages.scrollTop = agentMessages.scrollHeight;
    }

    function clearAgentUI() {
        agentMessages.innerHTML = "";
        agentThoughts.classList.add("hidden");
        agentThoughtsContent.textContent = "";
        agentActions.classList.add("hidden");
        agentActions.innerHTML = "";
    }

    function showAgentThinking(text) {
        agentThoughts.classList.remove("hidden");
        agentThoughtsContent.textContent += (agentThoughtsContent.textContent ? "\n\n" : "") + text;
        agentThoughtsContent.scrollTop = agentThoughtsContent.scrollHeight;
    }

    function renderAgentActions(actions) {
        agentActions.classList.remove("hidden");
        agentActions.innerHTML = "";

        actions.forEach(action => {
            const card = document.createElement("div");
            card.className = "ai-agent__action-card";
            card.dataset.actionId = action.id;

            const nameDiv = document.createElement("div");
            nameDiv.className = "action-name";
            nameDiv.innerHTML = `<span class="material-symbols-rounded">build_circle</span> ${escapeHtml(action.name)}`;
            card.appendChild(nameDiv);

            const argsDiv = document.createElement("div");
            argsDiv.className = "action-args";
            argsDiv.textContent = JSON.stringify(action.arguments, null, 2);
            card.appendChild(argsDiv);

            const buttonsDiv = document.createElement("div");
            buttonsDiv.className = "action-buttons";

            const approveBtn = document.createElement("button");
            approveBtn.className = "btn-approve";
            approveBtn.textContent = "Approve";
            approveBtn.addEventListener("click", () => {
                agent.approveAction(action.id);
                card.style.opacity = "0.5";
                approveBtn.disabled = true;
                rejectBtn.disabled = true;
                approveBtn.textContent = "Approved";
            });

            const rejectBtn = document.createElement("button");
            rejectBtn.className = "btn-reject";
            rejectBtn.textContent = "Reject";
            rejectBtn.addEventListener("click", () => {
                agent.rejectAction(action.id);
                card.style.opacity = "0.5";
                approveBtn.disabled = true;
                rejectBtn.disabled = true;
                rejectBtn.textContent = "Rejected";
            });

            buttonsDiv.appendChild(approveBtn);
            buttonsDiv.appendChild(rejectBtn);
            card.appendChild(buttonsDiv);

            agentActions.appendChild(card);
        });
    }

    async function runAgent() {
        const settings = getSettings();
        if (!settings.apiKey) {
            alert("Please configure your API key in settings.");
            return;
        }

        const task = agentTaskInput.value.trim();
        if (!task) return;

        clearAgentUI();
        agentStatus.classList.remove("hidden");
        agentStatusText.textContent = "Running...";
        agentRunBtn.disabled = true;

        renderAgentMessage("user", task);

        agent = new AiAgent({
            provider: settings.provider,
            apiKey: settings.apiKey,
            model: settings.model,
            onUpdate: (update) => {
                if (update.type === "thinking") {
                    showAgentThinking(update.content);
                } else if (update.type === "message") {
                    renderAgentMessage("assistant", update.content);
                } else if (update.type === "actions") {
                    renderAgentActions(update.actions);
                } else if (update.type === "error") {
                    renderAgentMessage("assistant", `Error: ${update.content}`);
                }
            },
            onComplete: () => {
                agentStatus.classList.add("hidden");
                agentRunBtn.disabled = false;
            },
            onError: (err) => {
                renderAgentMessage("assistant", `Error: ${err}`);
                agentStatus.classList.add("hidden");
                agentRunBtn.disabled = false;
            }
        });

        await agent.run(task);
    }

    agentRunBtn.addEventListener("click", runAgent);

    agentStopBtn.addEventListener("click", () => {
        if (agent) agent.stop();
        agentStatus.classList.add("hidden");
        agentRunBtn.disabled = false;
    });

    agentTaskInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            agentRunBtn.click();
        }
    });

    // ==================== INIT ====================
    loadModels();

    const settings = getSettings();
    if (settings.provider) providerSelect.value = settings.provider;
    if (settings.model) {
        setTimeout(() => {
            modelSelect.value = settings.model;
        }, 500);
    }
    if (settings.apiKey) apiKeyInput.value = settings.apiKey;

    if (settings.provider && settings.model && settings.apiKey) {
        setupPanel.classList.add("hidden");
        chatPanel.classList.remove("hidden");
        modelNameEl.textContent = settings.model;
    }

    providerSelect.addEventListener("change", updateModelSelect);

    saveBtn.addEventListener("click", () => {
        const s = {
            provider: providerSelect.value,
            model: modelSelect.value,
            apiKey: apiKeyInput.value.trim()
        };
        saveSettings(s);
        setupPanel.classList.add("hidden");
        chatPanel.classList.remove("hidden");
        modelNameEl.textContent = s.model;
    });

    settingsBtn.addEventListener("click", () => {
        chatPanel.classList.add("hidden");
        setupPanel.classList.remove("hidden");
    });

    backBtn.addEventListener("click", () => {
        setupPanel.classList.add("hidden");
        chatPanel.classList.remove("hidden");
    });

    sendBtn.addEventListener("click", () => {
        const text = inputEl.value.trim();
        if (!text) return;
        inputEl.value = "";
        inputEl.style.height = "auto";
        sendMessage(text);
    });

    inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });

    inputEl.addEventListener("input", () => {
        inputEl.style.height = "auto";
        inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
    });

    quickActions.forEach(btn => {
        btn.addEventListener("click", () => {
            const action = btn.dataset.action;
            const fileContent = getCurrentFileContent();
            const filePath = getCurrentFilePath();

            let prompt = "";
            let attachments = [];

            switch (action) {
                case "explain":
                    prompt = "Explain the following code:";
                    break;
                case "fix":
                    prompt = "Find and fix any errors or issues in the following code. Return only the fixed code with brief comments explaining changes:";
                    break;
                case "tests":
                    prompt = "Write unit tests for the following code:";
                    break;
                case "review":
                    prompt = "Review the following code for best practices, potential bugs, and performance issues. Be concise:";
                    break;
            }

            if (filePath) {
                attachments = [{ filename: filePath, code: fileContent }];
            }

            if (prompt) {
                sendMessage(prompt, "You are a helpful coding assistant. Be concise and practical.", attachments);
            }
        });
    });

    // Listen for insert events
    document.addEventListener("ai-insert-code", (e) => {
        const event = new CustomEvent("ai-request-insert", { detail: e.detail });
        document.dispatchEvent(event);
    });
}
