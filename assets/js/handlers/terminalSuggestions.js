export const COMMANDS = {
    go: ["build", "run", "test", "mod", "get", "install", "vet", "fmt", "clean", "doc", "env", "version", "generate", "work", "list", "tool"],
    git: ["add", "commit", "push", "pull", "clone", "status", "log", "branch", "checkout", "switch", "merge", "rebase", "stash", "diff", "fetch", "reset", "remote", "tag", "init", "restore", "show", "revert", "cherry-pick"],
    npm: ["install", "run", "start", "test", "build", "init", "publish", "update", "ci", "audit", "exec", "uninstall", "list", "link", "pack"],
    pnpm: ["install", "add", "run", "start", "test", "build", "update", "remove", "exec", "dlx", "create"],
    yarn: ["install", "add", "run", "start", "test", "build", "remove", "upgrade", "dlx", "create"],
    docker: ["run", "build", "ps", "images", "pull", "push", "exec", "compose", "stop", "start", "rm", "rmi", "logs", "inspect", "tag", "network", "volume"],
    cargo: ["build", "run", "test", "new", "init", "add", "update", "check", "clean", "doc", "publish", "install", "fmt", "clippy", "bench"],
    pip: ["install", "uninstall", "list", "show", "freeze", "download", "check"],
    kubectl: ["get", "describe", "apply", "delete", "logs", "exec", "create", "edit", "scale", "rollout", "config"],
};

export function parseTyped(beforeCursor) {
    if (beforeCursor == null) return null;
    const match = beforeCursor.match(/^.*?[>$#]\s(.*)$/);
    return match ? match[1] : null;
}

export function computeSuggestions(typed) {
    if (typed == null) return null;

    const endsWithSpace = /\s$/.test(typed);
    const tokens = typed.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return null;

    const cmd = tokens[0];

    if (tokens.length === 1 && !endsWithSpace && !COMMANDS[cmd]) {
        const matches = Object.keys(COMMANDS).filter((c) => c.startsWith(cmd) && c !== cmd);
        if (!matches.length) return null;
        return { items: matches.map((c) => ({ label: c, insertText: c.slice(cmd.length) })) };
    }

    const subs = COMMANDS[cmd];
    if (!subs) return null;

    let partial;
    let needsLeadingSpace;

    if (tokens.length === 1 && !endsWithSpace) {
        partial = "";
        needsLeadingSpace = true;
    } else if (tokens.length === 1 && endsWithSpace) {
        partial = "";
        needsLeadingSpace = false;
    } else if (tokens.length === 2 && !endsWithSpace) {
        partial = tokens[1];
        needsLeadingSpace = false;
    } else {
        return null;
    }

    const matches = subs.filter((s) => s.startsWith(partial) && s !== partial);
    if (!matches.length) return null;

    return {
        items: matches.map((s) => ({
            label: s,
            insertText: (needsLeadingSpace ? " " : "") + s.slice(partial.length),
        })),
    };
}
