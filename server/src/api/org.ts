// ===========================================
// GNS ORGANIZATION REGISTRATION API (FIXED)
// ===========================================
// Location: src/api/org.ts
// Uses raw Supabase queries (no extra db functions needed)
// ===========================================

import { Router, Request, Response } from 'express';
import * as dns from 'dns';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import * as db from '../lib/db';

const router = Router();
const resolveTxt = promisify(dns.resolveTxt);

// Reserved namespaces
const RESERVED = new Set([
  'gns', 'gcrumbs', 'globecrumbs', 'admin', 'support', 'help',
  'root', 'system', 'api', 'www', 'mail', 'email', 'ftp',
  'test', 'demo', 'staging', 'dev', 'prod', 'official',
  'security', 'abuse', 'postmaster', 'webmaster',
]);

// Protected brands
const PROTECTED = new Set([
  'google', 'facebook', 'meta', 'apple', 'microsoft', 'amazon',
  'twitter', 'x', 'instagram', 'tiktok', 'youtube', 'linkedin',
  'netflix', 'spotify', 'uber', 'airbnb', 'stripe', 'anthropic',
]);

// ===========================================
// HELPERS
// ===========================================

function generateVerificationCode(): string {
  return randomBytes(16).toString('hex');
}

function extractDomain(website: string): string {
  let domain = website.toLowerCase().trim();
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.replace(/^www\./, '');
  domain = domain.split('/')[0];
  return domain;
}

async function checkDnsTxt(domain: string, code: string): Promise<boolean> {
  const domainsToCheck = [
    `_gns.${domain}`,
    domain,
    `gns-verify.${domain}`,
  ];
  
  for (const checkDomain of domainsToCheck) {
    try {
      const records = await resolveTxt(checkDomain);
      for (const record of records) {
        const text = record.join('');
        if (text.includes(code)) {
          console.log(`[DNS] âœ“ Found verification at ${checkDomain}`);
          return true;
        }
      }
    } catch {
      // Try next domain
    }
  }
  
  console.log(`[DNS] âœ— Code not found for ${domain}`);
  return false;
}

// ===========================================
// GET /org/check/:namespace
// ===========================================

router.get('/check/:namespace', async (req: Request, res: Response) => {
  try {
    const namespace = req.params.namespace?.toLowerCase().replace(/[^a-z0-9]/g, '');

    console.log(`ðŸ” Checking namespace: ${namespace}`);

    if (!namespace || namespace.length < 3) {
      return res.json({
        success: true,
        data: { available: false, reason: 'Namespace must be at least 3 characters' },
      });
    }

    if (!/^[a-z0-9]+$/.test(namespace)) {
      return res.json({
        success: true,
        data: { available: false, reason: 'Only lowercase letters and numbers allowed' },
      });
    }

    if (namespace.length > 30) {
      return res.json({
        success: true,
        data: { available: false, reason: 'Max 30 characters' },
      });
    }

    if (RESERVED.has(namespace)) {
      return res.json({
        success: true,
        data: { available: false, reason: 'This namespace is reserved' },
      });
    }

    const supabase = db.getSupabase();

    // Check aliases (existing handles)
    const { data: alias } = await supabase
      .from('aliases')
      .select('handle')
      .eq('handle', namespace)
      .single();

    if (alias) {
      return res.json({
        success: true,
        data: { available: false, reason: 'Already registered as handle' },
      });
    }

    // Check active namespaces
    const { data: existing } = await supabase
      .from('namespaces')
      .select('namespace')
      .eq('namespace', namespace)
      .single();

    if (existing) {
      return res.json({
        success: true,
        data: { available: false, reason: 'Already taken' },
      });
    }

    // Check pending registrations
    const { data: pending } = await supabase
      .from('namespace_registrations')
      .select('namespace, status')
      .eq('namespace', namespace)
      .neq('status', 'suspended')
      .single();

    if (pending) {
      return res.json({
        success: true,
        data: { available: false, reason: pending.status === 'verified' ? 'Already registered' : 'Registration pending' },
      });
    }

    const isProtected = PROTECTED.has(namespace);

    res.json({
      success: true,
      data: {
        available: true,
        namespace,
        protected: isProtected,
        requiresTier: isProtected ? 'enterprise' : null,
        message: isProtected ? 'Protected brand - Enterprise tier required' : `${namespace}@ is available!`,
      },
    });

  } catch (err) {
    console.error('âŒ /org/check error:', err);
    res.status(500).json({ success: false, error: 'Check failed' });
  }
});

