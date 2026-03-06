import { createContext, useContext, useState, useCallback } from 'react';

interface UpgradeContextType {
  isUpgradeModalOpen: boolean;
  showUpgrade: () => void;
  hideUpgrade: () => void;
}

const UpgradeContext = createContext<UpgradeContextType | null>(null);

export function UpgradeProvider({ children }: { children: React.ReactNode }) {
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const showUpgrade = useCallback(() => setIsUpgradeModalOpen(true), []);
  const hideUpgrade = useCallback(() => setIsUpgradeModalOpen(false), []);

  return (
    <UpgradeContext.Provider value={{ isUpgradeModalOpen, showUpgrade, hideUpgrade }}>
      {children}
    </UpgradeContext.Provider>
  );
}

export function useUpgrade() {
  const context = useContext(UpgradeContext);
  if (!context) throw new Error('useUpgrade must be used within UpgradeProvider');
  return context;
}
