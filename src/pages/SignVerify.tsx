import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { signSupabase as supabase } from '../lib/signSupabase';
import { SignLogo } from '../components/SignLogo';
import { useSignLang, signLocale } from '../contexts/SignLangContext';

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
  const { lang } = useSignLang();
  const [loading, setLoading] = useState(true);
  const [res, setRes] = useState<VerifyResult | null>(null);

  useEffect(() => {
    document.title = lang === 'fr' ? 'Vérifier un certificat | CloseOS Sign' : 'Verify a certificate | CloseOS Sign';
  }, [lang]);

  useEffect(() => {
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

  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString(signLocale(lang), { timeZone: 'UTC' }) + ' UTC' : '—');

  return (
    <div className="min-h-screen bg-[#191E1E] font-sans text-[#F3F4F6] antialiased">
      <header className="flex items-center justify-between gap-3 border-b border-[#3A4242] px-4 py-4 sm:px-6">
        <div className="flex items-center">
          <SignLogo className="text-sm" />
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#A1A9A9]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#CEFF8F]" /> {lang === 'fr' ? 'Vérification de certificat' : 'Certificate verification'}
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
                <div className="font-semibold text-white">{lang === 'fr' ? 'Certificat authentique' : 'Authentic certificate'}</div>
                <div className="text-sm text-[#A1A9A9]">{lang === 'fr' ? 'Ce certificat existe et a été scellé par CloseOS Sign.' : 'This certificate exists and was sealed by CloseOS Sign.'}</div>
              </div>
            </div>
            <div className="space-y-3">
              <HashRow label={lang === 'fr' ? 'Document' : 'Document'} value={res.title} />
              <HashRow label={lang === 'fr' ? 'Empreinte du document original (SHA-256)' : 'Original document hash (SHA-256)'} value={res.originalHash} />
              <HashRow label={lang === 'fr' ? 'Empreinte du document scellé (SHA-256)' : 'Sealed document hash (SHA-256)'} value={res.sealedHash} />
              <HashRow label={lang === 'fr' ? 'Empreinte du certificat (SHA-256)' : 'Certificate hash (SHA-256)'} value={res.certificateHash} />
              <HashRow label={lang === 'fr' ? 'Certifié le' : 'Certified on'} value={fmt(res.certifiedAt)} />
            </div>
            <p className="mt-6 text-center text-xs leading-relaxed text-[#6b7373]">
              {lang === 'fr'
                ? "Pour vérifier l'intégrité, calculez le SHA-256 de votre fichier et comparez-le à l'empreinte ci-dessus."
                : 'To verify integrity, compute the SHA-256 of your file and compare it with the hash above.'}
            </p>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-[#ef6b6b]/30 bg-[#ef6b6b]/10 px-5 py-4">
            <XCircle className="h-6 w-6 shrink-0 text-[#ef6b6b]" />
            <div>
              <div className="font-semibold text-white">{lang === 'fr' ? 'Certificat introuvable' : 'Certificate not found'}</div>
              <div className="text-sm text-[#A1A9A9]">{lang === 'fr' ? "Cet identifiant ne correspond à aucun certificat scellé." : 'This identifier does not match any sealed certificate.'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