// ===========================================
// POST /org/register
// ===========================================

router.post('/register', async (req: Request, res: Response) => {
  try {
    const {
      namespace,
      organization_name,
      website,
      domain,
      email,
      description,
      tier = 'starter',
    } = req.body;

    console.log(`ðŸ“ Registering: ${namespace}`);

    if (!namespace || !organization_name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Required: namespace, organization_name, email',
      });
    }

    const cleanNamespace = namespace.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Need either domain or website
    let cleanDomain = domain;
    if (!cleanDomain && website) {
      cleanDomain = extractDomain(website);
    }
    
    if (!cleanDomain) {
      return res.status(400).json({
        success: false,
        error: 'Required: domain or website',
      });
    }

    if (!/^[a-z0-9]{3,30}$/.test(cleanNamespace)) {
      return res.status(400).json({ success: false, error: 'Invalid namespace format (3-30 lowercase alphanumeric)' });
    }

    if (RESERVED.has(cleanNamespace)) {
      return res.status(400).json({ success: false, error: 'Namespace reserved' });
    }

    if (PROTECTED.has(cleanNamespace) && tier !== 'enterprise') {
      return res.status(400).json({ success: false, error: 'Protected brand - Enterprise tier required' });
    }

    const supabase = db.getSupabase();

    // Check if already taken
    const { data: existing } = await supabase
      .from('namespaces')
      .select('namespace')
      .eq('namespace', cleanNamespace)
      .single();

    if (existing) {
      return res.status(400).json({ success: false, error: 'Namespace already taken' });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();

    // Upsert registration
    const { data, error } = await supabase
      .from('namespace_registrations')
      .upsert({
        namespace: cleanNamespace,
        organization_name,
        website: website || `https://${cleanDomain}`,
        domain: cleanDomain,
        email,
        description: description || null,
        tier,
        verification_code: verificationCode,
        status: 'pending',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'namespace' })
      .select()
      .single();

    if (error) {
      console.error('âŒ Supabase error:', error);
      return res.status(500).json({ success: false, error: 'Registration failed' });
    }

    console.log(`âœ… Registration created: ${cleanNamespace}@`);

    res.status(201).json({
      success: true,
      data: {
        registration_id: data.id,
        namespace: cleanNamespace,
        domain: cleanDomain,
        verification_code: verificationCode,
        txt_record: `gns-verify=${verificationCode}`,
        instructions: {
          type: 'TXT',
          host: `_gns.${cleanDomain}`,
          value: `gns-verify=${verificationCode}`,
          ttl: 3600,
        },
      },
      message: 'Add the DNS TXT record to verify domain ownership.',
    });

  } catch (err) {
    console.error('âŒ /org/register error:', err);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// ===========================================
// POST /org/verify
// ===========================================

router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { registration_id, domain, verification_code } = req.body;

    console.log(`ðŸ” Verifying DNS: ${domain || registration_id}`);

    if (!registration_id && !domain) {
      return res.status(400).json({ success: false, error: 'Need registration_id or domain' });
    }

    const supabase = db.getSupabase();

    // Get registration
    let query = supabase.from('namespace_registrations').select('*');
    
    if (registration_id) {
      query = query.eq('id', registration_id);
    } else {
      query = query.eq('domain', domain);
    }
    
    const { data: reg, error } = await query.single();

    if (error || !reg) {
      return res.status(404).json({ success: false, error: 'Registration not found' });
    }

    if (reg.status === 'verified' || reg.status === 'active') {
      return res.json({
        success: true,
        data: { verified: true, namespace: reg.namespace, message: 'Already verified' },
      });
    }

    // Check DNS
    const verified = await checkDnsTxt(reg.domain, reg.verification_code);

    if (!verified) {
      return res.json({
        success: true,
        data: {
          verified: false,
          message: 'DNS record not found. Wait for propagation (up to 48h).',
          expected: {
            host: `_gns.${reg.domain}`,
            type: 'TXT',
            value: `gns-verify=${reg.verification_code}`,
          },
        },
      });
    }

    // Mark verified
    await supabase
      .from('namespace_registrations')
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
        status: reg.tier === 'starter' ? 'active' : 'verified',
      })
      .eq('id', reg.id);

    console.log(`âœ… DNS verified: ${reg.namespace}@`);

    res.json({
      success: true,
      data: {
        verified: true,
        namespace: `${reg.namespace}@`,
        domain: reg.domain,
        message: reg.tier === 'starter'
          ? 'Namespace verified! Download the app to complete setup.'
          : 'DNS verified! Complete payment to activate.',
        next_step: reg.tier === 'starter' ? 'download_app' : 'payment',
      },
    });

  } catch (err) {
    console.error('âŒ /org/verify error:', err);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

// ===========================================
// GET /org/status/:id
// ===========================================

router.get('/status/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = db.getSupabase();

    const { data: reg } = await supabase
      .from('namespace_registrations')
      .select('*')
      .eq('id', id)
      .single();

    if (!reg) {
      return res.status(404).json({ success: false, error: 'Registration not found' });
    }

    res.json({
      success: true,
      data: {
        registration_id: reg.id,
        namespace: reg.namespace,
        organization_name: reg.organization_name,
        domain: reg.domain,
        status: reg.status,
        verification_code: reg.status === 'pending' ? reg.verification_code : undefined,
        created_at: reg.created_at,
        verified_at: reg.verified_at,
      },
    });

  } catch (err) {
    res.status(500).json({ success: false, error: 'Fetch failed' });
  }
});

