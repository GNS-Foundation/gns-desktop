// ===========================================
// GNS ORGANIZATION - MEMBER & INVITATION API
// ===========================================
// Location: server/src/api/org-members.ts
// Extends existing org.ts with member management
// ===========================================

import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import * as db from '../lib/db';

const router = Router();

// ===========================================
// HELPERS
// ===========================================

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

async function checkPermission(namespace: string, actorPk: string, permission: string): Promise<boolean> {
  const supabase = db.getSupabase();
  const { data: member } = await supabase
    .from('namespace_members')
    .select('role')
    .eq('namespace', namespace)
    .eq('public_key', actorPk)
    .eq('status', 'active')
    .single();

  if (!member) return false;

  const permissions: Record<string, string[]> = {
    invite_members: ['owner', 'admin'],
    remove_members: ['owner', 'admin'],
    change_roles: ['owner', 'admin'],
    manage_settings: ['owner', 'admin'],
    manage_billing: ['owner'],
    view_audit: ['owner', 'admin'],
  };

  return permissions[permission]?.includes(member.role) || false;
}

async function getDomain(namespace: string): Promise<string> {
  const supabase = db.getSupabase();
  const { data } = await supabase
    .from('domain_mappings')
    .select('domain')
    .eq('namespace', namespace)
    .eq('status', 'verified')
    .single();
  return data?.domain || `${namespace}.gcrumbs.com`;
}

// ===========================================
// GET /org/:namespace/members
// ===========================================

router.get('/:namespace/members', async (req: Request, res: Response) => {
  try {
    const { namespace } = req.params;
    const { q, role, status, limit = '50', cursor = '0' } = req.query;
    const actorPk = req.headers['x-gns-publickey'] as string;

    console.log(`📋 Listing members: ${namespace}@`);

    const supabase = db.getSupabase();

    // Build query
    let query = supabase
      .from('namespace_members')
      .select('*', { count: 'exact' })
      .eq('namespace', namespace);

    if (q) {
      query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
    }
    if (role) query = query.eq('role', role);
    if (status) query = query.eq('status', status);

    query = query
      .order('role', { ascending: true })
      .order('joined_at', { ascending: true })
      .range(parseInt(cursor as string), parseInt(cursor as string) + parseInt(limit as string) - 1);

    const { data: members, error, count } = await query;

    if (error) throw error;

    const domain = await getDomain(namespace);

    // Get namespace limits
    const { data: ns } = await supabase
      .from('namespaces')
      .select('member_limit, member_count')
      .eq('namespace', namespace)
      .single();

    res.json({
      success: true,
      data: {
        members: (members || []).map(m => ({
          username: m.username,
          handle: `${namespace}@${m.username}`,
          email: `${m.username}@${domain}`,
          publicKey: m.public_key,
          role: m.role,
          status: m.status,
          displayName: m.display_name,
          title: m.title,
          department: m.department,
          avatarUrl: m.avatar_url,
          joinedAt: m.joined_at,
        })),
        memberCount: ns?.member_count || count || 0,
        memberLimit: ns?.member_limit || 10,
        hasMore: (members?.length || 0) === parseInt(limit as string),
        nextCursor: members?.length === parseInt(limit as string)
          ? String(parseInt(cursor as string) + parseInt(limit as string))
          : undefined,
      },
    });

  } catch (err) {
    console.error('❌ /members error:', err);
    res.status(500).json({ success: false, error: 'Failed to list members' });
  }
});

// ===========================================
// GET /org/:namespace/members/:username
// ===========================================

router.get('/:namespace/members/:username', async (req: Request, res: Response) => {
  try {
    const { namespace, username } = req.params;
    const supabase = db.getSupabase();

    const { data: member, error } = await supabase
      .from('namespace_members')
      .select('*')
      .eq('namespace', namespace)
      .eq('username', username)
      .single();

    if (error || !member) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    const domain = await getDomain(namespace);

    res.json({
      success: true,
      data: {
        id: member.id,
        namespace: member.namespace,
        username: member.username,
        publicKey: member.public_key,
        handle: `${namespace}@${member.username}`,
        email: `${member.username}@${domain}`,
        role: member.role,
        status: member.status,
        displayName: member.display_name,
        title: member.title,
        department: member.department,
        avatarUrl: member.avatar_url,
        joinedAt: member.joined_at,
        updatedAt: member.updated_at,
      },
    });

  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get member' });
  }
});

// ===========================================
// PATCH /org/:namespace/members/:username
// ===========================================

