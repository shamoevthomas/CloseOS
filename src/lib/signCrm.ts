import { signSupabase } from './signSupabase';
import { currentOwnerId } from './signAuth';
import { getOrCreateContactFull, type SignContact } from './signContracts';

/**
 * Pont CloseOS Business → CloseOS Sign.
 *
 * Le propriétaire Sign (auth.uid()) est le MÊME utilisateur que son compte Business
 * (business_users.id = sign_users.id = auth.users.id). Les policies RLS Business
 * autorisent la lecture de ses propres données (prospects/formules/équipe). On lit donc
 * le CRM en DIRECT depuis le client Sign (synchronisé en temps réel, lecture seule),
 * et on « matérialise » une personne en vrai contact Sign uniquement quand on l'utilise.
 */

// Stages considérés comme « client gagné » (le canonique Business est 'won' ; on couvre les variantes).
const WON_STAGES = ['won', 'gagne', 'gagné', 'closed', 'closé', 'client'];
// Formules Business qui ouvrent l'onglet « Équipe » (solo exclu).
const TEAM_PLANS = ['business', 'business_acquisition', 'enterprise'];

export type CrmPerson = {
  kind: 'prospect' | 'team';
  externalId: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  role?: string; // membre d'équipe
  offerName?: string; // prospect
};
export type CrmOfferGroup = { offerId: string | null; offerName: string; people: CrmPerson[] };
export type CrmTree = {
  hasBusiness: boolean;
  prospectOffers: CrmOfferGroup[];
  totalProspects: number;
  showTeam: boolean;
  team: CrmPerson[];
};

const EMPTY: CrmTree = { hasBusiness: false, prospectOffers: [], totalProspects: 0, showTeam: false, team: [] };

/** Lit l'arbre CRM (prospects gagnés par offre + équipe) du propriétaire connecté. */
export async function loadCrmTree(): Promise<CrmTree> {
  const ownerId = await currentOwnerId();
  if (!ownerId) return EMPTY;

  // Le propriétaire Sign a-t-il un compte Business ? (sinon : compte Sign-pur → pas de CRM)
  const { data: bu } = await signSupabase.from('business_users').select('id').eq('id', ownerId).maybeSingle();
  if (!bu) return EMPTY;

  const [settingsRes, formulasRes, prospectsRes, teamRes] = await Promise.all([
    signSupabase.from('business_settings').select('subscription_plan').eq('user_id', ownerId).maybeSingle(),
    signSupabase.from('business_formulas').select('id,name').eq('user_id', ownerId),
    signSupabase
      .from('business_prospects')
      .select('id,contact,"firstName","lastName",email,phone,company,stage,formula_id')
      .eq('user_id', ownerId)
      .in('stage', WON_STAGES),
    signSupabase.from('business_team_members').select('id,first_name,last_name,email,phone,role').eq('business_owner_id', ownerId),
  ]);

  const plan = (settingsRes.data?.subscription_plan as string | null) ?? null;
  const showTeam = !!plan && TEAM_PLANS.includes(plan);

  // Map offre id → nom
  const offerName = new Map<string, string>();
  (formulasRes.data ?? []).forEach((f: any) => offerName.set(String(f.id), (f.name as string) || 'Offre'));

  // Prospects gagnés → personnes (email obligatoire pour pouvoir envoyer un contrat)
  const prospects = (prospectsRes.data ?? []).filter((p: any) => (p.email || '').trim());
  const byOffer = new Map<string, CrmPerson[]>();
  for (const p of prospects) {
    const fid = p.formula_id ? String(p.formula_id) : '';
    const known = fid && offerName.has(fid);
    const key = known ? fid : '__none__';
    const oName = known ? offerName.get(fid)! : 'Sans offre';
    const name = (p.contact || `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.email).trim();
    const person: CrmPerson = {
      kind: 'prospect',
      externalId: String(p.id),
      name,
      email: (p.email || '').trim(),
      phone: (p.phone || '').trim(),
      company: (p.company || '').trim() || undefined,
      offerName: oName,
    };
    if (!byOffer.has(key)) byOffer.set(key, []);
    byOffer.get(key)!.push(person);
  }

  const prospectOffers: CrmOfferGroup[] = [];
  for (const [key, people] of byOffer) {
    people.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    prospectOffers.push({
      offerId: key === '__none__' ? null : key,
      offerName: key === '__none__' ? 'Sans offre' : offerName.get(key) || 'Offre',
      people,
    });
  }
  // Offres triées alphabétiquement, « Sans offre » en dernier
  prospectOffers.sort((a, b) => {
    if (a.offerId === null) return 1;
    if (b.offerId === null) return -1;
    return a.offerName.localeCompare(b.offerName, 'fr');
  });

  const team: CrmPerson[] = showTeam
    ? (teamRes.data ?? [])
        .filter((m: any) => (m.email || '').trim())
        .map((m: any) => ({
          kind: 'team' as const,
          externalId: String(m.id),
          name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || (m.email || '').trim(),
          email: (m.email || '').trim(),
          phone: (m.phone || '').trim(),
          role: (m.role || '').trim() || undefined,
        }))
        .sort((a: CrmPerson, b: CrmPerson) => a.name.localeCompare(b.name, 'fr'))
    : [];

  return {
    hasBusiness: true,
    prospectOffers,
    totalProspects: prospects.length,
    showTeam,
    team,
  };
}

/** Aplati toutes les personnes du CRM (pour la recherche). */
export function flattenCrm(tree: CrmTree | null): CrmPerson[] {
  if (!tree) return [];
  return [...tree.prospectOffers.flatMap((g) => g.people), ...tree.team];
}

/** Transforme une personne CRM en vrai contact Sign (par email) afin de l'utiliser dans un contrat. */
export async function materializeCrmPerson(p: CrmPerson): Promise<SignContact> {
  return getOrCreateContactFull({ name: p.name, email: p.email, phone: p.phone, company: p.company });
}
