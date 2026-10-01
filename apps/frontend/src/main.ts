import "./styles.css";
import { UserManager, type User } from "oidc-client-ts";

const apiBase = import.meta.env.VITE_API_BASE;
const callbackUri = new URL("/callback.html", window.location.origin).toString();
const postLogoutUri = new URL("/sign-in.html", window.location.origin).toString();

const cognitoAuthConfig = {
    authority: import.meta.env.VITE_COGNITO_AUTHORITY,
    client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
    redirect_uri: callbackUri,
    response_type: "code",
    scope: "openid email phone",
};

export const userManager = new UserManager({
    ...cognitoAuthConfig,
});

export type AppSession = { kind: "cognito"; user: User } | { kind: "demo" };

function clearUserData(user: User | null): void {
    const userKey = user?.profile.sub || user?.profile.email;

    try {
        if (userKey) {
            localStorage.removeItem(`taskai.bot.history.${userKey}`);
            localStorage.removeItem(`taskai.bot.preferences.${userKey}`);
            return;
        }

        for (let index = localStorage.length - 1; index >= 0; index--) {
            const key = localStorage.key(index);
            if (key?.startsWith("taskai.bot.")) localStorage.removeItem(key);
        }
    } catch {
        // Storage can be unavailable in restrictive browser modes.
    }
}

export async function getAppSession(): Promise<AppSession | null> {
    const user = await userManager.getUser().catch(() => null);
    if (user && !user.expired) return { kind: "cognito", user };
    try {
        const response = await fetch(`${apiBase}/api/demo/session`, { credentials: "include" });
        if (response.ok) return { kind: "demo" };
    } catch {
        // The entry page remains usable if the API is temporarily unavailable.
    }
    return null;
}

export async function startDemo(): Promise<void> {
    await userManager.removeUser();
    const response = await fetch(`${apiBase}/api/demo/start`, {
        method: "POST",
        credentials: "include",
    });
    if (!response.ok) throw new Error("Could not start the demo. Please try again.");
}

export async function signInRedirect(): Promise<void> {
    await userManager.clearStaleState();
    await userManager.signinRedirect();
}

export async function completeSignIn(): Promise<User> {
    return userManager.signinRedirectCallback();
}

export async function signOutRedirect(isDemo = false): Promise<void> {
    if (isDemo) {
        const response = await fetch(`${apiBase}/api/demo/end`, {
            method: "POST",
            credentials: "include",
        });
        if (!response.ok) throw new Error("Demo logout failed");
        await userManager.removeUser();
        window.location.replace("/sign-in.html");
        return;
    }

    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string;
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN as string;
    const user = await userManager.getUser().catch(() => null);

    clearUserData(user);
    await userManager.removeUser();
    await userManager.clearStaleState();

    const logoutUrl = new URL("/logout", cognitoDomain);
    logoutUrl.searchParams.set("client_id", clientId);
    logoutUrl.searchParams.set("logout_uri", postLogoutUri);
    window.location.replace(logoutUrl.toString());
}
