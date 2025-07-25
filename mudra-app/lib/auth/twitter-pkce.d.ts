export function generateCodeVerifier(): string;
export function generateCodeChallenge(codeVerifier: string): string;
export function getTwitterAuthUrl(codeChallenge: string): string;
export function exchangeCodeForToken(code: string, codeVerifier: string): Promise<any>;
