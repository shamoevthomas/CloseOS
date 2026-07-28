import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSignMember } from '../lib/signMemberAuth';
import { useSignOwner } from '../lib/signAuth';

/**
 * Garde des routes de l'espace ÉQUIPIER Sign (/sign/team).
 * Exige un utilisateur authentifié qui est un membre d'équipe actif.
 * Un owner qui atterrit ici est renvoyé vers son app ; un inconnu vers la connexion.
 */
export default function SignMemberProtected({ children }: { children: ReactNode }) {
  const { loading, member } = useSignMember();
  const { loading: ownerLoading, owner } = useSignOwner();

  if (loading || ownerLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#191E1E] text-[#F3F4F6]">
        <Loader2 className="h-6 w-6 animate-spin text-[#CEFF8F]" />
      </div>
    );
  }
  if (member) return <>{children}</>;
  if (owner) return <Navigate to="/sign/app" replace />;
  return <Navigate to="/sign/login" replace />;
}
