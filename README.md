#  Assistant Week-end Bas Carbone SNCF Hackathon

---

## Présentation

**Assistant Week-end Bas Carbone** est une application web conçue pour le hackathon SNCF. Elle permet aux voyageurs de découvrir des destinations de week-end accessibles en train depuis leur ville, en mettant au cœur de l'expérience l'empreinte carbone du trajet.

L'idée : rendre le voyage bas carbone **désirable**, pas seulement raisonnable.

---

## Fonctionnalités

### Recherche filtrée
- Ville de départ parmi 6 grandes villes françaises (Paris, Lyon, Bordeaux, Lille, Marseille, Nantes)
- Slider **budget CO₂ max** (0,1 à 3,0 kg)
- Slider **durée de trajet max** (1h à 8h)
- Résultats triés du moins polluant au plus polluant

### Carte interactive
- Carte Leaflet + OpenStreetMap
- Marqueurs colorés selon l'empreinte CO₂ (vert → orange → rouge)
- Popup détaillé au survol : CO₂, durée, POIs
- Synchronisation carte ↔ cards latérales (clic sur marqueur = card active)

### Cards de destinations
- Nom, distance, durée de trajet, empreinte CO₂ avec badge coloré
- Points d'intérêt accessibles **à pied ou à vélo depuis la gare** (aucune voiture nécessaire)
- Description IA générée au clic (lazy loading — un seul appel par destination)

### Chatbot IA
- Bouton flottant  en bas à droite
- Conversation multi-tours avec mémoire du contexte
- L'IA connaît toutes les destinations chargées (POIs, CO₂, durée)
- Capable de : recommander selon les envies, décrire une ville, comparer des destinations, répondre aux questions sur le voyage

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | AngularJS 1.8.3 |
| Carte | Leaflet.js 1.9.4 + OpenStreetMap |
| Backend | Node.js + Express 4 |
| IA | Groq (LLaMA 3.1) — gratuit |
| Données | JSON statique (54 destinations) |

---

## Calcul CO₂

Les empreintes sont calculées avec le facteur d'émission officiel du train français :

```
CO₂ (kg) = distance (km) × 2,4 g/km ÷ 1000
```

Exemple — Paris → Bordeaux (585 km) :
- Train : **1,4 kg CO₂**
- Voiture : ~70 kg CO₂
- **50× moins polluant**

### Échelle de couleur

| Couleur | Seuil | Niveau |
|---|---|---|
| 🟢 Vert foncé | < 0,3 kg | Très faible |
| 🟢 Vert clair | 0,3 – 0,6 kg | Faible |
| 🟠 Orange | 0,6 – 1,0 kg | Modéré |
| 🟠 Orange foncé | 1,0 – 1,5 kg | Élevé |
| 🔴 Rouge | > 1,5 kg | Très élevé |

---

## Installation

### Prérequis
- Node.js 18+
- Un compte [Groq](https://console.groq.com) (gratuit, sans carte bancaire)

### Cloner et lancer le projet

```bash
# 1. Cloner le dépôt
git clone https://github.com/mouamar69/SNCF-Project.git
cd SNCF-Project

# 2. Installer les dépendances
npm install

# 3. Configurer la clé API
# Créer un fichier .env à la racine :
GROQ_API_KEY=gsk_...votre_clé

# 4. Lancer le serveur
npm start
# ou
node server.js

# 5. Ouvrir dans le navigateur
# http://localhost:3000
```

 Le fichier `.env` n'est pas inclus dans le dépôt (données sensibles). Il doit être créé manuellement sur chaque machine.

### Publier sur GitHub (première fois)

```bash
git init
git add index.html app.js style.css server.js package.json package-lock.json README.md data/ .gitignore
git commit -m "Initial commit — Assistant Week-end Bas Carbone"
git remote add origin https://github.com/mouamar69/SNCF-Project.git
git branch -M main
git push -u origin main
```

---

## Structure du projet

```
SNCF/
├── index.html              # Interface utilisateur (AngularJS)
├── app.js                  # Controller AngularJS (logique frontend)
├── style.css               # Design et styles
├── server.js               # Serveur Express + endpoints IA
├── package.json
├── .env                    # Clé API (ne pas commiter)
└── data/
    └── destinations.json   # 54 destinations, 6 villes de départ
```

### Endpoints API

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/cities` | Liste des villes de départ |
| GET | `/api/destinations` | Destinations filtrées (from, co2_max, hours_max) |
| POST | `/api/ai-narrative` | Description IA d'une destination |
| POST | `/api/ai-prioritize` | Réordonne les destinations selon un prompt |
| POST | `/api/chat` | Conversation avec l'assistant IA |

---

## Données

**54 destinations** réparties sur **6 villes de départ**.

Chaque destination contient :
- Coordonnées GPS
- Distance (km), durée (min), CO₂ (kg)
- Description statique
- 3 POIs minimum avec icône, nom et distance depuis la gare

### Villes de départ couvertes
Paris · Lyon · Bordeaux · Lille · Marseille · Nantes

---

## Providers IA

Le serveur détecte automatiquement la clé disponible dans `.env` :

 **Groq / LLaMA 3** (`GROQ_API_KEY`) — fallback gratuit

Si aucune clé n'est configurée, l'app fonctionne normalement sans les fonctionnalités IA (descriptions statiques uniquement).

---

## Auteur

Projet réalisé en equipe pour le hackathon SNCF 2025.
