// ===========================================
// GNS NODE - MAIN ENTRY POINT (UPGRADED)
// Identity Resolution & Relay Network
// ===========================================

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';

// API Routes
import recordsRouter from './api/records';
import aliasesRouter from './api/aliases';
import epochsRouter from './api/epochs';
import messagesRouter, { setupWebSocket } from './api/messages';
import callsRouter from './api/calls';
import syncRouter from './api/sync';
import handlesRouter from './api/handles';
import identitiesRouter from './api/identities';
import paymentsRouter from './api/payments';
import geoauthRouter from './api/geoauth';
import authSessionsRouter from './api/auth_sessions';
import webRouter from './api/web';
import dixRouter from './api/dix';
import emailRouter, { initializeEmailGateway } from './api/email';
import gsiteRouter from './api/gsite';
import orgRouter from './api/org';
import orgMembersRouter from './api/org-members';
import cmsRouter from './api/cms';
import breadcrumbsRouter from './api/breadcrumbs';

// 🆕 API v1 Routes (New Protocol APIs)
import verifyRouter from './api/verify';
import oauthRouter from './api/oauth';
import paymentHubRoutes from './api/payment-hub';
import webhooksRouter from './api/webhooks';
import paymentsV2Router from './api/payments-v2';

// Services
import echoBot from './services/echo_bot';

// Database
import { healthCheck } from './lib/db';

