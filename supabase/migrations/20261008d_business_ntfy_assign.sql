-- Business ntfy : notifier un membre quand un prospect lui est attribué (à setter / à closer).
-- assigned_setter / assigned_to contiennent l'id du membre (business_team_members.id) ;
-- la notification part vers son compte de connexion (business_team_members.user_id).

create or replace function public.ntfy_on_business_prospect_assign() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; target uuid; me uuid := auth.uid();
begin
  begin
    who := coalesce(nullif(trim(new.contact), ''), nullif(trim(concat_ws(' ', new."firstName", new."lastName")), ''), new.email, 'Prospect');

    if new.assigned_setter is not null and (tg_op = 'INSERT' or old.assigned_setter is distinct from new.assigned_setter) then
      target := null;
      select coalesce(m.user_id, new.assigned_setter) into target from public.business_team_members m where m.id = new.assigned_setter;
      target := coalesce(target, new.assigned_setter);
      if me is distinct from target then
        perform public.ntfy_notify(target, 'assigned', 'Un nouveau prospect à setter vous a été attribué',
          who, 'https://www.closeos.fr/business/crm', array['telephone_receiver'], 4);
      end if;
    end if;

    if new.assigned_to is not null and (tg_op = 'INSERT' or old.assigned_to is distinct from new.assigned_to) then
      target := null;
      select coalesce(m.user_id, new.assigned_to) into target from public.business_team_members m where m.id = new.assigned_to;
      target := coalesce(target, new.assigned_to);
      if me is distinct from target then
        perform public.ntfy_notify(target, 'assigned', 'Un nouveau prospect à closer vous a été attribué',
          who, 'https://www.closeos.fr/business/crm', array['handshake'], 4);
      end if;
    end if;
  exception when others then raise warning 'ntfy assign: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists trg_ntfy_business_prospect_assign_ins on public.business_prospects;
create trigger trg_ntfy_business_prospect_assign_ins after insert on public.business_prospects
  for each row when (new.assigned_setter is not null or new.assigned_to is not null)
  execute function public.ntfy_on_business_prospect_assign();

drop trigger if exists trg_ntfy_business_prospect_assign_upd on public.business_prospects;
create trigger trg_ntfy_business_prospect_assign_upd after update of assigned_setter, assigned_to on public.business_prospects
  for each row when (old.assigned_setter is distinct from new.assigned_setter or old.assigned_to is distinct from new.assigned_to)
  execute function public.ntfy_on_business_prospect_assign();

revoke all on function public.ntfy_on_business_prospect_assign() from public, anon, authenticated;
