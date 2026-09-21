import { EditorView, ViewUpdate, Panel, KeyBinding, keymap, runScopeHandlers } from "@codemirror/view";
import { CharCategory, EditorSelection, EditorState, Extension, StateEffect, Text } from "@codemirror/state";
import {
    search, SearchQuery, setSearchQuery, getSearchQuery, searchPanelOpen,
    openSearchPanel, closeSearchPanel, findNext, findPrevious,
    replaceNext, replaceAll, selectMatches, selectSelectionMatches
} from "@codemirror/search";

const MATCH_LIMIT = 9999;
const SLICE_BUDGET_MS = 6;
const CHUNK_SIZE = 65_536;
const REGEXP_OVERLAP = 8_192;
const LARGE_DOC_LENGTH = 2_000_000;
const TYPE_DEBOUNCE_MS = 100;
const DOC_DEBOUNCE_MS = 180;

const widgets = new WeakMap<EditorView, FindWidget>();

function lowerBound(list: number[], value: number): number {
    let low = 0, high = list.length;
    while (low < high) {
        const mid = (low + high) >> 1;
        if (list[mid] < value) low = mid + 1;
        else high = mid;
    }
    return low;
}

function upperBound(list: number[], value: number): number {
    let low = 0, high = list.length;
    while (low < high) {
        const mid = (low + high) >> 1;
        if (list[mid] <= value) low = mid + 1;
        else high = mid;
    }
    return low;
}

function scheduleSlice(run: () => void): () => void {
    const scheduler = (globalThis as any).scheduler;

    if (scheduler && typeof scheduler.postTask === "function") {
        const controller = new AbortController();
        scheduler.postTask(run, { priority: "background", signal: controller.signal }).catch(() => {});
        return () => controller.abort();
    }

    const timer = setTimeout(run, 0);
    return () => clearTimeout(timer);
}