router.patch('/:namespace/members/:username', async (req: Request, res: Response) => {
  try {
    const { namespace, username } = req.params;
    const { role, status, title, department, displayName } = req.body;
    const actorPk = req.headers['x-gns-publickey'] as string;

    // Check permission
    if (role && !(await checkPermission(namespace, actorPk, 'change_roles'))) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }

    const supabase = db.getSupabase();

    // Get current member
    const { data: current } = await supabase
      .from('namespace_members')
      .select('role')
      .eq('namespace', namespace)
      .eq('username', username)
      .single();

    if (!current) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    // Cannot change owner's role
    if (current.role === 'owner' && role && role !== 'owner') {
      return res.status(400).json({ success: false, error: 'Cannot change owner role. Transfer ownership first.' });
    }

    // Build update
    const updateData: Record<string, unknown> = {};
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    if (title !== undefined) updateData.title = title;
    if (department !== undefined) updateData.department = department;
    if (displayName !== undefined) updateData.display_name = displayName;
    if (status === 'suspended') updateData.suspended_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('namespace_members')
      .update(updateData)
      .eq('namespace', namespace)
      .eq('username', username)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Updated member: ${namespace}@${username}`);

    const domain = await getDomain(namespace);

    res.json({
      success: true,
      data: {
        username: data.username,
        handle: `${namespace}@${data.username}`,
        email: `${data.username}@${domain}`,
        role: data.role,
        status: data.status,
      },
    });

  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update member' });
  }
});

// ===========================================
// DELETE /org/:namespace/members/:username
// ===========================================

router.delete('/:namespace/members/:username', async (req: Request, res: Response) => {
  try {
    const { namespace, username } = req.params;
    const actorPk = req.headers['x-gns-publickey'] as string;

    // Check permission
    if (!(await checkPermission(namespace, actorPk, 'remove_members'))) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }

    const supabase = db.getSupabase();

    // Check member exists and is not owner
    const { data: member } = await supabase
      .from('namespace_members')
      .select('role, public_key')
      .eq('namespace', namespace)
      .eq('username', username)
      .single();

    if (!member) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    if (member.role === 'owner') {
      return res.status(400).json({ success: false, error: 'Cannot remove owner' });
    }

    // Delete
    const { error } = await supabase
      .from('namespace_members')
      .delete()
      .eq('namespace', namespace)
      .eq('username', username);

    if (error) throw error;

    console.log(`✅ Removed member: ${namespace}@${username}`);

    res.json({ success: true, data: { removed: username } });

  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to remove member' });
  }
});

// ===========================================
// POST /org/:namespace/invite
// ===========================================

router.post('/:namespace/invite', async (req: Request, res: Response) => {
  try {
    const { namespace } = req.params;
    const { email, suggestedUsername, role = 'member', title, department, message, expiresInDays = 7 } = req.body;
    const actorPk = req.headers['x-gns-publickey'] as string;

    console.log(`📨 Inviting to ${namespace}@: ${email}`);

    // Check permission
    if (!(await checkPermission(namespace, actorPk, 'invite_members'))) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }

    const supabase = db.getSupabase();

    // Check member limit
    const { data: ns } = await supabase
      .from('namespaces')
      .select('member_count, member_limit')
      .eq('namespace', namespace)
      .single();

    if (ns && ns.member_count >= ns.member_limit) {
      return res.status(400).json({ success: false, error: `Member limit reached (${ns.member_count}/${ns.member_limit})` });
    }

    // Check if already invited
    const { data: existing } = await supabase
      .from('namespace_invitations')
      .select('id')
      .eq('namespace', namespace)
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .single();

    if (existing) {
      return res.status(400).json({ success: false, error: 'Invitation already pending for this email' });
    }

    // Get inviter info
    const { data: inviter } = await supabase
      .from('namespace_members')
      .select('display_name, username')
      .eq('namespace', namespace)
      .eq('public_key', actorPk)
      .single();

    // Generate token and expiry
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Create invitation
    const { data, error } = await supabase
      .from('namespace_invitations')
      .insert({
        namespace,
        email: email.toLowerCase(),
        suggested_username: suggestedUsername || email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, ''),
        role,
        title,
        department,
        custom_message: message,
        token,
        invited_by: actorPk,
        invited_by_name: inviter?.display_name || inviter?.username,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Invitation created: ${email} → ${namespace}@`);

    // TODO: Send email

    res.status(201).json({
      success: true,
      data: {
        invitationId: data.id,
        email: data.email,
        inviteUrl: `https://org.gcrumbs.com/invite/${token}`,
        expiresAt: data.expires_at,
      },
    });

  } catch (err) {
    console.error('❌ /invite error:', err);
    res.status(500).json({ success: false, error: 'Failed to create invitation' });
  }
});

