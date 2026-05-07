// Mapping centralisé des récompenses parrainage CloseOS Sales V2
// Matrice 3×3 : cycle parrain × cycle filleul

export type BillingCycle = 'monthly' | 'quarterly' | 'yearly';

export const SALES_PRICE_MONTHLY = 'price_1TQDp733xpuYLywqwXklwdS3';
export const SALES_PRICE_QUARTERLY = 'price_1TQTh533xpuYLywqscpvBiS0';
export const SALES_PRICE_YEARLY = 'price_1TQDp833xpuYLywqsUwcNMpk';

export function detectBillingCycleFromPriceId(priceId: string | undefined): BillingCycle {
  if (priceId === SALES_PRICE_YEARLY) return 'yearly';
  if (priceId === SALES_PRICE_QUARTERLY) return 'quarterly';
  return 'monthly';
}

export function detectBillingCycleFromInterval(
  interval: 'day' | 'week' | 'month' | 'year' | undefined,
  intervalCount: number | undefined
): BillingCycle {
  if (interval === 'year') return 'yearly';
  if (interval === 'month' && intervalCount === 3) return 'quarterly';
  return 'monthly';
}

// Coupon filleul (toujours appliqué immédiatement, indépendant du cycle parrain)
export function getFilleulCoupon(filleulCycle: BillingCycle): string {
  switch (filleulCycle) {
    case 'yearly': return 'REF-FIL-ANN-26';
    case 'quarterly': return 'REF-FIL-TRIM-10';
    default: return 'REF-FIL-MENS-5';
  }
}

export interface ReferrerReward {
  couponId: string | null;          // coupon Stripe à appliquer (NULL si virement)
  manualPayoutCents: number | null; // montant à virer manuellement (NULL si coupon)
  rewardDurationDays: number;       // durée de la récompense pour calcul reward_ends_at
}

// Mapping cycle parrain × cycle filleul → récompense
export function mapReferralReward(parrainCycle: BillingCycle, filleulCycle: BillingCycle): ReferrerReward {
  // Parrain mensuel : -X€ × 2 mois
  if (parrainCycle === 'monthly') {
    if (filleulCycle === 'yearly') return { couponId: 'REF-PAR-MA-14', manualPayoutCents: null, rewardDurationDays: 60 };
    if (filleulCycle === 'quarterly') return { couponId: 'REF-PAR-MT-9', manualPayoutCents: null, rewardDurationDays: 60 };
    return { couponId: 'REF-PAR-MM-4', manualPayoutCents: null, rewardDurationDays: 60 };
  }

  // Parrain trimestriel : -X€ once sur prochain trimestre
  if (parrainCycle === 'quarterly') {
    if (filleulCycle === 'yearly') return { couponId: 'REF-PAR-TA-26', manualPayoutCents: null, rewardDurationDays: 90 };
    if (filleulCycle === 'quarterly') return { couponId: 'REF-PAR-TT-15', manualPayoutCents: null, rewardDurationDays: 90 };
    return { couponId: 'REF-PAR-TM-7', manualPayoutCents: null, rewardDurationDays: 90 };
  }

  // Parrain annuel : -16€ once OU virement manuel
  if (filleulCycle === 'yearly') return { couponId: null, manualPayoutCents: 4000, rewardDurationDays: 0 };
  if (filleulCycle === 'quarterly') return { couponId: null, manualPayoutCents: 2000, rewardDurationDays: 0 };
  return { couponId: 'REF-PAR-AM-16', manualPayoutCents: null, rewardDurationDays: 365 };
}

// Pour affichage dans Settings/email : description des récompenses selon cycle parrain
export interface RewardDescriptionFR {
  filleul_mensuel: string;
  filleul_trimestriel: string;
  filleul_annuel: string;
}

export function getReferrerRewardsDescriptionFR(parrainCycle: BillingCycle): RewardDescriptionFR {
  if (parrainCycle === 'monthly') {
    return {
      filleul_mensuel: '20€/mois pendant 2 mois (au lieu de 24€)',
      filleul_trimestriel: '15€/mois pendant 2 mois (au lieu de 24€)',
      filleul_annuel: '10€/mois pendant 2 mois (au lieu de 24€)',
    };
  }
  if (parrainCycle === 'quarterly') {
    return {
      filleul_mensuel: '53€ sur le prochain trimestre (au lieu de 60€)',
      filleul_trimestriel: '45€ sur le prochain trimestre (au lieu de 60€)',
      filleul_annuel: '34€ sur le prochain trimestre (au lieu de 60€)',
    };
  }
  return {
    filleul_mensuel: '200€ sur la prochaine année (au lieu de 216€)',
    filleul_trimestriel: 'Virement de 20€',
    filleul_annuel: 'Virement de 40€',
  };
}

export function getReferrerRewardsDescriptionEN(parrainCycle: BillingCycle): RewardDescriptionFR {
  if (parrainCycle === 'monthly') {
    return {
      filleul_mensuel: '€20/month for 2 months (instead of €24)',
      filleul_trimestriel: '€15/month for 2 months (instead of €24)',
      filleul_annuel: '€10/month for 2 months (instead of €24)',
    };
  }
  if (parrainCycle === 'quarterly') {
    return {
      filleul_mensuel: '€53 on next quarter (instead of €60)',
      filleul_trimestriel: '€45 on next quarter (instead of €60)',
      filleul_annuel: '€34 on next quarter (instead of €60)',
    };
  }
  return {
    filleul_mensuel: '€200 on next year (instead of €216)',
    filleul_trimestriel: 'Bank transfer €20',
    filleul_annuel: 'Bank transfer €40',
  };
}