const ASCII_ONLY = /^[\x00-\x7f]*$/;
const MULTILINE_REGEXP = /\\[sWDnr]|\n|\r|\[\^/;

class MatchIndex {
    from: number[] = [];
    to: number[] = [];
    done = true;
    capped = false;
    doc: Text | null = null;
    query: SearchQuery | null = null;

    private run = 0;
    private cancelSlice: (() => void) | null = null;
    private needle = "";
    private fastPath = false;
    private multiline = false;

    get count() {
        return this.from.length;
    }

    fresh(state: EditorState, query: SearchQuery) {
        return this.done && this.doc === state.doc && !!this.query && this.query.eq(query);
    }

    cancel() {
        this.run++;
        if (this.cancelSlice) this.cancelSlice();
        this.cancelSlice = null;
    }

    build(state: EditorState, query: SearchQuery, onProgress: () => void, onDone: () => void) {
        this.cancel();
        this.from = [];
        this.to = [];
        this.capped = false;
        this.doc = state.doc;
        this.query = query;

        if (!query.search || !query.valid) {
            this.done = true;
            onDone();
            return;
        }

        const unquoted: string = (query as any).unquoted ?? query.search;
        this.needle = query.caseSensitive ? unquoted : unquoted.toLowerCase();
        this.fastPath = !query.regexp && ASCII_ONLY.test(unquoted);
        this.multiline = query.regexp && MULTILINE_REGEXP.test(query.search);

        this.done = false;
        const run = this.run;
        let pos = 0;

        const step = () => {
            if (run !== this.run) return;
            this.cancelSlice = null;

            const deadline = performance.now() + SLICE_BUDGET_MS;
            while (!this.done) {
                pos = this.scanChunk(state, query, pos);
                if (performance.now() > deadline) break;
            }

            if (this.done) {
                onDone();
            } else {
                onProgress();
                this.cancelSlice = scheduleSlice(step);
            }
        };

        step();
    }

    private scanChunk(state: EditorState, query: SearchQuery, start: number): number {
        const doc = state.doc, length = doc.length;
        let end: number, windowEnd: number;

        if (query.regexp) {
            // line-aligned so per-line regexp matching sees whole lines
            end = Math.min(length, doc.lineAt(Math.min(length, start + CHUNK_SIZE)).to + 1);
            windowEnd = this.multiline ? doc.lineAt(Math.min(length, end + REGEXP_OVERLAP)).to : end;
        } else {
            end = Math.min(length, start + CHUNK_SIZE);
            windowEnd = Math.min(length, end + this.needle.length + 2);
        }

        const last = end >= length;
        let next = end;

        const add = (from: number, to: number) => {
            this.from.push(from);
            this.to.push(to);
            if (to > next) next = to;
            if (this.from.length >= MATCH_LIMIT) this.capped = true;
        };

        if (!this.fastPath || !this.scanAscii(state, query, start, end, windowEnd, last, add)) {
            const cursor = query.getCursor(state, start, windowEnd) as any;
            while (!this.capped) {
                const result = cursor.next();
                if (result.done) break;
                if (result.value.from >= end && !last) break;
                add(result.value.from, result.value.to);
            }
        }

        if (last || this.capped) this.done = true;
        return next;
    }

    private scanAscii(
        state: EditorState, query: SearchQuery, start: number, end: number,
        windowEnd: number, last: boolean, add: (from: number, to: number) => void
    ): boolean {
        const base = Math.max(0, start - 2);
        const text = state.doc.sliceString(base, windowEnd);
        if (!ASCII_ONLY.test(text)) return false;

        const hay = query.caseSensitive ? text : text.toLowerCase();
        const needle = this.needle, size = needle.length;
        const categorize = query.wholeWord ? state.charCategorizer(state.selection.main.head) : null;
        const isWord = (ch: string | undefined) => !!ch && categorize!(ch) === CharCategory.Word;

        let at = hay.indexOf(needle, start - base);
        while (at >= 0 && !this.capped) {
            const from = base + at, to = from + size;
            if (from >= end && !last) break;

            const whole = !categorize || (
                (!isWord(text[at - 1]) || !isWord(text[at])) &&
                (!isWord(text[at + size]) || !isWord(text[at + size - 1]))
            );

            if (whole) add(from, to);
            at = hay.indexOf(needle, whole ? at + size : at + 1);
        }

        return true;
    }

    indexOf(from: number, to: number) {
        const i = lowerBound(this.from, from);
        return i < this.count && this.from[i] === from && this.to[i] === to ? i : -1;
    }
}

function revealEffect(view: EditorView, from: number, to: number): StateEffect<unknown> {
    const block = view.lineBlockAt(from);
    const top = view.scrollDOM.scrollTop;
    const height = view.scrollDOM.clientHeight;
    const visible = block.top >= top + 48 && block.bottom <= top + height - 16;

    return EditorView.scrollIntoView(EditorSelection.range(from, to), {
        y: visible ? "nearest" : "center",
        yMargin: 48
    });
}

function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: Record<string, string> = {},
    children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    for (const name in attrs) node.setAttribute(name, attrs[name]);
    for (const child of children) node.append(child);
    return node;
}

function icon(name: string) {
    return el("span", { class: "material-symbols-rounded", "aria-hidden": "true" }, [name]);
}

class FindWidget implements Panel {
    dom: HTMLElement;
    top = true;

    private view: EditorView;
    private query: SearchQuery;
    private index = new MatchIndex();

    private findInput: HTMLInputElement;
    private replaceInput: HTMLInputElement;
    private countLabel: HTMLElement;
    private toggleButton: HTMLButtonElement;
    private replaceRow: HTMLElement;
    private optionButtons: Record<string, HTMLButtonElement> = {};

    private typeTimer: ReturnType<typeof setTimeout> | null = null;
    private docTimer: ReturnType<typeof setTimeout> | null = null;
    private buildQueued = false;
    private jumpPending = false;
    private ownChange = false;
    private destroyed = false;