// ===========================================
// GET /org/:namespace/invitations
// ===========================================

router.get('/:namespace/invitations', async (req: Request, res: Response) => {
  try {
    const { namespace } = req.params;
    const supabase = db.getSupabase();

    const { data, error } = await supabase
      .from('namespace_invitations')
      .select('*')
      .eq('namespace', namespace)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const invitations = (data || []).map(i => ({
      id: i.id,
      email: i.email,
      suggestedUsername: i.suggested_username,
      role: i.role,
      status: i.status,
      invitedByName: i.invited_by_name,
      createdAt: i.created_at,
      expiresAt: i.expires_at,
    }));

    res.json({
      success: true,
      data: {
        invitations,
        total: invitations.length,
        pending: invitations.filter(i => i.status === 'pending').length,
      },
    });

  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list invitations' });
  }
});

// ===========================================
// GET /org/invite/:token (public)
// ===========================================

router.get('/invite/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const supabase = db.getSupabase();

    const { data: inv, error } = await supabase
      .from('namespace_invitations')
      .select('*, namespaces!inner(organization_name)')
      .eq('token', token)
      .single();

    if (error || !inv) {
      return res.status(404).json({ success: false, error: 'Invitation not found' });
    }

    const isExpired = new Date(inv.expires_at) < new Date();

    res.json({
      success: true,
      data: {
        namespace: inv.namespace,
        organizationName: inv.namespaces?.organization_name,
        suggestedUsername: inv.suggested_username,
        role: inv.role,
        invitedByName: inv.invited_by_name,
        expiresAt: inv.expires_at,
        isExpired,
        isRevoked: inv.status === 'revoked',
      },
    });

  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get invitation' });
  }
});

// ===========================================
// POST /org/invite/:token/accept
// ===========================================

router.post('/invite/:token/accept', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { username, publicKey, displayName } = req.body;

    console.log(`✅ Accepting invitation: ${token.slice(0, 8)}...`);

    if (!username || !publicKey) {
      return res.status(400).json({ success: false, error: 'Required: username, publicKey' });
    }

    // Validate username
    const cleanUsername = username.toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]*[a-z0-9]$|^[a-z0-9]$/.test(cleanUsername) || cleanUsername.length < 3) {
      return res.status(400).json({ success: false, error: 'Invalid username format' });
    }

    const supabase = db.getSupabase();

    // Get invitation
    const { data: inv, error: invError } = await supabase
      .from('namespace_invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (invError || !inv) {
      return res.status(404).json({ success: false, error: 'Invitation not found' });
    }

    // Check status
    if (inv.status === 'accepted') {
      return res.status(400).json({ success: false, error: 'Already accepted' });
    }
    if (inv.status === 'revoked') {
      return res.status(400).json({ success: false, error: 'Invitation revoked' });
    }
    if (new Date(inv.expires_at) < new Date()) {
      await supabase.from('namespace_invitations').update({ status: 'expired' }).eq('id', inv.id);
      return res.status(400).json({ success: false, error: 'Invitation expired' });
    }

    // Check namespace member limit
    const { data: ns } = await supabase
      .from('namespaces')
      .select('member_count, member_limit, organization_name')
      .eq('namespace', inv.namespace)
      .single();

    if (ns && ns.member_count >= ns.member_limit) {
      return res.status(400).json({ success: false, error: 'Organization member limit reached' });
    }

    // Check username availability
    const { data: existingUser } = await supabase
      .from('namespace_members')
      .select('username')
      .eq('namespace', inv.namespace)
      .eq('username', cleanUsername)
      .single();

    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Username already taken in this organization' });
    }

    // Create member
    const { error: memberError } = await supabase
      .from('namespace_members')
      .insert({
        namespace: inv.namespace,
        username: cleanUsername,
        public_key: publicKey,
        role: inv.role,
        status: 'active',
        display_name: displayName || inv.suggested_username,
        title: inv.title,
        department: inv.department,
        invited_by: inv.invited_by,
        invitation_id: inv.id,
      });

    if (memberError) {
      console.error('Member creation error:', memberError);
      return res.status(500).json({ success: false, error: 'Failed to create member' });
    }

    // Update invitation
    await supabase
      .from('namespace_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_pk: publicKey,
        accepted_username: cleanUsername,
      })
      .eq('id', inv.id);

    // Update member count
    await supabase
      .from('namespaces')
      .update({ member_count: (ns?.member_count || 0) + 1 })
      .eq('namespace', inv.namespace);

    const domain = await getDomain(inv.namespace);

    console.log(`✅ Member joined: ${inv.namespace}@${cleanUsername}`);

    res.json({
      success: true,
      data: {
        handle: `${inv.namespace}@${cleanUsername}`,
        email: `${cleanUsername}@${domain}`,
        namespace: inv.namespace,
        organizationName: ns?.organization_name,
        role: inv.role,
      },
    });

  } catch (err) {
    console.error('❌ /accept error:', err);
    res.status(500).json({ success: false, error: 'Failed to accept invitation' });
  }
});

