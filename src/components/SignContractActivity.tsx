import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Check, Copy, History, Link2, Loader2, ShieldAlert, Unlock, Users } from 'lucide-react';
import { listContractEvents, renewSignerLink, unlockSigner, type SignSigner } from '../lib/signContracts';
import { buildJournal, type JournalLine } from '../lib/signJournal';
import { signLocale, type SignLang } from '../contexts/SignLangContext';

/**
 * Fiche d'un contrat envoyé, côté propriétaire : onglet « Suivi » (signataires, avec déblocage et
 * nouveau lien, puis le suivi existant passé en `children`) et onglet « Journal » (événements).
 * Les deux actions passent par des fonctions serveur qui vérifient le propriétaire.
 */
export default function SignContractActivity({
  contractId,
  signers,
  onSignersChange,
  lang,
  children,
}: {
  contractId: string;
  signers: SignSigner[];
  onSignersChange: (update: (prev: SignSigner[]) => SignSigner[]) => void;
  lang: SignLang;
  children: ReactNode;
}) {
  const fr = lang === 'fr';
  const [tab, setTab] = useState<'suivi' | 'journal'>('suivi');
  const [lines, setLines] = useState<JournalLine[] | null>(null);
  const [journalError, setJournalError] = useState('');
  const [busy, setBusy] = useState<string | null>(null); // `${signerId}:${action}`
  const [actionError, setActionError] = useState<{ id: string; msg: string } | null>(null);
  const [newLinks, setNewLinks] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const loadJournal = useCallback(async () => {
    try {
      const rows = await listContractEvents(contractId);
      setLines(buildJournal(rows, signers, fr ? 'fr' : 'en'));
      setJournalError('');
    } catch (e) {
      console.error('[sign] journal', e);
      setJournalError(fr ? 'Journal indisponible pour le moment.' : 'Log unavailable right now.');
    }
  }, [contractId, signers, fr]);

  useEffect(() => {
    if (tab === 'journal') loadJournal();
  }, [tab, loadJournal]);

  const run = async (s: SignSigner, action: 'unlock' | 'renew') => {
    setBusy(`${s.id}:${action}`);
    setActionError(null);
    try {
      if (action === 'unlock') {
        await unlockSigner(s.id);
      } else {
        const { token, link } = await renewSignerLink(s.id);
        setNewLinks((prev) => ({ ...prev, [s.id]: link }));
        onSignersChange((prev) => prev.map((x) => (x.id === s.id ? { ...x, accessToken: token } : x)));
      }
      onSignersChange((prev) => prev.map((x) => (x.id === s.id ? { ...x, verificationLocked: false, verificationLockReason: null, verificationLockStep: null } : x)));
      if (tab === 'journal') loadJournal();
    } catch (e) {
      setActionError({ id: s.id, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const copy = async (id: string, link: string) => {
    try { await navigator.clipboard.writeText(link); setCopied(id); setTimeout(() => setCopied(null), 1800); } catch { /* noop */ }
  };

  const statusLabel = (st: SignSigner['status']) =>
    ({
      pending: fr ? 'En attente' : 'Pending',
      sent: fr ? 'Envoyé' : 'Sent',
      opened: fr ? 'Ouvert' : 'Opened',
      signed: fr ? 'Signé' : 'Signed',
      declined: fr ? 'Refusé' : 'Declined',
    })[st] ?? st;

  const toneCls: Record<JournalLine['tone'], string> = {
    neutral: 'text-[#F3F4F6]',
    success: 'text-[#CEFF8F]',
    warning: 'text-[#F0B86E]',
    danger: 'text-[#ef6b6b]',
  };

  const tabBtn = (id: 'suivi' | 'journal', icon: ReactNode, label: string) => (
    <button
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${tab === id ? 'border-[#CEFF8F] text-white' : 'border-transparent text-[#A1A9A9] hover:text-white'}`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="mb-6">
      <div role="tablist" className="mb-4 flex gap-1 border-b border-[#3A4242]">
        {tabBtn('suivi', <Users className="h-4 w-4" />, fr ? 'Suivi' : 'Tracking')}
        {tabBtn('journal', <History className="h-4 w-4" />, fr ? 'Journal' : 'Log')}
      </div>

      {tab === 'suivi' ? (
        <>
          {signers.length > 0 && (
            <div id="sign-signers-panel" className="mb-4 rounded-xl border border-[#3A4242] bg-[#222828] p-4">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#A1A9A9]">{fr ? 'Signataires' : 'Signers'}</div>
              <ul className="space-y-3">
                {signers.map((s) => {
                  const signed = s.status === 'signed';
                  const who = s.name?.trim() || s.email?.trim() || (fr ? `Signataire ${s.signerIndex}` : `Signer ${s.signerIndex}`);
                  const link = newLinks[s.id];
                  return (
                    <li key={s.id} className="rounded-lg border border-[#3A4242] bg-[#191E1E] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-white">{s.signerIndex}. {who}</span>
                        {s.email && s.name && <span className="text-xs text-[#6b7373]">{s.email}</span>}
                        <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${signed ? 'bg-[#CEFF8F]/15 text-[#CEFF8F]' : 'bg-[#3A4242] text-[#A1A9A9]'}`}>{statusLabel(s.status)}</span>
                        {s.verificationLocked && !signed && (
                          <span className="flex items-center gap-1 rounded bg-[#ef6b6b]/15 px-2 py-0.5 text-[11px] font-bold text-[#ef6b6b]">
                            <ShieldAlert className="h-3 w-3" /> {fr ? 'Bloqué après 3 échecs' : 'Blocked after 3 failures'}
                          </span>
                        )}
                      </div>
                      {!signed && (
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {s.verificationLocked && (
                            <button
                              onClick={() => run(s, 'unlock')}
                              disabled={!!busy}
                              className="flex items-center gap-1.5 rounded bg-[#CEFF8F] px-3 py-1.5 text-xs font-bold text-[#191E1E] transition-colors hover:bg-[#A0E7EC] disabled:opacity-50"
                            >
                              {busy === `${s.id}:unlock` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />} {fr ? 'Débloquer' : 'Unblock'}
                            </button>
                          )}
                          <button
                            onClick={() => run(s, 'renew')}
                            disabled={!!busy}
                            title={fr ? "Invalide l'ancien lien et en crée un nouveau, sans envoyer d'email" : 'Invalidates the old link and creates a new one, without sending an email'}
                            className="flex items-center gap-1.5 rounded border border-[#3A4242] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-[#CEFF8F] disabled:opacity-50"
                          >
                            {busy === `${s.id}:renew` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />} {fr ? 'Nouveau lien' : 'New link'}
                          </button>
                        </div>
                      )}
                      {link && (
                        <div className="mt-2.5">
                          <div className="flex items-center gap-2 rounded border border-[#3A4242] bg-[#222828] px-2.5 py-2">
                            <code className="min-w-0 flex-1 truncate text-xs text-[#A0E7EC]">{link}</code>
                            <button onClick={() => copy(s.id, link)} title={fr ? 'Copier' : 'Copy'} className="shrink-0 rounded p-1 text-[#A1A9A9] hover:bg-[#3A4242] hover:text-white">
                              {copied === s.id ? <Check className="h-4 w-4 text-[#CEFF8F]" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </div>
                          <p className="mt-1 text-[11px] text-[#6b7373]">
                            {fr ? "Nouveau lien actif, l'ancien ne fonctionne plus. Aucun email n'a été envoyé : transmettez-le vous-même." : 'New link active, the old one no longer works. No email was sent: share it yourself.'}
                          </p>
                        </div>
                      )}
                      {actionError?.id === s.id && <p role="alert" className="mt-2 text-xs text-[#ef6b6b]">{actionError.msg}</p>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {children}
        </>
      ) : (
        <div className="rounded-xl border border-[#3A4242] bg-[#222828] p-4">
          {journalError ? (
            <p className="text-sm text-[#ef6b6b]">{journalError}</p>
          ) : lines === null ? (
            <div className="flex items-center gap-2 text-sm text-[#A1A9A9]"><Loader2 className="h-4 w-4 animate-spin" /> {fr ? 'Chargement du journal…' : 'Loading log…'}</div>
          ) : lines.length === 0 ? (
            <p className="text-sm text-[#6b7373]">{fr ? 'Aucun événement pour le moment.' : 'No events yet.'}</p>
          ) : (
            <>
              {/* Bureau : tableau ; mobile : une carte par événement */}
              <table className="hidden w-full text-left text-xs md:table">
                <thead className="text-[11px] uppercase tracking-wider text-[#6b7373]">
                  <tr>
                    <th className="pb-2 pr-3 font-medium">{fr ? 'Date et heure' : 'Date & time'}</th>
                    <th className="pb-2 pr-3 font-medium">{fr ? 'Signataire' : 'Signer'}</th>
                    <th className="pb-2 pr-3 font-medium">{fr ? 'Événement' : 'Event'}</th>
                    <th className="pb-2 pr-3 font-medium">IP</th>
                    <th className="pb-2 font-medium">{fr ? 'Appareil' : 'Device'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3A4242]">
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap py-2 pr-3 text-[#A1A9A9]">{new Date(l.at).toLocaleString(signLocale(lang))}</td>
                      <td className="py-2 pr-3 text-[#F3F4F6]">{l.signer}</td>
                      <td className={`py-2 pr-3 font-medium ${toneCls[l.tone]}`}>{l.label}</td>
                      <td className="py-2 pr-3 text-[#A1A9A9]">{l.ip}</td>
                      <td className="py-2 text-[#A1A9A9]">{l.device}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="space-y-2 md:hidden">
                {lines.map((l, i) => (
                  <li key={i} className="rounded border border-[#3A4242] bg-[#191E1E] p-2.5 text-xs">
                    <div className={`font-medium ${toneCls[l.tone]}`}>{l.label}</div>
                    <div className="mt-1 text-[#A1A9A9]">{new Date(l.at).toLocaleString(signLocale(lang))}{l.signer !== '—' ? ` · ${l.signer}` : ''}</div>
                    <div className="mt-0.5 text-[#6b7373]">IP {l.ip} · {l.device}</div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
