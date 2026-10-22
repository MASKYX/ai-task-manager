export function query<T extends Element = HTMLElement>(
    selector: string,
    root: ParentNode = document,
): T {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing element: ${selector}`);
    return element;
}

export function queryAll<T extends Element = HTMLElement>(
    selector: string,
    root: ParentNode = document,
): T[] {
    return Array.from(root.querySelectorAll<T>(selector));
}

export function create<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className = "",
    text?: string,
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

export function setText(element: Element, text: string): void {
    if (element.textContent !== text) element.textContent = text;
}

export function setHidden(element: HTMLElement, hidden: boolean): void {
    element.hidden = hidden;
}

export function setBusy(button: HTMLButtonElement, busy: boolean): void {
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
    button.classList.toggle("is-busy", busy);
}

export function setPressed(button: HTMLButtonElement, pressed: boolean): void {
    button.setAttribute("aria-pressed", String(pressed));
}

export function announce(message: string): void {
    const region = document.getElementById("sr-status");
    if (!region) return;

    region.textContent = "";
    window.setTimeout(() => {
        region.textContent = message;
    }, 30);
}

export function debounce<Args extends unknown[]>(
    callback: (...args: Args) => void,
    delay: number,
): (...args: Args) => void {
    let timer: number | undefined;

    return (...args: Args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => callback(...args), delay);
    };
}

export function isMobileLayout(): boolean {
    return window.matchMedia("(max-width: 767px)").matches;
}
