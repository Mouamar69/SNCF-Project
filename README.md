#  Assistant Week-end Bas Carbone SNCF Hackathon

---

## Présentation

**Assistant Week-end Bas Carbone** est une application web conçue pour le hackathon EFREI Paris — Learning XP Tourisme en train (juin 2026). Elle permet aux voyageurs de découvrir des destinations de week-end accessibles en train depuis leur ville, en mettant au cœur de l'expérience l'empreinte carbone du trajet.

L'idée : rendre le voyage bas carbone **désirable**, pas seulement raisonnable.

---

## Fonctionnalités

### Recherche automatique
- Ville de départ parmi 6 grandes villes françaises (Paris, Lyon, Bordeaux, Lille, Marseille, Nantes)
- La recherche se déclenche **automatiquement** au changement de ville ou de filtre — aucun bouton à cliquer
- Filtres **Empreinte carbone** : Exemplaire (≤ 0,6 kg) · Raisonnable (≤ 1,0 kg) · Élevé (≤ 2,0 kg) · Tout voir (≤ 3,0 kg)
- Filtres **Durée** : Court (≤ 2h) · Moyen (≤ 4h) · Long (≤ 6h) · Tout (≤ 8h)
- Résultats triés du moins polluant au plus polluant, mis à jour en temps réel

### CO₂ en temps réel via l'API SNCF
- Au chargement des résultats, le CO₂ réel de chaque destination est récupéré depuis l'**API officielle SNCF** (Navitia)
- Les valeurs statiques ADEME sont automatiquement remplacées par les données réelles
- Les destinations dépassant le budget CO₂ après correction sont retirées automatiquement
- La liste se re-trie après chaque mise à jour

### Carte interactive
- Carte Leaflet + OpenStreetMap
- Marqueurs colorés selon l'empreinte CO₂ réelle (vert → orange → rouge)
- Légende visible en haut à gauche de la carte
- Popup détaillé au clic : CO₂ réel, durée, POIs
- Synchronisation carte ↔ cards latérales

### Cards de destinations
- Bordure gauche colorée selon le niveau de CO₂ (mise à jour automatique avec la valeur réelle)
- Badge CO₂, durée, distance
- Points d'intérêt accessibles **à pied ou à vélo depuis la gare** (aucune voiture nécessaire)
- Description IA poétique générée au clic (lazy loading)

### Prochains trains SNCF
- Au clic sur une destination, affichage des **prochains départs en temps réel**
- Heure de départ, heure d'arrivée, durée, type de train (TGV, OUIGO, Intercités…)
- CO₂ officiel SNCF par trajet, affiché avec le code couleur

### Chatbot IA
- Bouton flottant en bas à droite
- Conversation multi-tours avec mémoire du contexte
- L'IA connaît toutes les destinations chargées (POIs, CO₂, durée)
- Capable de : recommander selon les envies, décrire une ville, comparer des destinations

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | AngularJS 1.8.3 |
| Carte | Leaflet.js 1.9.4 + OpenStreetMap |
| Backend | Node.js + Express 4 |
| IA | Groq SDK (LLaMA 3.1-8b-instant) — gratuit |
| Données | JSON statique (54 destinations) |
| API transport | API SNCF / Navitia |
| API carbone | API Impact CO₂ — ADEME |

---

## Rôle des APIs

### API SNCF (Navitia)
- Localise les gares par nom de ville
- Retourne les **prochains trains** en temps réel (horaires, durée)
- Identifie le **type de train** sur chaque trajet (TGV, TER, OUIGO, Intercités…)

### API Impact CO₂ (ADEME)
- Reçoit le type de train et la distance
- Retourne le **CO₂ officiel** par type de matériel roulant

> La SNCF dit **quel train** circule. L'ADEME dit **combien ça pollue**.

---

## Calcul CO₂

Le CO₂ affiché est calculé en **deux étapes** :

**1. Valeur initiale (JSON statique)** — formule ADEME générique :
```
CO₂ (kg) = distance (km) × 2,4 g/km ÷ 1000
```

