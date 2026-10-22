import "./styles.css";
import { completeSignIn } from "./auth.ts";
import { query } from "./ui/dom.ts";
import { hydrateIcons } from "./ui/icons.ts";

async function finishSignIn(): Promise<void> {
    const loading = query("#callback-loading");
    const error = query("#callback-error");
    const errorText = query("#callback-error-message");

    try {
        await completeSignIn();
        window.location.replace("/index.html");
    } catch (cause) {
        loading.hidden = true;
        error.hidden = false;
        errorText.textContent = "The sign-in link may have expired or is no longer valid. Please try again.";
        console.error("Sign-in callback failed", cause);
    }
}

hydrateIcons();
void finishSignIn();
