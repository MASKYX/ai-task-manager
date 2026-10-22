const SVG_NS = "http://www.w3.org/2000/svg";

const ICON_PATHS = {
    calendar: [
        "M8 2v4",
        "M16 2v4",
        "M3 10h18",
        "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    ],
    list: [
        "M8 6h13",
        "M8 12h13",
        "M8 18h13",
        "M3 6h.01",
        "M3 12h.01",
        "M3 18h.01",
    ],
    sparkles: [
        "m12 3-1.9 5.8a2 2 0 0 1-1.2 1.2L3 12l5.9 1.9a2 2 0 0 1 1.2 1.2L12 21l1.9-5.9a2 2 0 0 1 1.2-1.2L21 12l-5.9-1.9a2 2 0 0 1-1.2-1.2L12 3Z",
        "M5 3v4",
        "M3 5h4",
        "M19 17v4",
        "M17 19h4",
    ],
    plus: ["M12 5v14", "M5 12h14"],
    "chevron-left": ["m15 18-6-6 6-6"],
    "chevron-right": ["m9 18 6-6-6-6"],
    "chevron-down": ["m6 9 6 6 6-6"],
    x: ["M18 6 6 18", "M6 6l12 12"],
    trash: [
        "M3 6h18",
        "M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2",
        "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
        "M10 11v6",
        "M14 11v6",
    ],
    clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"],
    check: ["M20 6 9 17l-5-5"],
    alert: [
        "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
        "M12 9v4",
        "M12 17h.01",
    ],
    info: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 16v-4", "M12 8h.01"],
    send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
    "log-out": [
        "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",
        "M16 17l5-5-5-5",
        "M21 12H9",
    ],
    user: [
        "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2",
        "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    ],
    refresh: [
        "M3 12a9 9 0 0 1 15-6.7L21 8",
        "M21 3v5h-5",
        "M21 12a9 9 0 0 1-15 6.7L3 16",
        "M3 21v-5h5",
    ],
    sliders: [
        "M4 21v-7",
        "M4 10V3",
        "M12 21v-9",
        "M12 8V3",
        "M20 21v-5",
        "M20 12V3",
        "M1 14h6",
        "M9 8h6",
        "M17 16h6",
    ],
} satisfies Record<string, string[]>;

export type IconName = keyof typeof ICON_PATHS;

export function icon(name: IconName, size = 18, className = "icon"): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    if (className) svg.setAttribute("class", className);

    for (const pathData of ICON_PATHS[name]) {
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", pathData);
        svg.appendChild(path);
    }

    return svg;
}

export function hydrateIcons(root: ParentNode = document): void {
    for (const placeholder of root.querySelectorAll<HTMLElement>("[data-icon]")) {
        const name = placeholder.dataset.icon as IconName;
        if (!(name in ICON_PATHS)) continue;
        placeholder.replaceChildren(icon(name));
        placeholder.removeAttribute("data-icon");
        placeholder.setAttribute("aria-hidden", "true");
    }
}
