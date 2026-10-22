import { UserManager, type User } from "oidc-client-ts";
import {
    endDemoSession,
    getDemoSession,
    startDemoSession as requestDemoStart,
} from "./api.ts";
import { appUrl, getConfig } from "./config.ts";
import { clearLegacyChatData, clearStoredData, type StorageScope } from "./storage.ts";

export type AppSession =
    | { kind: "cognito"; user: User }
    | { kind: "demo" };

let userManager: UserManager | null = null;
let renewal: Promise<boolean> | null = null;
let redirecting = false;

export function getManager(): UserManager {
    if (userManager) return userManager;

    const config = getConfig();
    userManager = new UserManager({
        authority: config.cognitoAuthority,
        client_id: config.cognitoClientId,
        redirect_uri: appUrl("/callback.html"),
        post_logout_redirect_uri: appUrl("/sign-in.html"),
        response_type: "code",
        // Keep these aligned with the scopes enabled on the Cognito app client.
        scope: "openid email phone",
    });
    return userManager;
}

export function getUserKey(user: User): string | null {
    const key = user.profile.sub || user.profile.email;
    return typeof key === "string" && key.trim() ? key : null;
}

export function getUserLabel(user: User): string {
    const email = user.profile.email;
    if (typeof email === "string" && email.trim()) return email;
    const name = user.profile.name;
    if (typeof name === "string" && name.trim()) return name;
    return "Account";
}

export function getUserInitial(user: User): string {
    return getUserLabel(user).trim().charAt(0).toUpperCase() || "A";
}

export function storageScopeFor(session: AppSession): StorageScope {
    return session.kind === "demo"
        ? { kind: "demo" }
        : { kind: "cognito", userKey: getUserKey(session.user) };
}

export function renewAccessToken(): Promise<boolean> {
    if (renewal) return renewal;

    renewal = (async () => {
        const manager = getManager();
        const user = await manager.getUser().catch(() => null);
        if (!user) return false;

        try {
            const renewed = await manager.signinSilent();
            return Boolean(renewed && !renewed.expired);
        } catch {
            return false;
        }
    })().finally(() => {
        renewal = null;
    });

    return renewal;
}

export async function getValidUser(): Promise<User | null> {
    const manager = getManager();
    const user = await manager.getUser().catch(() => null);
    if (user && !user.expired) return user;
    if (!user) return null;
    if (!await renewAccessToken()) return null;

    const renewed = await manager.getUser().catch(() => null);
    return renewed && !renewed.expired ? renewed : null;
}

export async function getAccessToken(): Promise<string | null> {
    const user = await getValidUser();
    return user?.access_token ?? null;
}

export async function loadSession(): Promise<AppSession | null> {
    const manager = getManager();
    const storedUser = await manager.getUser().catch(() => null);

    if (storedUser) {
        if (!storedUser.expired) return { kind: "cognito", user: storedUser };
        if (!await renewAccessToken()) return null;

        const renewed = await manager.getUser().catch(() => null);
        return renewed && !renewed.expired ? { kind: "cognito", user: renewed } : null;
    }

    return await getDemoSession() ? { kind: "demo" } : null;
}

export async function signInWithCognito(): Promise<void> {
    const manager = getManager();
    await endDemoSession().catch(() => undefined);
    await manager.removeUser().catch(() => undefined);
    await manager.clearStaleState();
    await manager.signinRedirect();
}

export async function startDemo(): Promise<void> {
    const manager = getManager();
    await manager.removeUser().catch(() => undefined);
    await manager.clearStaleState();
    await requestDemoStart();
    clearStoredData({ kind: "demo" });
}

export async function completeSignIn(): Promise<User> {
    const manager = getManager();
    const user = await manager.signinRedirectCallback();
    await endDemoSession().catch(() => undefined);
    return user;
}

export async function signOut(session: AppSession): Promise<void> {
    const manager = getManager();

    if (session.kind === "demo") {
        await endDemoSession().catch(() => undefined);
        clearStoredData({ kind: "demo" });
        window.location.replace(appUrl("/sign-in.html"));
        return;
    }

    const userKey = getUserKey(session.user);
    clearStoredData({ kind: "cognito", userKey });
    clearLegacyChatData(userKey);

    await manager.removeUser().catch(() => undefined);
    await manager.clearStaleState();
    await endDemoSession().catch(() => undefined);

    const config = getConfig();
    const logoutUrl = new URL("/logout", config.cognitoDomain);
    logoutUrl.searchParams.set("client_id", config.cognitoClientId);
    logoutUrl.searchParams.set("logout_uri", appUrl("/sign-in.html"));
    window.location.replace(logoutUrl.toString());
}

export function redirectToSignIn(reason: "session" | "expired" = "session"): void {
    if (redirecting) return;
    redirecting = true;

    const url = new URL("/sign-in.html", window.location.origin);
    url.searchParams.set("reason", reason);
    window.location.replace(url.toString());
}
