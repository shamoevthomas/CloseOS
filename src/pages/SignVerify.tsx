import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { signSupabase as supabase } from '../lib/signSupabase';
import { SignLogo } from '../components/SignLogo';

/**
 * Vérification publique d'un certificat de preuve par son identifiant (preuve publique, vérifiable
 * par tous). Affiche les empreintes enregistrées au scellement — aucune donnée personnelle.
 */
type VerifyResult = { ok: boolean; title?: string; originalHash?: string; sealedHash?: string; certificateHash?: string; certifiedAt?: string };

const HashRow = ({ label, value }: { label: string; value?: string }) => (
  <div className="rounded-lg border border-[#3A4242] bg-[#191E1E] p-3">
    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]">{label}</div>
    <div className="break-all font-mono text-[11px] text-[#F3F4F6]">{value || '—'}</div>
  </div>
);

export default function SignVerify() {
  const { certificateId } = useParams();
  const [loading, setLoading] = useState(true);
  const [res, setRes] = useState<VerifyResult | null>(null);

  useEffect(() => {
    document.title = 'Vérifier un certificat | CloseOS Sign';
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('sign-certificate', { body: { action: 'verify', certificateId } });
        if (!cancelled) setRes(data?.ok ? data : { ok: false });
      } catch {
        if (!cancelled) setRes({ ok: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [certificateId]);

  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('fr-FR', { timeZone: 'UTC' }) + ' UTC' : '—');

  return (
    <div className="min-h-screen bg-[#191E1E] font-sans text-[#F3F4F6] antialiased">
      <header className="flex items-center justify-between gap-3 border-b border-[#3A4242] px-4 py-4 sm:px-6">
        <div className="flex items-center">
          <SignLogo className="text-sm" />
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#A1A9A9]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#CEFF8F]" /> Vérification de certificat
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#A1A9A9]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : res?.ok ? (
          <>
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#CEFF8F]/30 bg-[#CEFF8F]/10 px-5 py-4">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-[#CEFF8F]" />
              <div>
                <div className="font-semibold text-white">Certificat authentique</div>
                <div className="text-sm text-[#A1A9A9]">Ce certificat existe et a été scellé par CloseOS Sign.</div>
              </div>
            </div>
            <div className="space-y-3">
              <HashRow label="Document" value={res.title} />
              <HashRow label="Empreinte du document original (SHA-256)" value={res.originalHash} />
              <HashRow label="Empreinte du document scellé (SHA-256)" value={res.sealedHash} />
              <HashRow label="Empreinte du certificat (SHA-256)" value={res.certificateHash} />
              <HashRow label="Certifié le" value={fmt(res.certifiedAt)} />
            </div>
            <p className="mt-6 text-center text-xs leading-relaxed text-[#6b7373]">
              Pour vérifier l'intégrité, calculez le SHA-256 de votre fichier et comparez-le à l'empreinte ci-dessus.
            </p>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-[#ef6b6b]/30 bg-[#ef6b6b]/10 px-5 py-4">
            <XCircle className="h-6 w-6 shrink-0 text-[#ef6b6b]" />
            <div>
              <div className="font-semibold text-white">Certificat introuvable</div>
              <div className="text-sm text-[#A1A9A9]">Cet identifiant ne correspond à aucun certificat scellé.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
