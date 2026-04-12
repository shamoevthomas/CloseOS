import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { fr, en } from './translations';
import type { BusinessTranslations } from './translations';
import { supabase } from '../../lib/supabase';

export type BusinessLang = 'fr' | 'en';

interface BusinessLangContextType {
  lang: BusinessLang;
  setLang: (lang: BusinessLang) => void;
  t: BusinessTranslations;
}

const BusinessLangContext = createContext<BusinessLangContextType>({
  lang: 'fr',
  setLang: () => {},
  t: fr,
});

export function BusinessLangProvider({
  children,
  userId,
  initialLang,
}: {
  children: React.ReactNode;
  userId?: string | null;
  initialLang?: BusinessLang;
}) {
  const [lang, setLangState] = useState<BusinessLang>(initialLang || 'fr');

  // Load language from business_users on mount
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('business_users')
      .select('language')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.language && (data.language === 'fr' || data.language === 'en')) {
          setLangState(data.language);
        }
      });
  }, [userId]);

  // Also check team_member's owner language if userId is a team member
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('business_team_members')
      .select('business_owner_id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data: tm }) => {
        if (tm?.business_owner_id) {
          supabase
            .from('business_users')
            .select('language')
            .eq('id', tm.business_owner_id)
            .maybeSingle()
            .then(({ data }) => {
              if (data?.language && (data.language === 'fr' || data.language === 'en')) {
                setLangState(data.language);
              }
            });
        }
      });
  }, [userId]);

  const setLang = useCallback(
    async (newLang: BusinessLang) => {
      setLangState(newLang);
      if (userId) {
        await supabase
          .from('business_users')
          .update({ language: newLang })
          .eq('id', userId);
      }
    },
    [userId],
  );

  const t = useMemo(() => (lang === 'en' ? en : fr), [lang]);

  return (
    <BusinessLangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </BusinessLangContext.Provider>
  );
}

export function useBusinessLang() {
  return useContext(BusinessLangContext);
}
