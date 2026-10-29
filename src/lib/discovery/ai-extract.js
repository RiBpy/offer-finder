// Reads a fetched article or offer page with an AI model and returns the
// concrete offers it describes as structured data. Nothing is published from
// here; publish.js decides what is trustworthy enough to show.
//
// Provider: Google Gemini when GEMINI_API_KEY is set, otherwise Anthropic
// Claude when ANTHROPIC_API_KEY is set. AI_PROVIDER=gemini|anthropic forces one.
// Gemini falls back across models and a second key (GEMINI_API_KEY_2) when busy.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ApiError as GeminiApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { AVAILABILITY_TYPES, CATEGORY_IDS, DISCOUNT_TYPES, SCOPES } from "../constants.js";

// Bank pages can list hundreds of merchants, so allow long pages.
const MAX_TEXT_CHARS = 40000;
const MAX_OUTPUT_TOKENS = 16000;

export function aiProvider() {
  const forced = process.env.AI_PROVIDER;
  if (forced === "gemini" || forced === "anthropic") return forced;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return "anthropic";
  return null;
}

export function aiEnabled() {
  return aiProvider() !== null;
}

export function aiModel() {
  if (process.env.OFFER_AI_MODEL) return process.env.OFFER_AI_MODEL;
  // Flash-Lite is enough for extraction and is less often overloaded.
  return aiProvider() === "gemini" ? "gemini-flash-lite-latest" : "claude-haiku-5-5";
}

const nullableString = z.string().nullable();
// Enums are sent as described strings and checked in publish.js, so one
// unexpected value cannot fail the whole page.
const oneOf = (values, note = "") => z.string().describe(`One of: ${values.join(", ")}${note}`);

const OfferSchema = z.object({
  title: z.string().describe("Short headline, e.g. '15% off at Cinnabon with BRAC Bank cards'"),
  brandName: nullableString.describe("Brand or company running the offer"),
  businessName: nullableString.describe("Merchant where it can be used, if different from the brand"),
  description: z.string().describe("One or two sentences in English describing the offer"),
  terms: nullableString.describe("Eligibility and conditions, condensed"),
  primaryCategory: oneOf(CATEGORY_IDS),
  otherCategories: z
    .array(z.string())
    .describe(`Other categories that also fit, from: ${CATEGORY_IDS.join(", ")}. Offers at hotels or resorts always include "hotels".`),
  discountType: oneOf(DISCOUNT_TYPES),
  discountValue: z.number().nullable().describe("Percent (0-100) for percent, money amount for amount; the maximum when a range is given"),
  discountText: nullableString.describe("The discount as stated, e.g. 'Up to 15% off'"),
  currency: nullableString.describe("ISO 4217 code, e.g. BDT"),
  startDate: nullableString.describe("YYYY-MM-DD, only if stated"),
  endDate: nullableString.describe("YYYY-MM-DD, only if stated; null for 'till discontinued' or unknown"),
  availabilityType: oneOf(AVAILABILITY_TYPES),
  scope: oneOf(SCOPES, " (local = specific branches/addresses; city = whole city; national = whole country; online = online only)"),
  city: nullableString,
  country: nullableString.describe("ISO 3166-1 alpha-2 code"),
  branches: z
    .array(z.object({ name: nullableString, address: z.string(), city: nullableString }))
    .describe("Physical locations listed in the source, with full street addresses as written"),
  evidenceQuote: z.string().describe("Exact sentence from the source that states the offer and, if present, its validity"),
  confidence: z.number().describe("0-1: how certain it is that this is a real, currently running consumer offer with these details"),
});

const ResultSchema = z.object({ offers: z.array(OfferSchema) });

const SYSTEM = `You extract consumer offers (discounts, cashback, buy-one-get-one, special prices) from web pages for an offers directory.

Rules:
- Only include concrete offers a shopper can use: a named brand or merchant plus a stated benefit. Skip general news, market reports, price hikes, stock-market items, job ads, loans, telecom data bundles and offers that ended.
- Only include offers available in the given region; skip offers for other countries (for example India when the region is Bangladesh).
- Never invent details. Leave a field null when the page does not state it. Dates must come from the text; resolve partial dates (e.g. "till 31 October") using the article date given.
- Seasonal offers (Iftar, Ramadan, Eid, Puja, Pohela Boishakh, Christmas, New Year, Black Friday and similar) whose season is over as of today count as ended: skip them, even when the page gives no end date.
- An offer at a hotel or resort (rooms, stays, buffets, restaurants inside the hotel, spa) belongs to "hotels" too: use "food" or another category as primary if that fits better, and list "hotels" in otherCategories.
- An article listing several separate offers yields one entry per offer.
- Write title, description and terms in English even when the page is in Bangla.
- Set confidence below 0.5 when the offer is vague, already over, or you are unsure it is a consumer offer.
- Return an empty list when the page has no offer.`;

/**
 * True for errors returned by the AI service itself (bad key, no credit,
 * quota or rate limit, overloaded model). These say nothing about the page, so
 * the caller re-queues it and stops until the service is usable again.
 */
export function isAiServiceError(err) {
  return err instanceof Anthropic.APIError || err instanceof GeminiApiError;
}

