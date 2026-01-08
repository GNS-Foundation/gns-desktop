import { EmailApi } from './EmailApi';
export * from './EmailApi';
export interface GnsApi {
    email: EmailApi;
    getPublicKey(): Promise<string | null>;
    getCurrentHandle(): Promise<string | null>;
    isAuthenticated(): Promise<boolean>;
    events: {
        on(event: string, callback: (data: any) => void): () => void;
        once(event: string, callback: (data: any) => void): void;
    };
}
