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

// --- Response Cache (5-minute TTL) ---

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const responseCache = new Map<string, { response: ChefAiResponse; timestamp: number }>();

function getCachedResponse(key: string): ChefAiResponse | null {
    const entry = responseCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        responseCache.delete(key);
        return null;
    }
    return entry.response;
}

function setCachedResponse(key: string, response: ChefAiResponse): void {
    // Cap cache size to prevent memory leaks
    if (responseCache.size > 100) {
        const oldest = responseCache.keys().next().value;
        if (oldest) responseCache.delete(oldest);
    }
    responseCache.set(key, { response, timestamp: Date.now() });
}

// --- Rate Limiter (8-second cooldown) ---

const RATE_LIMIT_MS = 8000; // 8 seconds between API calls
let lastApiCallTime = 0;

function isRateLimited(): boolean {
    return Date.now() - lastApiCallTime < RATE_LIMIT_MS;
}

// --- System Prompt for Gemini (compact to save tokens) ---

const SYSTEM_PROMPT = `You are ChefAI, a friendly restaurant assistant. Always answer helpfully. Never refuse.
Our menu: Truffle Burger $14, Classic Burger $11, Margherita Pizza $12, Pepperoni Pizza $13, Chicken Wrap $9, Caesar Salad $8, Fries $4, Coke $3, Iced Tea $3.
Combos: Burger Combo (Burger+Fries+Coke) $12 [popular], Pizza Combo (Pizza+Drink) $11, Wrap Combo (Wrap+Fries+Drink) $10.
Today's specials: Truffle Burger $12 (discounted), Pepperoni Pizza $10 (limited), Burger Combo $10 (deal).
Respond ONLY with JSON: {"intent":"general","reply":"short answer under 30 words","data":{}}
No markdown. No code fences. Be positive and helpful.`;

// --- Gemini API Call ---

async function callGemini(userMessage: string): Promise<ChefAiResponse | null> {
    if (!ai) return null;

    try {
        lastApiCallTime = Date.now();
        const result = await ai.models.generateContent({
            model: 'gemma-3-27b-it',
            contents: `${SYSTEM_PROMPT}\n\nUser: ${userMessage}`,
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
    { intent: 'cheapest_combo', keywords: ['cheapest combo', 'lowest price combo', 'affordable combo', 'budget combo', 'cheap combo'] },
    { intent: 'best_combo', keywords: ['best combo', 'popular combo', 'trending combo', 'top combo', 'recommended combo', 'favourite combo', 'favorite combo'] },
    { intent: 'combo', keywords: ['combo', 'bundle', 'meal deal', 'combo meal', 'combos'] },
    { intent: 'specials', keywords: ['special', 'specials', "today's special", 'deal', 'offer', 'today special', 'promotion', 'promo', 'discount', 'sale'] },
    { intent: 'menu', keywords: ['menu', 'food', 'items', 'dishes', 'what do you serve', 'what can i eat', "what's available", 'order', 'what food', 'topping', 'toppings', 'ingredient', 'ingredients', 'pizza', 'burger', 'wrap', 'salad', 'fries', 'drink', 'beverage', 'coke', 'tea'] },
    { intent: 'reservation', keywords: ['reservation', 'reserve', 'table', 'booking', 'book a table', 'seat', 'availability', 'seating', 'book'] },
    { intent: 'kitchen_status', keywords: ['kitchen', 'status', 'how is the kitchen', 'kitchen running', 'prep time', 'busy', 'wait time', 'how long'] },
    { intent: 'best_combo', keywords: ['best', 'popular', 'trending', 'top', 'recommend', 'recommended', 'favourite', 'favorite', 'what should i', 'suggest', 'good'] },
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
        default: {
            // Never say "no" — always give a helpful suggestion
            const lower = userMessage.toLowerCase();
            const best = comboMeals.find((c) => c.popular) || comboMeals[0];
            const topSpecial = todaySpecials[0];

            if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey')) {
                return {
                    intent: 'general',
                    reply: `Hey there! 👋 Our ${best.name} is trending today — want to check it out?`,
                    data: { suggestion: { name: best.name, price: best.price } },
                };
            }

            if (lower.includes('thank') || lower.includes('bye') || lower.includes('later')) {
                return {
                    intent: 'general',
                    reply: 'You\'re welcome! Enjoy your meal! 🍽️',
                    data: {},
                };
            }

            // Default: always suggest something useful
            return {
                intent: 'general',
                reply: `Great question! I'd recommend our ${best.name} ($${best.price}) — it's a fan favorite. We also have ${topSpecial.name} on special for $${topSpecial.price} today!`,
                data: {
                    suggestion: { name: best.name, price: best.price },
                    special: { name: topSpecial.name, price: topSpecial.price },
                },
            };
        }
    }
}

// --- Main Entry Point (API-first, local fallback when unavailable) ---

export async function processMessage(userMessage: string): Promise<ChefAiResponse> {
    // Step 1: Check cache first
    const cacheKey = userMessage.toLowerCase().trim();
    const cached = getCachedResponse(cacheKey);
    if (cached) {
        console.log('[ChefAI] Cache hit — skipping API call');
        return cached;
    }

    // Step 2: If rate limited, use local fallback
    if (isRateLimited()) {
        console.log('[ChefAI] Rate limited — using local fallback');
        return localFallback(userMessage);
    }

    // Step 3: Try Gemini API first for ALL queries
    const geminiResponse = await callGemini(userMessage);
    if (geminiResponse) {
        setCachedResponse(cacheKey, geminiResponse);
        return geminiResponse;
    }

    // Step 4: Local fallback only when API is unavailable
    return localFallback(userMessage);
}
