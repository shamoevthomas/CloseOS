-- Dossiers de rangement des contrats Sign (arborescence) + rattachement des contrats
create table if not exists public.sign_contract_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  parent_id uuid references public.sign_contract_folders(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.sign_contract_folders enable row level security;

create policy owner_all on public.sign_contract_folders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_sign_contract_folders_user on public.sign_contract_folders (user_id);
create index if not exists idx_sign_contract_folders_parent on public.sign_contract_folders (parent_id);

-- Rattachement d'un contrat à un dossier (null = racine)
alter table public.sign_contracts
  add column if not exists folder_id uuid references public.sign_contract_folders(id) on delete set null;

create index if not exists idx_sign_contracts_folder on public.sign_contracts (folder_id);
