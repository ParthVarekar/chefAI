// ============================================================
// ChefAI Sidebar Chatbot — Gemini API + Local Fallback
// ============================================================

import { GoogleGenAI } from '@google/genai';
import {
    menuItems,
    comboMeals,
    todaySpecials,
    reservationSlots,
    kitchenStatuses,
} from './mockData';

// --- Types ---

export type Intent =
    | 'menu'
    | 'combo'
    | 'cheapest_combo'
    | 'best_combo'
    | 'specials'
    | 'reservation'
    | 'kitchen_status'
    | 'general';

export interface ChefAiResponse {
    intent: Intent;
    reply: string;
    data: Record<string, any>;
}

// --- Gemini Client ---

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
let ai: GoogleGenAI | null = null;

if (API_KEY) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
}

// --- System Prompt for Gemini ---

const SYSTEM_PROMPT = `You are ChefAI, a small AI assistant embedded inside a restaurant dashboard sidebar.

Your job is ONLY to answer quick restaurant-related questions from users inside the chat sidebar.

IMPORTANT BEHAVIOR RULES:
1. You are a lightweight chat assistant.
2. Keep responses SHORT.
3. Never produce long explanations.
4. Never output markdown.
5. Never output code blocks.
6. Only output a JSON object.
7. Do not add commentary outside JSON.

SUPPORTED INTENTS:
menu, combo, best_combo, cheapest_combo, specials, reservation, kitchen_status, general

OUTPUT FORMAT — Always respond with ONLY this JSON structure, nothing else:
{
  "intent": "menu | combo | best_combo | cheapest_combo | specials | reservation | kitchen_status | general",
  "reply": "Short chat response",
  "data": {}
}

RESTAURANT DATA:

Menu Items:
${menuItems.map((i) => `${i.name} — $${i.price} (${i.category})`).join('\n')}

Combo Meals:
${comboMeals.map((c) => `${c.name}: ${c.items.join(' + ')} — $${c.price}${c.popular ? ' (popular)' : ''}`).join('\n')}

Today's Specials:
${todaySpecials.map((s) => `${s.name} — $${s.price} (${s.tag})`).join('\n')}

Reservations Available:
${reservationSlots.filter((r) => r.available).map((r) => `Table for ${r.tableSize} at ${r.time}`).join('\n')}

Kitchen Status Options:
${kitchenStatuses.join('\n')}

INTENT RULES:
- "menu" → return menu items in data.menu as array of {name, price}
- "combo" → return all combos in data.combos as array of {name, items, price}
- "best_combo" → return the most popular combo in data.combo as {name, items, price}
- "cheapest_combo" → return the lowest priced combo in data.combo as {name, items, price}
- "specials" → return specials in data.specials as array of {name, price, tag}
- "reservation" → return next available slot in data as {time, table_size}
- "kitchen_status" → return short operational update, data can be empty {}
- "general" → greeting or unsupported question, data can be empty {}

FINAL RULES:
- Always return valid JSON only.
- Never return plain text, markdown, or code fences.
- Keep replies concise for sidebar display.
- Always include "intent", "reply", and "data" fields.`;

// --- Gemini API Call ---

async function callGemini(userMessage: string): Promise<ChefAiResponse | null> {
    if (!ai) return null;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: userMessage,
            config: {
                systemInstruction: SYSTEM_PROMPT,
            },
        });

        const responseText = (result.text ?? '').trim();
        if (!responseText) return null;

        // Strip markdown code fences if Gemini wraps the JSON
        let cleaned = responseText;
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
        }

        const parsed = JSON.parse(cleaned) as ChefAiResponse;

        // Validate required fields
        if (parsed.intent && parsed.reply && typeof parsed.data !== 'undefined') {
            return parsed;
        }

        return null;
    } catch (error) {
        console.warn('[ChefAI] Gemini API error, falling back to local:', error);
        return null;
    }
}

// ================================================================
// LOCAL FALLBACK — used when Gemini is unavailable or fails
// ================================================================