    constructor(view: EditorView) {
        this.view = view;
        this.query = getSearchQuery(view.state);

        const phrase = (text: string) => view.state.phrase(text);

        this.findInput = el("input", {
            class: "cm-find__input",
            name: "search",
            form: "",
            "main-field": "true",
            placeholder: phrase("Find"),
            "aria-label": phrase("Find"),
            autocomplete: "off",
            spellcheck: "false"
        });
        this.replaceInput = el("input", {
            class: "cm-find__input",
            name: "replace",
            form: "",
            placeholder: phrase("Replace"),
            "aria-label": phrase("Replace"),
            autocomplete: "off",
            spellcheck: "false"
        });

        const option = (key: string, label: Node | string, title: string) => {
            const button = el("button", {
                type: "button",
                class: "cm-find__option",
                title: phrase(title),
                "aria-label": phrase(title),
                "aria-pressed": "false"
            }, [label]);
            button.addEventListener("click", () => this.toggleOption(key));
            this.optionButtons[key] = button;
            return button;
        };

        const action = (name: string, title: string, run: () => void) => {
            const button = el("button", {
                type: "button",
                class: "cm-find__button",
                title: phrase(title),
                "aria-label": phrase(title)
            }, [icon(name)]);
            button.addEventListener("click", run);
            return button;
        };

        this.countLabel = el("span", { class: "cm-find__count", "aria-live": "polite" });
        this.toggleButton = el("button", {
            type: "button",
            class: "cm-find__toggle",
            title: phrase("Toggle Replace"),
            "aria-label": phrase("Toggle Replace"),
            "aria-expanded": "false"
        }, [icon("chevron_right")]);
        this.toggleButton.addEventListener("click", () => this.showReplace(!this.dom.classList.contains("cm-find--replace")));

        const findRow = el("div", { class: "cm-find__row" }, [
            el("div", { class: "cm-find__field" }, [
                this.findInput,
                el("div", { class: "cm-find__options" }, [
                    option("caseSensitive", "Aa", "Match Case (Alt+C)"),
                    option("wholeWord", el("u", {}, ["ab"]), "Match Whole Word (Alt+W)"),
                    option("regexp", ".*", "Use Regular Expression (Alt+R)")
                ])
            ]),
            el("div", { class: "cm-find__actions" }, [
                this.countLabel,
                action("arrow_upward", "Previous Match (Shift+Enter)", () => findPreviousMatch(this.view)),
                action("arrow_downward", "Next Match (Enter)", () => findNextMatch(this.view)),
                action("close", "Close (Escape)", () => closeSearchPanel(this.view))
            ])
        ]);

        this.replaceRow = el("div", { class: "cm-find__row cm-find__row--replace" }, [
            el("div", { class: "cm-find__field" }, [this.replaceInput]),
            el("div", { class: "cm-find__actions" }, [
                action("find_replace", "Replace (Enter)", () => this.replace(false)),
                action("done_all", "Replace All (Ctrl+Alt+Enter)", () => this.replace(true))
            ])
        ]);
        this.replaceRow.hidden = true;

        this.dom = el("div", { class: "cm-find" }, [
            this.toggleButton,
            el("div", { class: "cm-find__rows" }, [findRow, this.replaceRow])
        ]);

        this.dom.addEventListener("keydown", (event) => this.onKeydown(event));
        this.dom.addEventListener("mousedown", (event) => {
            // keep focus where it is when clicking the widget's buttons
            if ((event.target as HTMLElement).closest("button")) event.preventDefault();
        });
        this.findInput.addEventListener("input", () => this.onFindInput());
        this.replaceInput.addEventListener("input", () => this.commit());

        this.syncFromQuery(this.query);
        this.dom.classList.toggle("cm-find--readonly", view.state.readOnly);

        widgets.set(view, this);
        this.queueBuild();
    }

    mount() {
        this.findInput.focus();
        this.findInput.select();
    }

    destroy() {
        this.destroyed = true;
        this.index.cancel();
        if (this.typeTimer !== null) clearTimeout(this.typeTimer);
        if (this.docTimer !== null) clearTimeout(this.docTimer);
        if (widgets.get(this.view) === this) widgets.delete(this.view);
    }

    update(update: ViewUpdate) {
        for (const tr of update.transactions) {
            for (const effect of tr.effects) {
                if (effect.is(setSearchQuery) && !effect.value.eq(this.query)) {
                    this.syncFromQuery(effect.value);
                }
            }
        }

        if (update.startState.readOnly !== update.state.readOnly) {
            this.dom.classList.toggle("cm-find--readonly", update.state.readOnly);
        }

        const query = getSearchQuery(update.state);
        const queryChanged = !this.index.query || !query.eq(this.index.query);

        if (queryChanged) {
            this.queueBuild();
        } else if (update.docChanged) {
            if (this.ownChange) this.queueBuild();
            else this.scheduleDocBuild();
        } else if (update.selectionSet) {
            this.refreshCount();
        }
    }

    // -- query <-> inputs

    private syncFromQuery(query: SearchQuery) {
        this.query = query;
        if (this.findInput.value !== query.search) this.findInput.value = query.search;
        if (this.replaceInput.value !== query.replace) this.replaceInput.value = query.replace;
        this.setPressed("caseSensitive", query.caseSensitive);
        this.setPressed("wholeWord", query.wholeWord);
        this.setPressed("regexp", query.regexp);
    }

