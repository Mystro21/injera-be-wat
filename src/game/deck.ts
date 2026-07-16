import { Card, RANKS, SUITS } from './models';

export const rankValue = (rank: Card['rank']): number | null => {
  if (rank === 'A') return 1;
  if (/^\d+$/.test(rank)) return Number(rank);
  return null;
};

export function createDeck(): Card[] {
  const deck: Card[] = [1, 2].flatMap((deckNumber) => SUITS.flatMap((suit) => RANKS.map((rank) => ({ id: `deck-${deckNumber}-${suit}-${rank}`, suit, rank, value: rankValue(rank) }))));
  deck.push(
    { id: 'joker-red', suit: 'joker', rank: 'JOKER', value: null },
    { id: 'joker-black', suit: 'joker', rank: 'JOKER', value: null },
  );
  return deck;
}

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}

export function shuffleDeck<T>(items: T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}
