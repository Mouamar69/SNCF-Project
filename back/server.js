require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const path = require("path");
const https = require("https");
const data = require("./data/destinations.json");

const SNCF_API_KEY = process.env.SNCF_API_KEY || null;
const SNCF_BASE = "api.sncf.com";

const SNCF_STATIONS = {
  "Paris":     "stop_area:SNCF:87686006",
  "Lyon":      "stop_area:SNCF:87722025",
  "Bordeaux":  "stop_area:SNCF:87581009",
  "Lille":     "stop_area:SNCF:87286005",
  "Marseille": "stop_area:SNCF:87751008",
  "Nantes":    "stop_area:SNCF:87481002"
};

function sncfGet(urlPath) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(SNCF_API_KEY + ":").toString("base64");
    const options = {
      hostname: SNCF_BASE,
      path: "/v1" + urlPath,
      headers: { Authorization: "Basic " + auth }
    };
    https.get(options, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

function nowDatetime() {
  const d = new Date();
  return d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0") + "T" +
    String(d.getHours()).padStart(2, "0") +
    String(d.getMinutes()).padStart(2, "0") +
    String(d.getSeconds()).padStart(2, "0");
}

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "../front")));
app.use(express.json());

let aiProvider = null;

if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "your_groq_api_key_here") {
  const Groq = require("groq-sdk");
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  aiProvider = {
    name: "Groq (LLaMA 3)",
    async chat(systemPrompt, messages) {
      const msgs = [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ];
      const c = await groq.chat.completions.create({ model: "llama-3.1-8b-instant", messages: msgs, max_tokens: 500, temperature: 0.8 });
      return c.choices[0].message.content.trim();
    },
    async generate(prompt) {
      const c = await groq.chat.completions.create({ model: "llama-3.1-8b-instant", messages: [{ role: "user", content: prompt }], max_tokens: 300, temperature: 0.9 });
      return c.choices[0].message.content.trim();
    }
  };
  console.log("Groq connecté (LLaMA 3)");
} else {
  console.log("Pas de clé IA — fonctionnalités IA désactivées");
}

app.get("/api/cities", (req, res) => {
  res.json(Object.keys(data.destinations));
});

app.get("/api/destinations", (req, res) => {
  const from = req.query.from || "Paris";
  const co2Max = parseFloat(req.query.co2_max) || 3.0;
  const hoursMax = parseFloat(req.query.hours_max) || 8;
  const minutesMax = hoursMax * 60;

  const allDest = data.destinations[from] || [];
  const filtered = allDest.filter(d => d.co2 <= co2Max && d.duration <= minutesMax);

  filtered.sort((a, b) => a.co2 - b.co2);

  res.json({
    from,
    fromCoords: data.cities[from] || null,
    destinations: filtered
  });
});

