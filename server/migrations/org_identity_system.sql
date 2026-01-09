-- ============================================
-- GNS ORGANIZATION IDENTITY SYSTEM
-- ============================================
-- APPLIED: January 9, 2025 (manually step-by-step)
-- ============================================

-- STEP 1: Added columns to namespaces
ALTER TABLE namespaces 
  ADD COLUMN IF NOT EXISTS organization_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS domain VARCHAR(255),
  ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS member_limit INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- STEP 2: Added columns to existing namespace_members
-- (table already existed with: id, namespace, handle, member_pk, role, department, status, invited_by, invited_at, joined_at, created_at, updated_at)
ALTER TABLE namespace_members
  ADD COLUMN IF NOT EXISTS username VARCHAR(50),
  ADD COLUMN IF NOT EXISTS public_key VARCHAR(64),
  ADD COLUMN IF NOT EXISTS title VARCHAR(100),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS invitation_id UUID,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- Copy data from old columns to new
UPDATE namespace_members SET public_key = member_pk WHERE public_key IS NULL AND member_pk IS NOT NULL;
UPDATE namespace_members SET username = split_part(handle, '@', 2) WHERE username IS NULL AND handle IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nm_pk ON namespace_members(public_key);
CREATE INDEX IF NOT EXISTS idx_nm_username ON namespace_members(namespace, username);

-- STEP 3: Created domain_mappings
CREATE TABLE IF NOT EXISTS domain_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace TEXT NOT NULL,
  domain VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  mx_verified BOOLEAN DEFAULT FALSE,
  spf_verified BOOLEAN DEFAULT FALSE,
  dkim_verified BOOLEAN DEFAULT FALSE,
  dmarc_verified BOOLEAN DEFAULT FALSE,
  gns_verified BOOLEAN DEFAULT FALSE,
  dkim_selector VARCHAR(50) DEFAULT 'gns',
  dkim_public_key TEXT,
  inbound_enabled BOOLEAN DEFAULT TRUE,
  outbound_enabled BOOLEAN DEFAULT TRUE,
  catch_all_enabled BOOLEAN DEFAULT FALSE,
  catch_all_target VARCHAR(50),
  verified_at TIMESTAMPTZ,
  last_check_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_ns ON domain_mappings(namespace);
CREATE INDEX IF NOT EXISTS idx_dm_domain ON domain_mappings(domain);

-- STEP 4: Created namespace_invitations
CREATE TABLE IF NOT EXISTS namespace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace TEXT NOT NULL,
  email VARCHAR(255) NOT NULL,
  suggested_username VARCHAR(50),
  role VARCHAR(20) DEFAULT 'member',
  title VARCHAR(100),
  department VARCHAR(100),
  custom_message TEXT,
  token VARCHAR(64) UNIQUE NOT NULL,
  invited_by VARCHAR(64) NOT NULL,
  invited_by_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  accepted_pk VARCHAR(64),
  accepted_username VARCHAR(50),
  email_sent_at TIMESTAMPTZ,
  resend_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_inv_ns ON namespace_invitations(namespace);
CREATE INDEX IF NOT EXISTS idx_inv_token ON namespace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_inv_email ON namespace_invitations(email);

-- STEP 5: Created namespace_audit_log
CREATE TABLE IF NOT EXISTS namespace_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace TEXT NOT NULL,
  action VARCHAR(50) NOT NULL,
  category VARCHAR(20) NOT NULL,
  actor_pk VARCHAR(64) NOT NULL,
  actor_handle VARCHAR(80),
  actor_name VARCHAR(100),
  target_pk VARCHAR(64),
  target_handle VARCHAR(80),
  target_name VARCHAR(100),
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_ns ON namespace_audit_log(namespace);
CREATE INDEX IF NOT EXISTS idx_audit_created ON namespace_audit_log(created_at DESC);

-- STEP 6: Helper functions
CREATE OR REPLACE FUNCTION resolve_email_to_member(email_address TEXT)
RETURNS TABLE (
  namespace TEXT,
  username VARCHAR,
  public_key VARCHAR,
  handle TEXT,
  display_name VARCHAR,
  status VARCHAR
) AS $$
DECLARE
  v_local VARCHAR;
  v_domain VARCHAR;
BEGIN
  v_local := split_part(lower(email_address), '@', 1);
  v_domain := split_part(lower(email_address), '@', 2);
  
  RETURN QUERY
  SELECT 
    nm.namespace,
    nm.username,
    nm.public_key,
    (nm.namespace || '@' || nm.username)::TEXT as handle,
    nm.display_name,
    nm.status
  FROM namespace_members nm
  JOIN domain_mappings dm ON nm.namespace = dm.namespace
  WHERE dm.domain = v_domain
    AND nm.username = v_local
    AND nm.status = 'active'
    AND dm.status = 'verified';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_member_permission(
  p_namespace TEXT,
  p_actor_pk VARCHAR,
  p_permission VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_role VARCHAR;
BEGIN
  SELECT role INTO v_role
  FROM namespace_members
  WHERE namespace = p_namespace
    AND (public_key = p_actor_pk OR member_pk = p_actor_pk)
    AND status = 'active';
    
  IF v_role IS NULL THEN RETURN FALSE; END IF;
  
  CASE p_permission
    WHEN 'invite_members' THEN RETURN v_role IN ('owner', 'admin');
    WHEN 'remove_members' THEN RETURN v_role IN ('owner', 'admin');
    WHEN 'change_roles' THEN RETURN v_role IN ('owner', 'admin');
    WHEN 'manage_settings' THEN RETURN v_role IN ('owner', 'admin');
    WHEN 'manage_billing' THEN RETURN v_role = 'owner';
    WHEN 'view_audit' THEN RETURN v_role IN ('owner', 'admin');
    ELSE RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql;
