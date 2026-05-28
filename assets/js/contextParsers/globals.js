export function renderSeparator() {
    const sep = document.createElement("span");
    sep.classList.add("material-symbols-rounded", "separator")
    sep.textContent = "keyboard_arrow_right";
    
    return sep
}