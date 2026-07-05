-- Sessions de signature propriétaire (déclenchées par le MCP, complétées sur /sign/owner/<token>)
-- (déjà appliquée en prod via MCP Supabase — ce fichier sert de trace)
create table if not exists public.sign_owner_sign_sessions (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  owner_id uuid not null,
  owner_email text not null,
  contract_ids uuid[] not null default '{}',
  code_hash text,
  code_expires_at timestamptz,
  code_attempts int not null default 0,
  verified boolean not null default false,
  signature_value text,               -- data-URL image ou texte d'initiales
  signature_kind text,                -- 'initials' | 'draw' | 'import'
  status text not null default 'pending',  -- pending | ready | consumed | expired
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes')
);

alter table public.sign_owner_sign_sessions enable row level security;
-- Aucune policy : accès uniquement via la clé service-role (API/MCP). anon = 0 accès.

create index if not exists idx_owner_sign_sessions_token on public.sign_owner_sign_sessions (token);
