import { UserManager } from "oidc-client-ts";

const cognitoAuthConfig = {
    authority: import.meta.env.VITE_COGNITO_AUTHORITY,
    client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email phone",
};

// create a UserManager instance
export const userManager = new UserManager({
    ...cognitoAuthConfig,
});

export async function signOutRedirect() {
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string;
    const logoutUri = import.meta.env.VITE_POST_LOGOUT_REDIRECT_URI as string;
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN as string;
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
};