    private setPressed(key: string, pressed: boolean) {
        this.optionButtons[key].setAttribute("aria-pressed", String(pressed));
    }

    private isPressed(key: string) {
        return this.optionButtons[key].getAttribute("aria-pressed") === "true";
    }

    private commit() {
        if (this.typeTimer !== null) clearTimeout(this.typeTimer);
        this.typeTimer = null;

        const regexp = this.isPressed("regexp");
        const query = new SearchQuery({
            search: this.findInput.value,
            replace: this.replaceInput.value,
            caseSensitive: this.isPressed("caseSensitive"),
            wholeWord: this.isPressed("wholeWord"),
            regexp,
            literal: !regexp
        });

        if (!query.eq(this.query)) {
            this.query = query;
            this.view.dispatch({ effects: setSearchQuery.of(query) });
        }
    }

    private onFindInput() {
        this.jumpPending = true;
        if (this.typeTimer !== null) clearTimeout(this.typeTimer);

        if (this.view.state.doc.length > LARGE_DOC_LENGTH) {
            this.typeTimer = setTimeout(() => this.commit(), TYPE_DEBOUNCE_MS);
        } else {
            this.commit();
        }
    }

    toggleOption(key: string) {
        this.setPressed(key, !this.isPressed(key));
        this.jumpPending = true;
        this.commit();
    }

    showReplace(show: boolean, focus = false) {
        if (this.view.state.readOnly) show = false;

        this.replaceRow.hidden = !show;
        this.toggleButton.setAttribute("aria-expanded", String(show));
        this.dom.classList.toggle("cm-find--replace", show);

        if (show && focus) {
            this.replaceInput.focus();
            this.replaceInput.select();
        }
    }

    focusFind() {
        this.findInput.focus();
        this.findInput.select();
    }

    // -- match index

    private queueBuild() {
        if (this.buildQueued) return;
        this.buildQueued = true;
        if (this.docTimer !== null) clearTimeout(this.docTimer);
        this.docTimer = null;

        Promise.resolve().then(() => {
            this.buildQueued = false;
            this.ownChange = false;
            if (!this.destroyed) this.build();
        });
    }

    private scheduleDocBuild() {
        this.index.cancel();
        if (this.docTimer !== null) clearTimeout(this.docTimer);
        this.docTimer = setTimeout(() => {
            this.docTimer = null;
            this.queueBuild();
        }, DOC_DEBOUNCE_MS);
    }

    private build() {
        const state = this.view.state;
        this.index.build(
            state,
            getSearchQuery(state),
            () => {
                this.refreshCount();
                this.tryJump();
            },
            () => {
                this.refreshCount();
                this.tryJump();
            }
        );
    }

    private tryJump() {
        if (!this.jumpPending) return;

        const index = this.index;
        if (index.doc !== this.view.state.doc) return;

        if (index.count === 0) {
            if (index.done) this.jumpPending = false;
            return;
        }

        const anchor = this.view.state.selection.main.from;
        let target = lowerBound(index.from, anchor);

        if (target >= index.count) {
            if (!index.done) return;
            target = 0;
        }

        this.jumpPending = false;
        this.select(target);
    }

    private select(i: number) {
        const from = this.index.from[i], to = this.index.to[i];
        const main = this.view.state.selection.main;
        const line = this.view.state.doc.lineAt(from);

        if (main.from === from && main.to === to) return;

        this.view.dispatch({
            selection: EditorSelection.single(from, to),
            effects: [
                revealEffect(this.view, from, to),
                EditorView.announce.of(`${this.view.state.phrase("current match")}. ${this.view.state.phrase("on line")} ${line.number}.`)
            ],
            userEvent: "select.search"
        });
    }

    step(direction: 1 | -1): boolean {
        const state = this.view.state;
        const index = this.index;

        if (!index.fresh(state, getSearchQuery(state)) || index.capped) return false;
        if (index.count === 0) return true;

        const main = state.selection.main;
        let target: number;

        if (direction === 1) {
            target = lowerBound(index.from, main.to);
            if (target < index.count && index.from[target] === main.from && index.to[target] === main.to) target++;
            if (target >= index.count) target = 0;
        } else {
            target = upperBound(index.to, main.from) - 1;
            if (target >= 0 && index.from[target] === main.from && index.to[target] === main.to) target--;
            if (target < 0) target = index.count - 1;
        }

        this.select(target);
        return true;
    }