**2. Valeur réelle (APIs)** — au chargement des résultats :
- L'API SNCF identifie le type de train (ex: TGV, TER)
- L'API ADEME retourne le CO₂ officiel pour ce type sur cette distance
- La valeur initiale est remplacée automatiquement

| Type de train | CO₂ / 100 km |
|---|---|
| TGV / OUIGO | 0,23 kg |
| Intercités | 0,58 kg |
| TER / Régional | 2,29 kg |

Exemple — Paris → Lyon (TGV, 465 km) :
- Train : **~1,07 kg CO₂** (valeur réelle ADEME)
- Voiture : ~56 kg CO₂
- **50× moins polluant**

### Échelle de couleur

| Couleur | Seuil | Niveau |
|---|---|---|
| Vert foncé | < 0,3 kg | Très faible |
| Vert clair | 0,3 – 0,6 kg | Faible |
| Orange | 0,6 – 1,0 kg | Modéré |
| Rouge | 1,0 – 1,5 kg | Élevé |
| Rouge | > 1,5 kg | Très élevé |

---

## Installation

### Prérequis
- Node.js 18+
- Un compte [Groq](https://console.groq.com) (gratuit, sans carte bancaire)
- Une clé API SNCF (Navitia)
- Une clé API ADEME (Impact CO₂) — gratuite sur [impactco2.fr](https://impactco2.fr/doc/api)

### Cloner et lancer le projet

```bash
# 1. Cloner le dépôt
git clone https://github.com/mouamar69/SNCF-Project.git
cd SNCF-Project

# 2. Installer les dépendances
cd back
npm install

# 3. Créer le fichier back/.env
GROQ_API_KEY=gsk_...votre_clé_groq
SNCF_API_KEY=...votre_clé_navitia
ADEME_API_KEY=...votre_clé_ademe

# 4. Lancer le serveur
npm start

# 5. Ouvrir dans le navigateur
# http://localhost:3000
```

Le fichier `.env` n'est pas inclus dans le dépôt. Il doit être créé manuellement sur chaque machine.

---

## Structure du projet

```
SNCF-Project/
├── front/
│   ├── index.html          # Interface utilisateur (AngularJS)
│   ├── app.js              # Controller AngularJS (logique frontend)
│   └── style.css           # Design et styles
├── back/
│   ├── server.js           # Serveur Express + endpoints API
│   ├── package.json
│   ├── .env                # Clés API (ne pas commiter)
│   └── data/
│       └── destinations.json  # 54 destinations, 6 villes de départ
├── README.md
└── .gitignore
```

### Endpoints API

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/cities` | Liste des villes de départ |
| GET | `/api/destinations` | Destinations filtrées (from, co2_max, hours_max) |
| GET | `/api/sncf-journey` | Prochains trains + CO₂ réel SNCF (from, to) |
| POST | `/api/ai-narrative` | Description IA d'une destination |
| POST | `/api/ai-prioritize` | Réordonne les destinations selon un prompt |
| POST | `/api/chat` | Conversation avec l'assistant IA |

---

## Données

**54 destinations** réparties sur **6 villes de départ**.

Chaque destination contient :
- Coordonnées GPS
- Distance (km), durée (min), CO₂ estimé (kg)
- Description statique
- 3 POIs minimum avec nom et distance depuis la gare

### Villes de départ couvertes
Paris · Lyon · Bordeaux · Lille · Marseille · Nantes

---

## Mode dégradé

- Toutes les données (destinations, POI, CO₂ estimé) sont en **JSON statique local** — la démo fonctionne sans connexion externe
- Si la clé Groq est absente, l'app bascule sur les **descriptions statiques** pré-rédigées
- Si l'API SNCF est indisponible, les valeurs CO₂ ADEME sont conservées
- Le chatbot affiche un message explicite si le service IA est indisponible

---

## Auteur

Projet réalisé en équipe (THE FIVE) pour le hackathon EFREI Paris Learning XP Tourisme en train, juin 2026.

Membres : Mouamar ADJAHO · Mouhamadou WAGUE · Rose-Irène BITEGHE BENGONO · Darrel NGADJUI MEZOU · Yvan ONGOLO ONGOLO
