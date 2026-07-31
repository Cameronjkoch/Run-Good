import Anthropic from '@anthropic-ai/sdk';
import { cardToString, fullDeck, parseCard, type Card } from '@run-good/engine';

/**
 * Card recognition via the Claude API with a structured-output schema, so the
 * model can only answer with valid card codes. Swap to 'claude-haiku-4-5' for
 * cheaper (slightly less accurate) scans.
 */
export const SCAN_MODEL = 'claude-opus-5';

const ALL_CARD_CODES = fullDeck().map(cardToString);

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      items: { type: 'string', enum: ALL_CARD_CODES },
    },
  },
} as const;

export async function recognizeCards(
  base64Jpeg: string,
  count: number,
  apiKey: string,
): Promise<Card[] | null> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    timeout: 45_000,
    maxRetries: 1,
  });

  const response = await client.messages.create({
    model: SCAN_MODEL,
    max_tokens: 256,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64Jpeg },
          },
          {
            type: 'text',
            text:
              `This photo shows exactly ${count} playing card${count === 1 ? '' : 's'} for a poker scorekeeping app. ` +
              `Identify ${count === 1 ? 'it' : 'each one'}. ` +
              `Codes are rank then suit: ranks 2-9, T, J, Q, K, A; suits c (clubs), d (diamonds), h (hearts), s (spades) — e.g. "As" is the ace of spades, "Td" the ten of diamonds. ` +
              `If you cannot confidently identify exactly ${count} distinct card${count === 1 ? '' : 's'}, return an empty cards array instead of guessing.`,
          },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') return null;
  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as { cards: string[] };
    const cards = parsed.cards.map(parseCard);
    if (cards.length !== count) return null;
    if (new Set(cards).size !== cards.length) return null;
    return cards;
  } catch {
    return null;
  }
}
