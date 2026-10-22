export type AppConfig = {
    apiBaseUrl: string;
    cognitoAuthority: string;
    cognitoClientId: string;
    cognitoDomain: string;
};

export class ConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ConfigError";
    }
}

let cachedConfig: AppConfig | null = null;

function required(name: keyof ImportMetaEnv, label: string): string {
    const value = import.meta.env[name];
    if (typeof value !== "string" || !value.trim()) {
        throw new ConfigError(`The app is missing its ${label} configuration.`);
    }
    return value.trim();
}

export function getConfig(): AppConfig {
    if (cachedConfig) return cachedConfig;

    cachedConfig = {
        apiBaseUrl: required("VITE_API_BASE", "API URL").replace(/\/+$/, ""),
        cognitoAuthority: required("VITE_COGNITO_AUTHORITY", "sign-in service URL").replace(/\/+$/, ""),
        cognitoClientId: required("VITE_COGNITO_CLIENT_ID", "Cognito client ID"),
        cognitoDomain: required("VITE_COGNITO_DOMAIN", "Cognito domain").replace(/\/+$/, ""),
    };

    return cachedConfig;
}

export function apiUrl(path: string): string {
    const base = getConfig().apiBaseUrl;
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function appUrl(path: string): string {
    return new URL(path, window.location.origin).toString();
}