// ===========================================
// DELETE /org/:namespace/invitations/:id
// ===========================================

router.delete('/:namespace/invitations/:id', async (req: Request, res: Response) => {
  try {
    const { namespace, id } = req.params;
    const actorPk = req.headers['x-gns-publickey'] as string;

    if (!(await checkPermission(namespace, actorPk, 'invite_members'))) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }

    const supabase = db.getSupabase();

    const { error } = await supabase
      .from('namespace_invitations')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('namespace', namespace)
      .eq('status', 'pending');

    if (error) throw error;

    res.json({ success: true, data: { revoked: id } });

  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to revoke invitation' });
  }
});

// ===========================================
// GET /resolve/:identifier
// ===========================================

router.get('/resolve/:identifier', async (req: Request, res: Response) => {
  try {
    const identifier = req.params.identifier.toLowerCase();
    const supabase = db.getSupabase();

    let result = null;

    // Check if email format (user@domain.com)
    if (identifier.includes('@') && identifier.includes('.')) {
      const [local, domain] = identifier.split('@');

      // Check custom domain
      const { data: mapping } = await supabase
        .from('domain_mappings')
        .select('namespace')
        .eq('domain', domain)
        .eq('status', 'verified')
        .single();

      if (mapping) {
        const { data: member } = await supabase
          .from('namespace_members')
          .select('*, namespaces!inner(organization_name)')
          .eq('namespace', mapping.namespace)
          .eq('username', local)
          .eq('status', 'active')
          .single();

        if (member) {
          result = {
            publicKey: member.public_key,
            handle: `${member.namespace}@${member.username}`,
            email: identifier,
            type: 'org_member',
            namespace: member.namespace,
            organization: {
              name: member.namespaces?.organization_name,
              domain,
              verified: true,
            },
            profile: {
              displayName: member.display_name,
              title: member.title,
            },
          };
        }
      }

      // Check gcrumbs.com
      if (!result && domain === 'gcrumbs.com') {
        const { data: alias } = await supabase
          .from('aliases')
          .select('pk_root, handle')
          .eq('handle', local)
          .single();

        if (alias) {
          result = {
            publicKey: alias.pk_root,
            handle: `@${alias.handle}`,
            email: identifier,
            type: 'individual',
          };
        }
      }
    }
    // Check org handle format (namespace@username)
    else if (identifier.includes('@')) {
      const [namespace, username] = identifier.split('@');

      const { data: member } = await supabase
        .from('namespace_members')
        .select('*, namespaces!inner(organization_name), domain_mappings(domain)')
        .eq('namespace', namespace)
        .eq('username', username)
        .eq('status', 'active')
        .single();

      if (member) {
        const domain = member.domain_mappings?.[0]?.domain || `${namespace}.gcrumbs.com`;
        result = {
          publicKey: member.public_key,
          handle: identifier,
          email: `${username}@${domain}`,
          type: 'org_member',
          namespace,
          organization: {
            name: member.namespaces?.organization_name,
            domain,
            verified: true,
          },
          profile: {
            displayName: member.display_name,
            title: member.title,
          },
        };
      }
    }
    // Individual handle
    else {
      const handle = identifier.replace(/^@/, '');
      const { data: alias } = await supabase
        .from('aliases')
        .select('pk_root, handle')
        .eq('handle', handle)
        .single();

      if (alias) {
        result = {
          publicKey: alias.pk_root,
          handle: `@${alias.handle}`,
          email: `${alias.handle}@gcrumbs.com`,
          type: 'individual',
        };
      }
    }

    if (!result) {
      return res.status(404).json({ success: false, error: 'Identity not found' });
    }

    res.json({ success: true, data: result });

  } catch (err) {
    console.error('❌ /resolve error:', err);
    res.status(500).json({ success: false, error: 'Resolution failed' });
  }
});

export default router;
