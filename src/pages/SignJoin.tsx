import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { SignLogo } from '../components/SignLogo';
import { useSignLang } from '../contexts/SignLangContext';
import { signSupabase } from '../lib/signSupabase';
import { getInviteInfo, acceptInvite } from '../lib/signTeam';

type InviteInfo = { valid: boolean; reason?: string; owner_name?: string; email?: string | null; first_name?: string | null };

const INPUT = 'w-full rounded-lg border border-[#3A4242] bg-[#191E1E] px-3.5 py-2.5 text-sm text-[#F3F4F6] outline-none transition-colors placeholder:text-[#A1A9A9]/40 focus:border-[#CEFF8F]';

export default function SignJoin() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { lang } = useSignLang();
  const fr = lang === 'fr';

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const i = await getInviteInfo(token);
      setInfo(i);
      if (i.email) setEmail(i.email);
      const { data } = await signSupabase.auth.getSession();
      setHasSession(!!data.session);
      setLoading(false);
    })();
  }, [token]);

  const finishAccept = async () => {
    await acceptInvite(token);
    navigate('/sign/team', { replace: true });
  };

  const handleJoin = async () => {
    setBusy(true); setError('');
    try {
      if (!hasSession) {
        if (mode === 'signup') {
          const { data, error: e } = await signSupabase.auth.signUp({ email: email.trim(), password });
          if (e) throw e;
          if (!data.session) {
            setError(fr ? 'Compte créé. Confirmez votre email puis revenez sur ce lien pour rejoindre l’équipe.' : 'Account created. Confirm your email then reopen this link to join the team.');
            setBusy(false);
            return;
          }
        } else {
          const { error: e } = await signSupabase.auth.signInWithPassword({ email: email.trim(), password });
          if (e) throw e;
        }
      }
      await finishAccept();
    } catch (e: any) {
      const msg = String(e?.message || '');
      setError(
        msg.includes('already registered') ? (fr ? 'Un compte existe déjà avec cet email — connectez-vous.' : 'An account already exists — please log in.')
        : msg.includes('Invalid login') ? (fr ? 'Email ou mot de passe incorrect.' : 'Invalid email or password.')
        : msg.includes('expiree') ? (fr ? 'Cette invitation a expiré.' : 'This invitation has expired.')
        : msg.includes('deja_utilisee') ? (fr ? 'Cette invitation a déjà été utilisée.' : 'This invitation was already used.')
        : (fr ? 'Une erreur est survenue.' : 'Something went wrong.')
      );
      setBusy(false);
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-[#191E1E] text-[#F3F4F6] flex flex-col">
      <div className="border-b border-[#3A4242] px-6 py-4"><SignLogo className="text-lg" /></div>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-[#3A4242] bg-[#222828] p-8">{children}</div>
      </div>
    </div>
  );

  if (loading) return <Shell><div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-[#CEFF8F]" /></div></Shell>;

  if (!info?.valid) {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#ef6b6b]/15"><AlertCircle className="h-6 w-6 text-[#ef6b6b]" /></div>
          <h1 className="text-lg font-bold">{fr ? 'Invitation invalide' : 'Invalid invitation'}</h1>
          <p className="mt-2 text-sm text-[#A1A9A9]">
            {info?.reason === 'expiree' ? (fr ? 'Ce lien a expiré. Demandez-en un nouveau.' : 'This link has expired. Ask for a new one.')
            : info?.reason === 'deja_utilisee' ? (fr ? 'Ce lien a déjà été utilisé.' : 'This link was already used.')
            : (fr ? 'Ce lien d’invitation est introuvable.' : 'This invitation link was not found.')}
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-center mb-6">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#CEFF8F]/15"><ShieldCheck className="h-6 w-6 text-[#CEFF8F]" /></div>
        <h1 className="text-xl font-extrabold tracking-tight">{fr ? "Rejoindre l'équipe" : 'Join the team'}</h1>
        <p className="mt-1.5 text-sm text-[#A1A9A9]">
          {info.owner_name ? (fr ? <>Vous avez été invité par <span className="font-semibold text-[#F3F4F6]">{info.owner_name}</span> à rejoindre son équipe sur CloseOS Sign.</> : <>You were invited by <span className="font-semibold text-[#F3F4F6]">{info.owner_name}</span> to join their team on CloseOS Sign.</>) : (fr ? 'Créez votre accès à CloseOS Sign.' : 'Create your CloseOS Sign access.')}
        </p>
      </div>

      {hasSession ? (
        <button onClick={handleJoin} disabled={busy} className="w-full rounded-full bg-[#CEFF8F] py-3 text-sm font-bold text-[#191E1E] hover:bg-[#bdf06f] disabled:opacity-50 transition-all">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (fr ? 'Rejoindre maintenant' : 'Join now')}
        </button>
      ) : (
        <div className="space-y-3">
          <input className={INPUT} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          <input className={INPUT} type="password" placeholder={mode === 'signup' ? (fr ? 'Choisir un mot de passe' : 'Choose a password') : (fr ? 'Mot de passe' : 'Password')} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          {error && <p className="text-xs text-[#ef6b6b]">{error}</p>}
          <button onClick={handleJoin} disabled={busy || !email.trim() || !password} className="w-full rounded-full bg-[#CEFF8F] py-3 text-sm font-bold text-[#191E1E] hover:bg-[#bdf06f] disabled:opacity-50 transition-all">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (mode === 'signup' ? (fr ? 'Créer mon compte et rejoindre' : 'Create account & join') : (fr ? 'Se connecter et rejoindre' : 'Log in & join'))}
          </button>
          <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }} className="w-full text-center text-xs text-[#A1A9A9] hover:text-[#F3F4F6] transition-colors">
            {mode === 'signup' ? (fr ? 'J’ai déjà un compte — se connecter' : 'I already have an account — log in') : (fr ? 'Créer un nouveau compte' : 'Create a new account')}
          </button>
        </div>
      )}
    </Shell>
  );
}
