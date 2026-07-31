import { cardToString, fullDeck, parseCard, type Card } from '@run-good/engine';

/**
 * Card recognition via the Claude API, called with plain fetch (not the
 * @anthropic-ai/sdk Node SDK — it pulls in Node builtins like node:fs for its
 * CLI credential-file support, which don't exist in React Native and crash
 * the Metro bundler). Structured output constrains the model to valid card
 * codes. Swap to 'claude-haiku-4-5' for cheaper (slightly less accurate) scans.
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: SCAN_MODEL,
        max_tokens: 256,
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: SCHEMA },
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
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let message = `Claude API error (${response.status})`;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }

  const data = (await response.json()) as {
    stop_reason: string;
    content: Array<{ type: string; text?: string }>;
  };

  if (data.stop_reason === 'refusal') return null;
  const text = data.content.find((b) => b.type === 'text')?.text;
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
