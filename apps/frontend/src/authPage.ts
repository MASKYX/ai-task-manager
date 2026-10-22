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
const demoBanner = query("#demo-banner");

let busy = false;

function setError(message: string | null): void {
    errorBox.hidden = !message;
    errorText.textContent = message ?? "";
    if (message) announce(message);
}

function setWorking(working: boolean): void {
    busy = working;
    setBusy(signInButton, working);
    setBusy(demoButton, working);
    signInButton.disabled = working;
    demoButton.disabled = working;
}

function showNoticeFromQuery(): void {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "expired") {
        notice.hidden = false;
        setText(notice, "Your session expired. Sign in again to continue where you left off.");
    } else if (reason === "session") {
        notice.hidden = false;
        setText(notice, "Sign in to open your calendar.");
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
            demoBanner.hidden = false;
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
    setWorking(true);
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
    setWorking(true);
    try {
        await startDemo();
        window.location.replace("/index.html");
    } catch (error) {
        setError(errorMessage(error));
        setWorking(false);
    }
});

continueDemoButton.addEventListener("click", () => {
    window.location.replace("/index.html");
});

hydrateIcons();
showNoticeFromQuery();
void checkExistingSession();
