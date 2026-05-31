// ══════════════════════════════════════════════════════
//  MANGAFORGE AI SERVER — Mistral + Gemini
//  Déploiement : Render.com
// ══════════════════════════════════════════════════════

require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors({
  origin: [
    'https://marcelaagbassi-create.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    '*'  // Retirer en production si nécessaire
  ]
}));
app.use(express.json({ limit: '10mb' }));

// ── Clients IA ──
const { Mistral } = require('@mistralai/mistralai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const gemini  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ══════════════════════════════════════════════════════
//  ROUTE PRINCIPALE — /api/chat
// ══════════════════════════════════════════════════════
app.post('/api/chat', async (req, res) => {
  const { messages, system, provider = 'mistral', model } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages[] requis' });
  }

  try {
    let response = '';

    if (provider === 'gemini') {
      // ── Gemini ──
      const modelName = model || 'gemini-1.5-flash';
      const geminiModel = gemini.getGenerativeModel({
        model: modelName,
        systemInstruction: system || 'Tu es un assistant créatif spécialisé en manga. Tu parles en français.'
      });

      // Convertir le format messages → Gemini
      const history = messages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      const lastMsg = messages[messages.length - 1].content;

      const chat = geminiModel.startChat({ history });
      const result = await chat.sendMessage(lastMsg);
      response = result.response.text();

    } else {
      // ── Mistral (défaut) ──
      const modelName = model || 'mistral-small-latest';
      const allMessages = system
        ? [{ role: 'system', content: system }, ...messages]
        : messages;

      const result = await mistral.chat.complete({
        model: modelName,
        messages: allMessages
      });
      response = result.choices[0].message.content;
    }

    res.json({ content: response, provider });

  } catch (err) {
    console.error(`[AI Error - ${provider}]:`, err.message);
    res.status(500).json({
      error: `Erreur ${provider}: ${err.message}`,
      provider
    });
  }
});

// ══════════════════════════════════════════════════════
//  ROUTE CRÉATIVE — /api/creative
//  Raccourcis pour les fonctions IA de MangaForge
// ══════════════════════════════════════════════════════
app.post('/api/creative', async (req, res) => {
  const { action, data, provider = 'mistral' } = req.body;

  const prompts = {
    title:     `Génère 5 titres de manga créatifs pour cette histoire : "${data}". Retourne juste une liste numérotée.`,
    synopsis:  `Écris un synopsis accrocheur (150 mots max) pour ce manga : "${data}". Style éditorial professionnel.`,
    tags:      `Génère 8 tags/mots-clés pertinents pour ce manga : "${data}". Retourne juste les tags séparés par des virgules.`,
    character: `Crée une fiche personnage détaillée (nom, âge, personnalité, pouvoirs, backstory) pour : "${data}"`,
    dialogue:  `Écris un dialogue dramatique et percutant entre ces personnages : "${data}"`,
    worldbuild:`Développe le worldbuilding (géographie, magie, politique, culture) pour cet univers manga : "${data}"`,
    arc:       `Crée une structure d'arc narratif en 5 actes pour : "${data}"`,
    improve:   `Améliore et enrichis ce texte manga tout en gardant le style : "${data}"`
  };

  const prompt = prompts[action];
  if (!prompt) {
    return res.status(400).json({ error: `Action inconnue: ${action}. Actions disponibles: ${Object.keys(prompts).join(', ')}` });
  }

  const system = 'Tu es un assistant créatif expert en manga et light novel japonais et africain. Tu parles toujours en français. Sois créatif, précis et inspirant.';

  try {
    let response = '';

    if (provider === 'gemini') {
      const geminiModel = gemini.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: system
      });
      const result = await geminiModel.generateContent(prompt);
      response = result.response.text();
    } else {
      const result = await mistral.chat.complete({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: prompt }
        ]
      });
      response = result.choices[0].message.content;
    }

    res.json({ content: response, action, provider });

  } catch (err) {
    console.error(`[Creative Error]:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  ROUTE SANTÉ — /health
// ══════════════════════════════════════════════════════
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'MangaForge AI Server',
    version: '1.0.0',
    providers: {
      mistral: !!process.env.MISTRAL_API_KEY,
      gemini:  !!process.env.GEMINI_API_KEY
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({ message: '⛩ MangaForge AI Server actif', docs: '/health' });
});

// ── Démarrer ──
app.listen(PORT, () => {
  console.log(`⛩ MangaForge AI Server démarré sur le port ${PORT}`);
  console.log(`Mistral: ${process.env.MISTRAL_API_KEY ? '✅' : '❌ clé manquante'}`);
  console.log(`Gemini:  ${process.env.GEMINI_API_KEY  ? '✅' : '❌ clé manquante'}`);
});
