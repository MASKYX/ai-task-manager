import { query, setText } from "./dom.ts";

type ConfirmOptions = {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
};

let resolver: ((confirmed: boolean) => void) | null = null;
let initialized = false;

function finish(confirmed: boolean): void {
    const dialog = query<HTMLDialogElement>("#confirm-dialog");
    if (!dialog.open) return;
    dialog.close(confirmed ? "confirm" : "cancel");
}

function setup(): void {
    if (initialized) return;
    initialized = true;

    const dialog = query<HTMLDialogElement>("#confirm-dialog");
    const confirmButton = query<HTMLButtonElement>("#confirm-ok");
    const cancelButton = query<HTMLButtonElement>("#confirm-cancel");

    confirmButton.addEventListener("click", () => finish(true));
    cancelButton.addEventListener("click", () => finish(false));
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) finish(false);
    });
    dialog.addEventListener("close", () => {
        const confirmed = dialog.returnValue === "confirm";
        resolver?.(confirmed);
        resolver = null;
    });
}

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
    setup();

    const dialog = query<HTMLDialogElement>("#confirm-dialog");
    const confirmButton = query<HTMLButtonElement>("#confirm-ok");

    setText(query("#confirm-title"), options.title);
    setText(query("#confirm-message"), options.message);
    setText(confirmButton, options.confirmLabel ?? "Confirm");
    confirmButton.classList.toggle("btn--danger", options.danger !== false);
    confirmButton.classList.toggle("btn--primary", options.danger === false);
    dialog.returnValue = "cancel";

    dialog.showModal();
    return new Promise((resolve) => {
        resolver = resolve;
    });
}