// Free Gemini keys allow ~5 requests per minute, so calls are spaced out.
// Override with AI_MIN_INTERVAL_MS (0 for paid keys).
function minIntervalMs() {
  const env = Number(process.env.AI_MIN_INTERVAL_MS);
  if (Number.isFinite(env) && env >= 0 && process.env.AI_MIN_INTERVAL_MS !== "") return env;
  return aiProvider() === "gemini" ? 13000 : 0;
}

let lastCallAt = 0;
async function paced(fn) {
  const wait = lastCallAt + minIntervalMs() - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
  return fn();
}

/** Best human-readable message from either SDK's error. */
export function aiErrorMessage(err) {
  if (err instanceof Anthropic.APIError) return err.error?.error?.message || err.message;
  return err.message;
}

function userPrompt({ url, title, text, publishedAt, today, region }) {
  const body = text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;
  return [
    `Region: ${region.name} (country code ${region.country}, timezone ${region.timezone})`,
    `Today: ${today}`,
    `Page URL: ${url}`,
    `Page title: ${title || "(none)"}`,
    `Published: ${publishedAt ? publishedAt.toISOString().slice(0, 10) : "unknown"}`,
    "",
    "<page_text>",
    body,
    "</page_text>",
  ].join("\n");
}

// --- Gemini -------------------------------------------------------------------

// Gemini takes a plain JSON Schema; drop the $schema marker zod adds.
const { $schema, ...GEMINI_SCHEMA } = z.toJSONSchema(ResultSchema);

// Free models are often "experiencing high demand" one at a time, and each key
// has its own rate limits, so a busy model or key falls through to the next.
// OFFER_AI_FALLBACK_MODELS (comma-separated) replaces the default fallbacks.
const DEFAULT_GEMINI_FALLBACKS = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-flash-latest"];

function geminiKeys() {
  return [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter(Boolean);
}

function geminiModels() {
  const fallbacks = process.env.OFFER_AI_FALLBACK_MODELS
    ? process.env.OFFER_AI_FALLBACK_MODELS.split(",").map((m) => m.trim()).filter(Boolean)
    : DEFAULT_GEMINI_FALLBACKS;
  return [...new Set([aiModel(), ...fallbacks])];
}

/** Errors that say this model or key can't take the request now, not that the page is bad. */
function geminiShouldTryNext(err) {
  if (err instanceof GeminiApiError) return [401, 403, 404, 429, 500, 502, 503, 504].includes(err.status);
  return err?.name === "AbortError" || err?.name === "TimeoutError";
}

const geminiClients = new Map();

function geminiClient(apiKey) {
  if (!geminiClients.has(apiKey)) {
    // No SDK retries: a busy model is skipped for the next model or key instead.
    geminiClients.set(apiKey, new GoogleGenAI({ apiKey, httpOptions: { timeout: 45_000, retryOptions: { attempts: 1 } } }));
  }
  return geminiClients.get(apiKey);
}

async function extractWithGemini(page) {
  let lastErr;
  for (const model of geminiModels()) {
    for (const apiKey of geminiKeys()) {
      try {
        return await extractWithGeminiModel(page, model, apiKey);
      } catch (err) {
        if (!geminiShouldTryNext(err)) throw err;
        lastErr = err;
      }
    }
  }
  throw lastErr;
}

async function extractWithGeminiModel(page, model, apiKey) {
  const response = await geminiClient(apiKey).models.generateContent({
    model,
    contents: userPrompt(page),
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseJsonSchema: GEMINI_SCHEMA,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  });
  const usage = {
    input_tokens: response.usageMetadata?.promptTokenCount ?? 0,
    output_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
  const finish = response.candidates?.[0]?.finishReason;
  if (finish === "SAFETY" || finish === "PROHIBITED_CONTENT" || response.promptFeedback?.blockReason) {
    return { offers: [], usage, refused: true };
  }
  let data;
  try {
    data = JSON.parse(response.text ?? "");
  } catch {
    throw new Error(`Gemini returned invalid JSON (finish reason ${finish})`);
  }
  const parsed = ResultSchema.safeParse(data);
  if (!parsed.success) throw new Error(`Gemini output did not match the schema: ${parsed.error.issues[0]?.message}`);
  return { offers: parsed.data.offers, usage, refused: false, model };
}

// --- Anthropic ----------------------------------------------------------------

let anthropic;

async function extractWithClaude(page) {
  anthropic ??= new Anthropic({ maxRetries: 2, timeout: 60_000 });
  const response = await anthropic.messages.parse({
    model: aiModel(),
    max_tokens: MAX_OUTPUT_TOKENS,
    output_config: { effort: "low", format: zodOutputFormat(ResultSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt(page) }],
  });
  if (response.stop_reason === "refusal") return { offers: [], usage: response.usage, refused: true };
  return { offers: response.parsed_output?.offers ?? [], usage: response.usage, refused: false };
}

/**
 * @returns {Promise<{ offers: object[], usage: { input_tokens, output_tokens }|null, refused: boolean, model?: string }>}
 */
export async function extractOffersWithAi(page) {
  return paced(() => (aiProvider() === "gemini" ? extractWithGemini(page) : extractWithClaude(page)));
}