// ===========================================
// GET /org/by-domain/:domain
// Reverse lookup: domain → GNS namespace
// Used by PANTHERA Legacy Web Fallback overlay
// ===========================================

router.get('/by-domain/:domain', async (req: Request, res: Response) => {
  try {
    let domain = req.params.domain?.toLowerCase().trim();

    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Domain parameter required',
      });
    }

    // Clean domain: strip protocol, www, path, port
    domain = domain.replace(/^https?:\/\//, '');
    domain = domain.replace(/^www\./, '');
    domain = domain.split('/')[0].split(':')[0];

    console.log(`🔍 Domain lookup: ${domain}`);

    const supabase = db.getSupabase();

    // Strategy 1: Check active namespaces table (fully verified + activated)
    const { data: activeNs } = await supabase
      .from('namespaces')
      .select('namespace, organization_name, domain, tier, verified, created_at')
      .eq('domain', domain)
      .eq('verified', true)
      .single();

    if (activeNs) {
      console.log(`✅ Domain ${domain} → active namespace: ${activeNs.namespace}@`);
      res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');

      return res.json({
        success: true,
        data: {
          namespace: activeNs.namespace,
          displayName: activeNs.organization_name,
          domain: activeNs.domain,
          tier: activeNs.tier,
          verified: true,
          status: 'active',
          createdAt: activeNs.created_at,
        },
      });
    }

    // Strategy 2: Check registrations table (DNS-verified but not yet activated)
    const { data: reg } = await supabase
      .from('namespace_registrations')
      .select('namespace, organization_name, domain, tier, status, verified_at, created_at')
      .eq('domain', domain)
      .in('status', ['verified', 'active'])
      .single();

    if (reg) {
      console.log(`🔶 Domain ${domain} → registered: ${reg.namespace}@ (${reg.status})`);
      res.set('Cache-Control', 'public, max-age=1800, s-maxage=3600');

      return res.json({
        success: true,
        data: {
          namespace: reg.namespace,
          displayName: reg.organization_name,
          domain: reg.domain,
          tier: reg.tier,
          verified: reg.status === 'verified' || reg.status === 'active',
          status: reg.status,
          verifiedAt: reg.verified_at,
          createdAt: reg.created_at,
        },
      });
    }

    // Strategy 3: Subdomain fallback (shop.example.com → example.com)
    const parts = domain.split('.');
    if (parts.length > 2) {
      const parentDomain = parts.slice(-2).join('.');

      const { data: parentNs } = await supabase
        .from('namespaces')
        .select('namespace, organization_name, domain, tier, verified, created_at')
        .eq('domain', parentDomain)
        .eq('verified', true)
        .single();

      if (parentNs) {
        console.log(`✅ Subdomain ${domain} → parent: ${parentNs.namespace}@`);
        res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');

        return res.json({
          success: true,
          data: {
            namespace: parentNs.namespace,
            displayName: parentNs.organization_name,
            domain: parentNs.domain,
            tier: parentNs.tier,
            verified: true,
            status: 'active',
            matchedVia: 'parent-domain',
            requestedDomain: domain,
            createdAt: parentNs.created_at,
          },
        });
      }
    }

    // Not found — cache negative result with shorter TTL
    console.log(`⬜ Domain ${domain} → no GNS namespace`);
    res.set('Cache-Control', 'public, max-age=600, s-maxage=1800');

    return res.status(404).json({
      success: false,
      error: 'No GNS namespace registered for this domain',
      domain,
    });

  } catch (err) {
    console.error('❌ /org/by-domain error:', err);
    res.status(500).json({ success: false, error: 'Domain lookup failed' });
  }
});

