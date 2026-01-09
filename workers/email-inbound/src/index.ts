// ============================================
// GNS Email Inbound Worker
// ============================================
// Cloudflare Email Worker
// Receives email for all GNS custom domains
// ============================================

export interface Env {
  DB: D1Database;
  GNS_GATEWAY_URL: string;
  GNS_API_KEY: string;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
}

interface EmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream;
  readonly rawSize: number;
  setReject(reason: string): void;
}

export default {
  async email(message: EmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`[EMAIL] Received: ${message.from} → ${message.to}`);

    try {
      const [username, domain] = message.to.toLowerCase().split('@');

      if (!username || !domain) {
        console.log(`[EMAIL] Invalid address: ${message.to}`);
        message.setReject('Invalid recipient address');
        return;
      }

      // Look up domain → namespace mapping
      const mapping = await env.DB.prepare(`
        SELECT dm.namespace, nm.public_key, nm.username
        FROM domain_mappings dm
        LEFT JOIN namespace_members nm 
          ON dm.namespace = nm.namespace 
          AND nm.username = ? 
          AND nm.status = 'active'
        WHERE dm.domain = ?
          AND dm.status = 'verified'
          AND dm.inbound_enabled = TRUE
      `).bind(username, domain).first<{
        namespace: string;
        public_key: string | null;
        username: string | null;
      }>();

      if (!mapping) {
        console.log(`[EMAIL] Domain not found: ${domain}`);
        message.setReject('Domain not registered with GNS');
        return;
      }

      if (!mapping.public_key) {
        // Try catch-all
        const catchAll = await env.DB.prepare(`
          SELECT nm.public_key, nm.username
          FROM domain_mappings dm
          JOIN namespace_members nm 
            ON dm.namespace = nm.namespace 
            AND nm.username = dm.catch_all_target
            AND nm.status = 'active'
          WHERE dm.domain = ?
            AND dm.catch_all_enabled = TRUE
        `).bind(domain).first<{ public_key: string; username: string }>();

        if (!catchAll) {
          console.log(`[EMAIL] User not found: ${username}@${domain}`);
          message.setReject('User not found');
          return;
        }

        mapping.public_key = catchAll.public_key;
        mapping.username = catchAll.username;
      }

      // Read email body
      const rawEmail = await streamToString(message.raw);

      // Parse headers
      const subject = message.headers.get('subject') || '(no subject)';
      const messageId = message.headers.get('message-id') || crypto.randomUUID();

      // Forward to GNS Gateway
      const response = await fetch(`${env.GNS_GATEWAY_URL}/email/inbound`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.GNS_API_KEY}`,
        },
        body: JSON.stringify({
          from: message.from,
          to: `${mapping.namespace}@${mapping.username}`,
          toPublicKey: mapping.public_key,
          toDomain: domain,
          subject,
          messageId,
          rawEmail,
          receivedAt: new Date().toISOString(),
          rawSize: message.rawSize,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[EMAIL] Gateway error: ${error}`);
        return;
      }

      console.log(`[EMAIL] Delivered: ${message.to} → ${mapping.namespace}@${mapping.username}`);

    } catch (error) {
      console.error(`[EMAIL] Error:`, error);
    }
  },
};

async function streamToString(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }

  return result;
}
