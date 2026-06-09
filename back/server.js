require("dotenv").config();
const express = require("express");
const path = require("path");
const data = require("./data/destinations.json");

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "../front")));
app.use(express.json());

// IA provider : Google Gemini (priorité) ou Groq (fallback)
let aiProvider = null;

if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY !== "your_google_api_key_here") {
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  aiProvider = {
    name: "Google Gemini",
    async chat(systemPrompt, messages) {
      const history = messages.slice(0, -1).map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));
      const chat = model.startChat({
        history,
        systemInstruction: { parts: [{ text: systemPrompt }] }
      });
      const result = await chat.sendMessage(messages[messages.length - 1].content);
      return result.response.text().trim();
    },
    async generate(prompt) {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    }
  };
  console.log("✅ Google Gemini connecté");
} else if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "your_groq_api_key_here") {
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
  console.log("✅ Groq connecté (LLaMA 3)");
} else {
  console.log("ℹ️  Pas de clé IA — fonctionnalités IA désactivées");
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
    .map(p => `- ${p.icon} ${p.name} (${p.dist})`)
    .join("\n");

  const prompt = `Tu es un guide de voyage SNCF enthousiaste et poétique. Génère une description courte et captivante (2-3 phrases maximum) pour ce week-end en train depuis ${from} :

Destination : ${destination.name} — ${destination.distance} km en ${durationStr}
Empreinte carbone : seulement ${destination.co2} kg CO₂
Activités accessibles à pied ou à vélo depuis la gare :
${poiText}

Réponds uniquement avec la description, sans titre ni formatage. Style enthousiaste, évocateur, qui donne envie de partir ce week-end.`;

  try {
    const description = await aiProvider.generate(prompt);
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
  if (!aiProvider) return res.json({ reply: "Le service IA n'est pas disponible. Ajoutez votre clé Groq dans le fichier .env (GROQ_API_KEY)." });

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
        const pois = (d.poi || []).map(p => `${p.icon} ${p.name}`).join(", ");
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

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
