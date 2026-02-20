// Helper pour FirstPromoter - Attend que le script soit chargé avant d'appeler fpr

/**
 * Préserve le paramètre fpr dans l'URL lors de la navigation
 */
export function preserveFprParam(url: string): string {
  if (typeof window === 'undefined') return url;
  
  const urlParams = new URLSearchParams(window.location.search);
  const fprParam = urlParams.get('fpr');
  
  if (fprParam) {
    try {
      const urlObj = new URL(url, window.location.origin);
      urlObj.searchParams.set('fpr', fprParam);
      return urlObj.pathname + urlObj.search;
    } catch {
      // Si ce n'est pas une URL complète, ajouter le paramètre
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}fpr=${encodeURIComponent(fprParam)}`;
    }
  }
  
  return url;
}

/**
 * Attend que FirstPromoter soit chargé et disponible
 */
export async function waitForFirstPromoter(maxWait = 5000): Promise<boolean> {
  // Si fpr est déjà disponible, on peut l'utiliser immédiatement
  if (typeof window !== 'undefined' && (window as any).fpr) {
    return true;
  }

  // Sinon, on attend que le script soit chargé
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkInterval = setInterval(() => {
      const fpr = (window as any).fpr;
      const fprReady = (window as any).fprReady;
      const fprScriptLoaded = (window as any).fprScriptLoaded;
      
      // Vérifier si fpr est disponible
      if (fpr && (fprReady || fprScriptLoaded)) {
        clearInterval(checkInterval);
        resolve(true);
        return;
      }
      
      // Timeout après maxWait ms
      if (Date.now() - startTime > maxWait) {
        clearInterval(checkInterval);
        console.warn('FirstPromoter script timeout - fpr may not be available');
        resolve(false);
      }
    }, 100);
  });
}

/**
 * Appelle fpr("referral", { email }) en attendant que le script soit chargé
 */
export async function trackFirstPromoterReferral(email: string): Promise<void> {
  if (!email) {
    console.warn('FirstPromoter: No email provided');
    return;
  }

  try {
    const isReady = await waitForFirstPromoter();
    
    if (!isReady) {
      console.warn('FirstPromoter: Script not loaded, referral tracking may fail');
      // Essayer quand même au cas où
      if (typeof window !== 'undefined' && (window as any).fpr) {
        (window as any).fpr("referral", { email });
      }
      return;
    }

    // Appeler fpr("referral", { email })
    if (typeof window !== 'undefined' && (window as any).fpr) {
      console.log('FirstPromoter: Tracking referral for', email);
      (window as any).fpr("referral", { email });
    } else {
      console.error('FirstPromoter: fpr function not available');
    }
  } catch (error) {
    console.error('FirstPromoter: Error tracking referral', error);
  }
}
