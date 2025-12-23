# Intégration de la Sauvegarde d'Appel (Call Summary)

Ce document décrit comment connecter la logique de sauvegarde des appels à votre système de timeline/historique.

## 📋 Points d'Intégration

### 1. Dashboard (`src/pages/Dashboard.tsx`)

**Fonction**: `handleCallSummarySubmit` (lignes 166-176)

```typescript
const handleCallSummarySubmit = (data: CallSummaryData) => {
  console.log('Call Summary from Dashboard:', data)

  // TODO: INTÉGRATION À FAIRE ICI
  // Ajouter une entrée dans la timeline du prospect
  // addCallToTimeline(selectedProspect.name, {
  //   type: 'call',
  //   outcome: data.outcome,
  //   notes: data.notes,
  //   followupReason: data.followupReason,
  //   followupReasonOther: data.followupReasonOther,
  //   followupDate: data.followupDate,
  //   timestamp: new Date().toISOString()
  // })
}
```

### 2. Pipeline (`src/pages/Pipeline.tsx`)

**Fonction**: `handleCallSummarySubmit` (lignes 315-323)

```typescript
const handleCallSummarySubmit = (data: CallSummaryData) => {
  console.log('Call Summary:', data)

  // TODO: INTÉGRATION À FAIRE ICI
  // Ajouter une entrée dans la timeline du prospect
  // addCallToTimeline(selectedDeal.id, {
  //   type: 'call',
  //   outcome: data.outcome,
  //   notes: data.notes,
  //   followupReason: data.followupReason,
  //   followupReasonOther: data.followupReasonOther,
  //   followupDate: data.followupDate,
  //   timestamp: new Date().toISOString()
  // })
}
```

## 🎨 Feedback Visuel Suggéré

### Couleurs par Outcome

```typescript
const outcomeColors = {
  won: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    icon: CheckCircle2
  },
  followup: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    icon: Clock
  },
  lost: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: XCircle
  }
}
```

### Structure de Carte Timeline Suggérée

```jsx
<div className={cn(
  'rounded-lg p-4 border',
  outcomeColors[outcome].bg,
  outcomeColors[outcome].border
)}>
  <div className="flex items-start gap-3">
    <Icon className={cn('h-5 w-5', outcomeColors[outcome].text)} />
    <div className="flex-1">
      <p className={cn('font-semibold', outcomeColors[outcome].text)}>
        {outcomeLabels[outcome]}
      </p>
      <p className="text-sm text-slate-400 mt-1">{notes}</p>
      {outcome === 'followup' && (
        <div className="mt-2 text-xs text-slate-500">
          <p>📅 Reprogrammé: {new Date(followupDate).toLocaleString()}</p>
          <p>📝 Motif: {followupReason}</p>
        </div>
      )}
    </div>
  </div>
</div>
```

## 📊 Données Disponibles

L'interface `CallSummaryData` contient:

```typescript
interface CallSummaryData {
  outcome: 'won' | 'lost' | 'followup'
  notes: string
  // Follow Up
  followupReason?: string              // Si outcome === 'followup'
  followupReasonOther?: string         // Si followupReason === 'Autre'
  followupDate?: string                // Si outcome === 'followup'
  // Données financières (Vente Gagnée)
  paymentType?: 'comptant' | 'installments'      // Si outcome === 'won'
  installmentsCount?: number                      // Si paymentType === 'installments'
  installmentsFrequency?: 'mensuel' | 'trimestriel'  // Si paymentType === 'installments'
  commissionRate?: number                         // Si outcome === 'won' (requis)
  commissionSpread?: boolean                      // Si paymentType === 'installments'
}
```

### Calculs Automatiques Disponibles

Lorsque `outcome === 'won'`, les calculs suivants sont effectués automatiquement:

- **Montant par échéance** : `offerPrice / installmentsCount`
- **Commission totale** : `(offerPrice * commissionRate) / 100`
- **Commission par échéance** : `totalCommission / installmentsCount` (si `commissionSpread === true`)

## 🔄 Flux Complet

1. **Appel terminé** → `handleCallEnd` détecte si décroché
2. **Si décroché + mode standard** → Ouvre `CallSummaryModal`
3. **Utilisateur qualifie** → Remplit le formulaire
4. **Clic "Valider"** → Appelle `handleCallSummarySubmit(data)`
5. **À implémenter** → Sauvegarder dans votre système de timeline/historique
6. **Feedback** → Afficher une carte colorée dans la timeline du prospect

## 🎯 Prochaines Étapes

1. Créer un service/hook pour gérer la timeline (ex: `useTimeline` ou `timelineService`)
2. Implémenter la fonction d'ajout d'entrée
3. Mettre à jour l'UI de la timeline pour afficher les nouvelles entrées
4. Tester le flux complet depuis Dashboard et Pipeline
