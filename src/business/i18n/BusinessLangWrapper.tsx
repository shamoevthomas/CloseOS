import { useBusinessAuth } from '../contexts/BusinessAuthContext';
import { BusinessLangProvider } from './BusinessLangContext';

export function BusinessLangWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useBusinessAuth();
  return (
    <BusinessLangProvider userId={user?.id || null}>
      {children}
    </BusinessLangProvider>
  );
}
