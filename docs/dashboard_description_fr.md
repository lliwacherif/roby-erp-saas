# Tableau de Bord (Dashboard / KPI)

Le tableau de bord (KPI Page) sert de centre de commandement principal pour l'application ROBY. Il offre une vue d'ensemble macroscopique et en temps réel de la santé financière, des opérations et de l'état des stocks de l'entreprise.

Les données affichées sont dynamiquement filtrées par la **période sélectionnée** via le sélecteur situé en haut de la page.

---

## 1. Sélecteur de Période (En-tête)
- **Rôle :** Permet de modifier la plage temporelle d'analyse de toutes les métriques financières.
- **Options disponibles :**
  - **Semaine** (Les 7 derniers jours)
  - **Mois** (Du 1er jour du mois en cours jusqu'à aujourd'hui)
  - **Trimestre** (Le trimestre en cours)
  - **Année** (L'année civile en cours)
  - **Tout** (Toutes les données historiques depuis la création)

---

## 2. Cartes Principales de Performance (Top KPI Cards)
Ces quatre cartes mettent en évidence les chiffres les plus critiques de l'entreprise :

1. **Revenus Totaux (Total Earnings) :**
   - **Description :** La somme totale de l'argent généré.
   - **Sous-détails :** Sépare visuellement le montant généré par les *Ventes directes (Sales)* et celui généré par les *Locations (Rentals)*.
2. **Dépenses Totales (Total Expenses) :**
   - **Description :** Le total des sorties d'argent.
   - **Composition :** Cela inclut le total des `Dépenses` enregistrées dans le système **additionné** au total des `Salaires` versés aux ouvriers sur la période.
3. **Bénéfice Net (Net Profit) :**
   - **Description :** Revenus Totaux moins Dépenses Totales.
   - **Visuel :** S'affiche en vert (positif) ou en rouge avec un signe `-` (négatif) pour évaluer immédiatement la rentabilité.
4. **Valeur du Stock (Stock Value) :**
   - **Description :** La valorisation financière du stock total de l'entrepôt.
   - **Calcul :** Multiplie la `Quantité en Main (qte_on_hand)` de chaque article par son `Prix d'Achat (prix_achat)`. Cette valeur est brute, indépendamment de la période choisie.

---

## 3. Aperçu de la Période (P&L Breakdown)
Une section concentrée (Profil & Perte) qui résume le ratio financier.
- **Bloc Vert :** Rappel des revenus totaux avec une flèche de tendance ascendante.
- **Bloc Rouge :** Rappel des dépenses totales avec une flèche de tendance descendante.
- **Bloc Bleu/Jaune :** Le bénéfice net mis en évidence.
- **Masse Salariale Mensuelle (Monthly Payroll) :** Un bloc dédié en bas affichant le coût salarial théorique total pour le mois (la somme des salaires de base de tous les employés actifs).

---

## 4. Statistiques Rapides (Quick Stats)
Un panneau latéral donnant des compteurs immédiats sur la capacité et le volume du compte :
- **Articles :** Nombre total de produits uniques référencés dans le catalogue.
- **Clients :** Nombre total de fiches clients enregistrées.
- **Services :** Nombre de "Services" (ventes ou locations confirmées) effectués sur la période sélectionnée.
- **Ouvriers :** Nombre d'employés inscrits.

---

## 5. Alertes de Stock Faible (Low Stock Alert)
- **Rôle :** Agit comme un avertissement pour le réapprovisionnement.
- **Mécanique :** Scanne l'inventaire en temps réel. Tout article dont la `quantité en main` tombe à **5 ou moins** est affiché ici.
- **Affichage :** Affiche le nom de l'article avec un badge indiquant la quantité restante (Badge rouge vif si la quantité est à 0 ou négative, orange si entre 1 et 5).

---

## 6. Services Récents (Recent Services)
- **Rôle :** Journal d'activité rapide.
- **Mécanique :** Affiche les 5 derniers services (factures de Vente ou Location) confirmés, triés du plus récent au plus ancien.
- **Détails affichés :** 
  - Le nom du Client associé.
  - Le type de transaction (Vente ou Location).
  - La date de validation.
  - Le montant total facturé.