// ===========================================
// Configuration
// ===========================================

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ID = process.env.NODE_ID || 'gns-node-1';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ===========================================
// Express App Setup
// ===========================================

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['*'];
app.use(cors({
  origin: corsOrigins.includes('*') ? '*' : corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-GNS-Identity',
    'X-GNS-PublicKey',
    'X-GNS-Signature',
    'X-GNS-Timestamp',
    'X-GNS-Session',
    'X-Webhook-Secret',
  ],
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ===========================================
// Health Check
// ===========================================

app.get('/', async (req: Request, res: Response) => {
  const dbHealthy = await healthCheck();

  res.json({
    name: 'GNS Node',
    version: '1.4.0',  // 🆕 Version bump for v1 API
    node_id: NODE_ID,
    status: dbHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    features: {
      websocket: true,
      envelope_messaging: true,
      email_gateway: true,  // 📧 NEW
      gsite_validation: true,  // 🐆 NEW
      proof_of_humanity: true,  // 🆕 NEW
      oauth_oidc: true,         // 🆕 NEW
      webhooks: true,           // 🆕 NEW
      payment_requests: true,   // 🆕 NEW
      echo_bot: echoBot.getEchoBotStatus().running,
    },
    endpoints: {
      records: '/records/:pk',
      aliases: '/aliases/:handle',
      handles: '/handles/:handle',
      identities: '/identities/:publicKey',
      epochs: '/epochs/:pk',
      messages: '/messages',
      messages_ws: '/ws',
      sync: '/sync',
      email: '/email/inbound',  // 📧 NEW
      gsite: '/gsite/:identifier',  // 🐆 NEW
      verify: '/v1/verify/:identifier',     // 🆕 NEW
      oauth: '/v1/oauth/authorize',         // 🆕 NEW
      webhooks: '/v1/webhooks',             // 🆕 NEW
      payment_requests: '/v1/payments',     // 🆕 NEW
    },
    system_handles: {
      echo: `@echo (${echoBot.getEchoPublicKey().substring(0, 16)}...)`,
    },
  });
});

app.get('/health', async (req: Request, res: Response) => {
  const dbHealthy = await healthCheck();

  if (!dbHealthy) {
    return res.status(503).json({
      status: 'unhealthy',
      database: false,
    });
  }

  res.json({
    status: 'healthy',
    database: true,
    node_id: NODE_ID,
    websocket: true,
    bots: {
      echo: echoBot.getEchoBotStatus(),
    },
  });
});

// ===========================================
// API Routes
// ===========================================

app.use('/records', recordsRouter);
app.use('/aliases', aliasesRouter);
app.use('/epochs', epochsRouter);
app.use('/messages', messagesRouter);
app.use('/calls', callsRouter);
app.use('/sync', syncRouter);
app.use('/handles', handlesRouter);
app.use('/identities', identitiesRouter);
app.use('/payments', paymentsRouter);
app.use('/auth/sessions', authSessionsRouter);
app.use('/auth', geoauthRouter);
app.use('/web', webRouter);
app.use('/search', webRouter);
app.use('/stats', webRouter);
app.use('/web/dix', dixRouter);
app.use('/email', emailRouter);
app.use('/gsite', gsiteRouter);
app.use('/org', orgRouter);
app.use('/org', orgMembersRouter);
app.use('/cms', cmsRouter);
app.use('/breadcrumbs', breadcrumbsRouter);
app.use('/api', paymentHubRoutes);

// ===========================================
// 🆕 API v1 - New Protocol APIs
// ===========================================
app.use('/v1/verify', verifyRouter);      // Proof of Humanity
app.use('/v1/oauth', oauthRouter);        // OAuth 2.0 / OIDC
app.use('/v1/webhooks', webhooksRouter);  // Event subscriptions
app.use('/v1/payments', paymentsV2Router); // Payment requests (Stripe-like)

// OIDC Discovery (must be at root level)
app.get('/.well-known/openid-configuration', (req, res) => {
  const baseUrl = process.env.API_BASE_URL || `https://${req.headers.host}`;
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/v1/oauth/authorize`,
    token_endpoint: `${baseUrl}/v1/oauth/token`,
    userinfo_endpoint: `${baseUrl}/v1/oauth/userinfo`,
    jwks_uri: `${baseUrl}/v1/oauth/jwks`,
    scopes_supported: ['openid', 'identity:read', 'identity:verify', 'messages:read', 'messages:write', 'payments:read', 'payments:write'],
    response_types_supported: ['code', 'token'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
  });
});

// ===========================================
// Auth Challenge Endpoint
// ===========================================

import { generateNonce } from './lib/crypto';

const challenges = new Map<string, { nonce: string; timestamp: string; expires: number }>();

app.get('/auth/challenge', (req: Request, res: Response) => {
  const pk = req.query.pk as string;

  if (!pk || pk.length !== 64) {
    return res.status(400).json({
      success: false,
      error: 'Invalid public key',
    });
  }

  const nonce = generateNonce();
  const timestamp = new Date().toISOString();
  const expires = Date.now() + 5 * 60 * 1000;

  challenges.set(pk.toLowerCase(), { nonce, timestamp, expires });

  // Cleanup old challenges
  for (const [key, value] of challenges.entries()) {
    if (value.expires < Date.now()) {
      challenges.delete(key);
    }
  }

  res.json({
    success: true,
    data: {
      nonce,
      timestamp,
      expires_at: new Date(expires).toISOString(),
    },
  });
});

// ===========================================
// 404 Handler
// ===========================================

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    path: req.path,
  });
});

// ===========================================
// Error Handler
// ===========================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ===========================================
// Start Server (WITH WEBSOCKET + @echo BOT + EMAIL)
// ===========================================

async function start() {
  // Verify database connection
  const dbHealthy = await healthCheck();

  if (!dbHealthy) {
    console.error('❌ Database connection failed!');
    console.error('Check SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
    process.exit(1);
  }

  console.log('✅ Database connected');

  // ===========================================
  // CREATE HTTP SERVER (for WebSocket support)
  // ===========================================
  const server = createServer(app);

  // ===========================================
  // SETUP WEBSOCKET
  // ===========================================
  setupWebSocket(server);
  console.log('✅ WebSocket server initialized');

  // ===========================================
  // INITIALIZE @echo BOT
  // ===========================================
  await echoBot.initializeEchoBot();

  // Register @echo handle in database (optional, non-fatal if fails)
  try {
    await echoBot.registerHandle();
  } catch (e) {
    console.warn('⚠️ Could not register @echo handle (non-fatal):', e);
  }

  // Start the bot (begins polling for messages)
  echoBot.startPolling();
  console.log('✅ @echo bot started');

  // ===========================================
  // INITIALIZE EMAIL GATEWAY  📧 NEW
  // ===========================================
  try {
    await initializeEmailGateway();
    console.log('✅ Email gateway initialized');
  } catch (e) {
    console.warn('⚠️ Email gateway initialization failed (non-fatal):', e);
  }

  // ===========================================
  // START LISTENING
  // ===========================================
  server.listen(Number(PORT), HOST, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🌐 GNS NODE v1.3                                        ║
║   Identity through Presence — Now with Email Gateway      ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   Node ID:    ${NODE_ID.padEnd(40)}║
║   HTTP:       http://${HOST}:${PORT}                           ║
║   WebSocket:  ws://${HOST}:${PORT}/ws                          ║
║   Environment: ${NODE_ENV.padEnd(39)}║
║                                                           ║
║   Features:                                               ║
║   ✅ Identity Records                                     ║
║   ✅ Handle Registration                                  ║
║   ✅ Epoch Publishing                                     ║
║   ✅ Encrypted Messaging                                  ║
║   ✅ WebSocket Real-time                                  ║
║   ✅ Typing Indicators                                    ║
║   ✅ Presence Status                                      ║
║   ✅ Email Gateway (9lobe.com)                            ║
║                                                           ║
║   System Handles:                                         ║
║   🤖 @echo - Test bot (echoes messages back)              ║
║   📧 @email-gateway - Inbound email bridge                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  echoBot.stopPolling();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  echoBot.stopPolling();
  process.exit(0);
});

// Start the server
start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
