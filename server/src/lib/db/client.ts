// ===========================================
// GNS NODE - DATABASE CLIENT
// Supabase PostgreSQL wrapper
// ===========================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ===========================================
// Supabase Client Singleton
// ===========================================

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
    if (!supabase) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_KEY;

        if (!url || !key) {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
        }

        supabase = createClient(url, key, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
    }

    return supabase;
}

// ===========================================
// HELPER: Generate IDs
// ===========================================

export function generateId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
}