const intentPatterns: { intent: Intent; keywords: string[] }[] = [
    { intent: 'cheapest_combo', keywords: ['cheapest combo', 'lowest price combo', 'affordable combo', 'budget combo'] },
    { intent: 'best_combo', keywords: ['best combo', 'popular combo', 'trending combo', 'top combo', 'recommended combo'] },
    { intent: 'combo', keywords: ['combo', 'bundle', 'meal deal', 'combo meal', 'combos'] },
    { intent: 'specials', keywords: ['special', 'specials', "today's special", 'deal', 'offer', 'today special', 'promotion', 'promo'] },
    { intent: 'menu', keywords: ['menu', 'food', 'items', 'dishes', 'what do you serve', 'what can i eat', "what's available", 'order', 'what food'] },
    { intent: 'reservation', keywords: ['reservation', 'reserve', 'table', 'booking', 'book a table', 'seat', 'availability', 'seating'] },
    { intent: 'kitchen_status', keywords: ['kitchen', 'status', 'how is the kitchen', 'kitchen running', 'prep time', 'busy'] },
];

function detectIntent(message: string): Intent {
    const lower = message.toLowerCase().trim();
    for (const pattern of intentPatterns) {
        for (const keyword of pattern.keywords) {
            if (lower.includes(keyword)) {
                return pattern.intent;
            }
        }
    }
    return 'general';
}

function localFallback(userMessage: string): ChefAiResponse {
    const intent = detectIntent(userMessage);

    switch (intent) {
        case 'menu':
            return {
                intent: 'menu',
                reply: "Here's what's currently available on the menu.",
                data: { menu: menuItems.map((i) => ({ name: i.name, price: i.price })) },
            };
        case 'combo':
            return {
                intent: 'combo',
                reply: 'Here are our combo meal deals.',
                data: { combos: comboMeals.map((c) => ({ name: c.name, items: c.items, price: c.price })) },
            };
        case 'cheapest_combo': {
            const cheapest = [...comboMeals].sort((a, b) => a.price - b.price)[0];
            return {
                intent: 'cheapest_combo',
                reply: `The cheapest combo is the ${cheapest.name} at just $${cheapest.price}.`,
                data: { combo: { name: cheapest.name, items: cheapest.items, price: cheapest.price } },
            };
        }
        case 'best_combo': {
            const best = comboMeals.find((c) => c.popular) || comboMeals[0];
            return {
                intent: 'best_combo',
                reply: `The ${best.name} is trending today.`,
                data: { combo: { name: best.name, items: best.items, price: best.price } },
            };
        }
        case 'specials':
            return {
                intent: 'specials',
                reply: "Here are today's specials.",
                data: { specials: todaySpecials.map((s) => ({ name: s.name, price: s.price, tag: s.tag })) },
            };
        case 'reservation': {
            const nextSlot = reservationSlots.find((s) => s.available);
            if (nextSlot) {
                return {
                    intent: 'reservation',
                    reply: `The next available reservation is at ${nextSlot.time} for a table of ${nextSlot.tableSize}.`,
                    data: { time: nextSlot.time, table_size: nextSlot.tableSize },
                };
            }
            return {
                intent: 'reservation',
                reply: "Sorry, we're fully booked for tonight. Try again tomorrow.",
                data: {},
            };
        }
        case 'kitchen_status': {
            const status = kitchenStatuses[Math.floor(Math.random() * kitchenStatuses.length)];
            return { intent: 'kitchen_status', reply: status, data: {} };
        }
        case 'general':
        default:
            return {
                intent: 'general',
                reply: 'Hi! I can help with menu items, combo deals, reservations, or kitchen status.',
                data: {},
            };
    }
}

// --- Main Entry Point (now async) ---

export async function processMessage(userMessage: string): Promise<ChefAiResponse> {
    // Try Gemini first
    const geminiResponse = await callGemini(userMessage);
    if (geminiResponse) {
        return geminiResponse;
    }

    // Fallback to local intent detection + mock data
    return localFallback(userMessage);
}
