import "./styles.css";
import { errorMessage, getDemoSession } from "./api.ts";
import {
    getValidUser,
    signInWithCognito,
    startDemo,
} from "./auth.ts";
import { announce, query, setBusy, setText } from "./ui/dom.ts";
import { hydrateIcons } from "./ui/icons.ts";

const signInButton = query<HTMLButtonElement>("#sign-in");
const demoButton = query<HTMLButtonElement>("#try-demo");
const continueDemoButton = query<HTMLButtonElement>("#continue-demo");
const errorBox = query("#auth-error");
const errorText = query("#auth-error-text");
const notice = query("#auth-notice");

let busy = false;

function setError(message: string | null): void {
    errorBox.hidden = !message;
    errorText.textContent = message ?? "";
    if (message) announce(message);
}

function setWorking(working: boolean, activeButton: HTMLButtonElement | null = null): void {
    busy = working;
    for (const button of [signInButton, demoButton, continueDemoButton]) {
        setBusy(button, working && button === activeButton);
        button.disabled = working;
    }
}

function showNoticeFromQuery(): void {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "expired") {
        notice.hidden = false;
        setText(notice, "Session expired. Please sign in again.");
    }
}

async function checkExistingSession(): Promise<void> {
    setWorking(true);
    try {
        const user = await getValidUser();
        if (user) {
            window.location.replace("/index.html");
            return;
        }

        if (await getDemoSession()) {
            demoButton.hidden = true;
            continueDemoButton.hidden = false;
        }
    } catch (error) {
        setError(errorMessage(error));
    } finally {
        setWorking(false);
    }
}

signInButton.addEventListener("click", async () => {
    if (busy) return;
    setError(null);
    setWorking(true, signInButton);
    try {
        await signInWithCognito();
    } catch (error) {
        setError(errorMessage(error));
        setWorking(false);
    }
});

demoButton.addEventListener("click", async () => {
    if (busy) return;
    setError(null);
    setWorking(true, demoButton);
    try {
        await startDemo();
        window.location.replace("/index.html");
    } catch (error) {
        setError(errorMessage(error));
        setWorking(false);
    }
});

continueDemoButton.addEventListener("click", () => {
    if (busy) return;
    setWorking(true, continueDemoButton);
    window.location.replace("/index.html");
});

hydrateIcons();
showNoticeFromQuery();
void checkExistingSession();