// ===========================================
// POST /org/by-domain-batch
// Batch domain lookup (PANTHERA pages with multiple links)
// ===========================================

router.post('/by-domain-batch', async (req: Request, res: Response) => {
  try {
    const { domains } = req.body;

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ success: false, error: 'Required: domains[] array' });
    }

    const cleanDomains = domains
      .slice(0, 50)
      .map((d: string) => d.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0])
      .filter((d: string) => d.length > 0);

    const supabase = db.getSupabase();

    const { data: matches } = await supabase
      .from('namespaces')
      .select('namespace, organization_name, domain, tier, verified')
      .in('domain', cleanDomains)
      .eq('verified', true);

    const result: Record<string, any> = {};
    for (const d of cleanDomains) {
      const match = matches?.find((m: any) => m.domain === d);
      result[d] = match ? {
        namespace: match.namespace,
        displayName: match.organization_name,
        tier: match.tier,
        verified: true,
      } : null;
    }

    res.set('Cache-Control', 'public, max-age=1800');

    res.json({
      success: true,
      data: result,
      count: Object.values(result).filter(Boolean).length,
      total: cleanDomains.length,
    });

  } catch (err) {
    console.error('❌ /org/by-domain-batch error:', err);
    res.status(500).json({ success: false, error: 'Batch lookup failed' });
  }
});

// ===========================================
// GET /org/:namespace
// ===========================================

router.get('/:namespace', async (req: Request, res: Response) => {
  try {
    const namespace = req.params.namespace.toLowerCase();
    const supabase = db.getSupabase();

    const { data } = await supabase
      .from('namespaces')
      .select('namespace, organization_name, domain, tier, member_count, verified, created_at')
      .eq('namespace', namespace)
      .single();

    if (!data) {
      return res.status(404).json({ success: false, error: 'Namespace not found' });
    }

    res.json({ success: true, data });

  } catch (err) {
    res.status(500).json({ success: false, error: 'Fetch failed' });
  }
});

// ===========================================
// POST /org/:namespace/activate
// ===========================================

router.post('/:namespace/activate', async (req: Request, res: Response) => {
  try {
    const namespace = req.params.namespace.toLowerCase();
    const { admin_pk, email } = req.body;

    if (!admin_pk || !email) {
      return res.status(400).json({ success: false, error: 'Missing admin_pk or email' });
    }

    const supabase = db.getSupabase();

    // Get registration
    const { data: reg } = await supabase
      .from('namespace_registrations')
      .select('*')
      .eq('namespace', namespace)
      .eq('email', email)
      .in('status', ['verified', 'active'])
      .single();

    if (!reg) {
      return res.status(404).json({ success: false, error: 'Registration not found or not verified' });
    }

    // Check if already activated
    const { data: existing } = await supabase
      .from('namespaces')
      .select('namespace')
      .eq('namespace', namespace)
      .single();

    if (existing) {
      return res.status(400).json({ success: false, error: 'Already activated' });
    }

    const tierLimits: Record<string, number> = { starter: 10, team: 100, enterprise: 10000 };

    // Create namespace
    const { data, error } = await supabase
      .from('namespaces')
      .insert({
        namespace,
        admin_pk,
        organization_name: reg.organization_name,
        domain: reg.domain,
        tier: reg.tier,
        member_limit: tierLimits[reg.tier] || 10,
        verified: true,
        verified_domain: reg.domain,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: 'Activation failed' });
    }

    // Update registration
    await supabase
      .from('namespace_registrations')
      .update({ status: 'active', admin_pk })
      .eq('id', reg.id);

    console.log(`âœ… Activated: ${namespace}@`);

    res.json({
      success: true,
      data: {
        namespace,
        organization_name: data.organization_name,
        tier: data.tier,
        member_limit: data.member_limit,
      },
    });

  } catch (err) {
    res.status(500).json({ success: false, error: 'Activation failed' });
  }
});

export default router;
