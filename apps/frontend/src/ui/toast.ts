import { create } from "./dom.ts";
import { icon, type IconName } from "./icons.ts";

type ToastVariant = "success" | "error" | "info";

const VARIANT_ICONS: Record<ToastVariant, IconName> = {
    success: "check",
    error: "alert",
    info: "info",
};

export function showToast(message: string, variant: ToastVariant = "info"): void {
    const region = document.getElementById("toast-region");
    if (!region) return;

    const toast = create("div", `toast toast--${variant}`);
    toast.setAttribute("role", variant === "error" ? "alert" : "status");

    const iconWrap = create("span", "toast-icon");
    iconWrap.appendChild(icon(VARIANT_ICONS[variant], 18));
    const text = create("p", "toast-text", message);
    const close = create("button", "toast-close");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss notification");
    close.appendChild(icon("x", 16));

    toast.append(iconWrap, text, close);
    region.appendChild(toast);

    while (region.children.length > 3) region.firstElementChild?.remove();

    let timer = 0;
    const remove = (): void => {
        window.clearTimeout(timer);
        toast.classList.add("toast--leaving");
        window.setTimeout(() => toast.remove(), 180);
    };

    timer = window.setTimeout(remove, variant === "error" ? 7000 : 4500);
    close.addEventListener("click", remove);
    toast.addEventListener("mouseenter", () => window.clearTimeout(timer));
    toast.addEventListener("mouseleave", () => {
        timer = window.setTimeout(remove, variant === "error" ? 4000 : 2500);
    });
}