    private refreshCount() {
        const state = this.view.state;
        const index = this.index;
        const phrase = (text: string) => state.phrase(text);
        const query = getSearchQuery(state);

        const invalid = !!query.search && !query.valid;
        this.dom.classList.toggle("cm-find--invalid", invalid);

        if (invalid) {
            this.dom.classList.remove("cm-find--empty");
            this.countLabel.textContent = phrase("Invalid regex");
            return;
        }

        if (index.doc !== state.doc) return;

        const total = index.count;
        const noResults = !!query.search && index.done && total === 0;
        this.dom.classList.toggle("cm-find--empty", noResults);

        if (!query.search || total === 0) {
            this.countLabel.textContent = index.done ? phrase("No results") : "…";
            return;
        }

        const main = state.selection.main;
        const current = index.indexOf(main.from, main.to);
        const totalText = index.capped || !index.done ? `${total}+` : String(total);

        this.countLabel.textContent = `${current >= 0 ? current + 1 : "?"} ${phrase("of")} ${totalText}`;
    }

    // -- actions

    private replace(all: boolean) {
        if (this.view.state.readOnly) return;

        this.commit();
        this.ownChange = true;
        const changed = (all ? replaceAll : replaceNext)(this.view);
        if (!changed) this.ownChange = false;
    }

    private onKeydown(event: KeyboardEvent) {
        if (runScopeHandlers(this.view, event, "search-panel")) {
            event.preventDefault();
            return;
        }

        if (event.altKey && !event.ctrlKey && !event.metaKey) {
            const key = { KeyC: "caseSensitive", KeyW: "wholeWord", KeyR: "regexp" }[event.code];
            if (key) {
                event.preventDefault();
                this.toggleOption(key);
                return;
            }
        }

        if (event.key !== "Enter") return;
        event.preventDefault();

        if (event.target === this.findInput) {
            this.commit();
            if (event.altKey) {
                selectMatches(this.view);
                this.view.focus();
            } else if (event.shiftKey) {
                findPreviousMatch(this.view);
            } else {
                findNextMatch(this.view);
            }
        } else if (event.target === this.replaceInput) {
            this.replace((event.ctrlKey || event.metaKey) && event.altKey);
        }
    }
}

export const findNextMatch = (view: EditorView): boolean => {
    const widget = widgets.get(view);
    return (widget && widget.step(1)) || findNext(view);
};

export const findPreviousMatch = (view: EditorView): boolean => {
    const widget = widgets.get(view);
    return (widget && widget.step(-1)) || findPrevious(view);
};

export const openFind = (view: EditorView): boolean => {
    openSearchPanel(view);
    const widget = widgets.get(view);
    if (widget) widget.focusFind();
    return true;
};

export const openFindReplace = (view: EditorView): boolean => {
    openSearchPanel(view);
    const widget = widgets.get(view);
    if (widget) widget.showReplace(true, !!getSearchQuery(view.state).search);
    return true;
};

function toggleWhenOpen(key: string) {
    return (view: EditorView): boolean => {
        const widget = widgets.get(view);
        if (!widget || !searchPanelOpen(view.state)) return false;
        widget.toggleOption(key);
        return true;
    };
}

const findKeymap: KeyBinding[] = [
    { key: "Mod-f", run: openFind, scope: "editor search-panel" },
    { key: "Mod-h", mac: "Mod-Alt-f", run: openFindReplace, scope: "editor search-panel" },
    { key: "F3", run: findNextMatch, shift: findPreviousMatch, scope: "editor search-panel", preventDefault: true },
    { key: "Mod-g", run: findNextMatch, shift: findPreviousMatch, scope: "editor search-panel", preventDefault: true },
    { key: "Escape", run: closeSearchPanel, scope: "editor search-panel" },
    { key: "Mod-Shift-l", run: selectSelectionMatches },
    { key: "Alt-c", run: toggleWhenOpen("caseSensitive") },
    { key: "Alt-w", run: toggleWhenOpen("wholeWord") },
    { key: "Alt-r", run: toggleWhenOpen("regexp") }
];

export function findWidget(): Extension {
    return [
        search({
            top: true,
            literal: true,
            createPanel: (view) => new FindWidget(view),
            scrollToMatch: (range, view) => revealEffect(view, range.from, range.to)
        }),
        keymap.of(findKeymap)
    ];
}