app.post("/api/ai-narrative", async (req, res) => {
  if (!aiProvider) return res.json({ description: null });

  const { from, destination } = req.body;
  if (!from || !destination) return res.json({ description: null });

  const h = Math.floor(destination.duration / 60);
  const m = destination.duration % 60;
  const durationStr = h > 0 ? `${h}h${m ? m.toString().padStart(2, "0") : ""}` : `${m}min`;

  const poiText = (destination.poi || [])
    .map(p => `- ${p.name} (${p.dist})`)
    .join("\n");

  const prompt = `Tu es un guide de voyage SNCF enthousiaste et poétique. Génère une description courte et captivante (2-3 phrases maximum) pour ce week-end en train depuis ${from} :

Destination : ${destination.name} — ${destination.distance} km en ${durationStr}
Empreinte carbone : seulement ${destination.co2} kg CO₂
Activités accessibles à pied ou à vélo depuis la gare :
${poiText}

Réponds uniquement avec la description, sans titre ni formatage. Style enthousiaste, évocateur, qui donne envie de partir ce week-end.`;

  try {
    let description = null;
    for (let i = 0; i < 2; i++) {
      try {
        description = await aiProvider.generate(prompt);
        break;
      } catch (e) {
        if (i === 1) throw e;
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    res.json({ description });
  } catch (err) {
    console.error("Erreur AI narrative:", err.message);
    res.json({ description: null });
  }
});

app.post("/api/ai-prioritize", async (req, res) => {
  if (!aiProvider) return res.json({ ranked: null });

  const { from, destinations, userPrompt } = req.body;
  if (!from || !destinations || !userPrompt) return res.json({ ranked: null });

  const destList = destinations
    .map((d, i) => `${i}. ${d.name} (${d.co2}kg CO₂, ${d.duration}min) — ${(d.poi || []).map(p => p.name).join(", ")}`)
    .join("\n");

  const prompt = `Un voyageur au départ de ${from} cherche : "${userPrompt}"

Destinations disponibles :
${destList}

Identifie les 5 destinations les plus adaptées à cette demande. Réponds UNIQUEMENT avec du JSON valide, sans texte autour :
{"ranked":[indices_dans_ordre_de_pertinence],"explanation":"explication courte en français (max 15 mots)"}`;

  try {
    const text = await aiProvider.generate(prompt);
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      res.json(JSON.parse(match[0]));
    } else {
      res.json({ ranked: null });
    }
  } catch (err) {
    console.error("Erreur AI prioritize:", err.message);
    res.json({ ranked: null });
  }
});

app.post("/api/chat", async (req, res) => {
  if (!aiProvider) return res.json({ reply: "Le service IA n'est pas disponible." });

  const { messages, context } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.json({ reply: null });
  }

  const { from, destinations } = context || {};

  let destContext = "";
  if (destinations && destinations.length > 0) {
    destContext = "\n\nDestinations disponibles depuis " + (from || "la ville sélectionnée") + " :\n" +
      destinations.map(d => {
        const h = Math.floor(d.duration / 60);
        const m = d.duration % 60;
        const dur = h > 0 ? `${h}h${m ? m.toString().padStart(2, "0") : ""}` : `${m}min`;
        const pois = (d.poi || []).map(p => p.name).join(", ");
        return `• ${d.name} — ${d.distance}km, ${dur}, ${d.co2}kg CO₂ | ${pois}`;
      }).join("\n");
  } else {
    destContext = "\n\nAucune destination n'est encore chargée. Invitez l'utilisateur à lancer une recherche via le panneau de filtres.";
  }

  const systemPrompt = `Tu es un assistant de voyage SNCF chaleureux et enthousiaste, spécialisé dans les week-ends bas carbone en train depuis les grandes villes françaises.${destContext}

Instructions :
- Réponds toujours en français, de façon chaleureuse et concise (3-5 phrases max, sauf si une description détaillée est demandée)
- Quand tu recommandes une destination, cite son nom exact et explique pourquoi elle correspond à la demande
- Pour une description, sois poétique et évocateur — parle des activités disponibles, des paysages, de l'ambiance
- Mets en avant l'impact positif du train : faible empreinte CO₂, pas de bouchons, arrivée en centre-ville
- Si l'utilisateur mentionne ses envies (mer, montagne, culture, gastronomie, randonnée, détente...), recommande les 1-2 destinations les mieux adaptées parmi celles disponibles
- Si on te demande de comparer des destinations, liste les points forts de chacune
- Reste factuel sur les données (CO₂, durée, distance) mais poétique sur les descriptions`;

  try {
    const reply = await aiProvider.chat(systemPrompt, messages);
    res.json({ reply });
  } catch (err) {
    console.error("Erreur chat:", err.message);
    res.json({ reply: "Désolé, une erreur s'est produite. Réessayez dans un instant." });
  }
});

app.get("/api/sncf-journey", async (req, res) => {
  if (!SNCF_API_KEY) return res.status(503).json({ error: "Clé API SNCF manquante" });

  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "Paramètres from et to requis" });

  const fromId = SNCF_STATIONS[from];
  if (!fromId) return res.status(400).json({ error: "Ville de départ inconnue" });

  try {
    const places = await sncfGet(`/coverage/sncf/places?q=${encodeURIComponent(to)}&type[]=stop_area&count=1`);
    const toId = places.places?.[0]?.id;
    if (!toId) return res.status(404).json({ error: "Destination introuvable" });

    const dt = nowDatetime();
    const journeysData = await sncfGet(`/coverage/sncf/journeys?from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(toId)}&datetime=${dt}&count=4`);

    const journeys = (journeysData.journeys || []).map(j => {
      const trainSection = j.sections?.find(s => s.type === "public_transport");
      return {
        departure: j.departure_date_time,
        arrival: j.arrival_date_time,
        duration: Math.round(j.duration / 60),
        co2: j.co2_emission ? Math.round(j.co2_emission.value) / 1000 : null,
        trainType: trainSection?.display_informations?.commercial_mode || null,
        trainNumber: trainSection?.display_informations?.trip_short_name || null
      };
    });

    res.json({ from, to, journeys });
  } catch (err) {
    console.error("Erreur SNCF API:", err.message);
    res.status(500).json({ error: "Erreur lors de l'appel à l'API SNCF" });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
