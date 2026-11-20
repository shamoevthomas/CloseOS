import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSignOwner, signOutSign } from '../lib/signAuth';
import { useSignMember } from '../lib/signMemberAuth';
import { useDeviceTrust } from '../lib/signDevice';
import { getSignSubscription, subAccessState, type SignSubscription } from '../lib/signSubscription';
import SignVerification from './SignVerification';
import SignPaywall from './SignPaywall';

/**
 * CloseOS Sign — garde des routes connectées.
 * Exige : (1) propriétaire Sign authentifié, (2) appareil de confiance (2FA), (3) abonnement OK.
 * Abonnement : exempt (Business) / actif / essai → accès ; échec de paiement → pop-up de grâce (3 j)
 * puis blocage plein écran. Lecture « fail-open » : on ne bloque que sur un statut explicitement mauvais.
 */

const FullScreen = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-screen items-center justify-center bg-[#191E1E] text-[#F3F4F6]">{children}</div>
);

export default function SignProtected({ children }: { children: ReactNode }) {
  const { loading, owner } = useSignOwner();
  const { loading: memberLoading, member } = useSignMember();
  const { state, recheck } = useDeviceTrust(owner?.id ?? null);
  const [sub, setSub] = useState<SignSubscription | null>(null);

  useEffect(() => {
    if (!owner) return;
    getSignSubscription().then(setSub).catch(() => {});
  }, [owner?.id]);

  if (loading || (!owner && memberLoading)) return <FullScreen><Loader2 className="h-6 w-6 animate-spin text-[#CEFF8F]" /></FullScreen>;
  // Un équipier (non-owner) est redirigé vers son espace dédié ; sinon page de connexion.
  if (!owner) return <Navigate to={member ? '/sign/team' : '/sign/login'} replace />;
  if (state === 'checking') return <FullScreen><Loader2 className="h-6 w-6 animate-spin text-[#CEFF8F]" /></FullScreen>;
  if (state === 'untrusted') {
    return (
      <SignVerification
        userId={owner.id}
        email={owner.email}
        authMethod="classic"
        onVerified={recheck}
        onCancel={async () => {
          await signOutSign();
        }}
      />
    );
  }

  const access = subAccessState(sub);
  if (access === 'blocked') return <SignPaywall mode="blocked" sub={sub} />;
  return (
    <>
      {children}
      {access === 'grace' && <SignPaywall mode="grace" sub={sub} />}
    </>
  );
}
