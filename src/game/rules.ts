import { Card, CaptureGroup, CaptureOption, GameState } from './models';

export function findRankMatches(drawn: Card, middle: Card[]): Card[] {
  if (drawn.rank === 'JOKER') return [];
  return middle.filter((card) => card.rank === drawn.rank);
}

export function findAdditionGroups(drawn: Card, middle: Card[], limit = 512): Card[][] {
  if (drawn.value === null) return [];
  const numeric = middle.filter((card) => card.value !== null && card.value <= drawn.value!);
  const groups: Card[][] = [];
  const walk = (start: number, total: number, chosen: Card[]) => {
    if (groups.length >= limit) return;
    if (total === drawn.value) { if (chosen.length >= 2) groups.push([...chosen]); return; }
    for (let index = start; index < numeric.length; index += 1) {
      const card = numeric[index]; const next = total + (card.value ?? 0);
      if (next > drawn.value!) continue;
      chosen.push(card); walk(index + 1, next, chosen); chosen.pop();
      if (groups.length >= limit) return;
    }
  };
  walk(0, 0, []);
  return groups;
}

export const findAdditionPairs = (drawn: Card, middle: Card[]): Card[][] => findAdditionGroups(drawn, middle).filter((cards) => cards.length === 2);

function middleCaptureGroups(drawn: Card, middle: Card[]): CaptureGroup[] {
  const groups: CaptureGroup[] = findRankMatches(drawn, middle).map((card) => ({
    id: `match-${card.id}`,
    kind: 'match',
    cardIds: [card.id],
    label: `Match ${card.rank}`,
  }));
  findAdditionGroups(drawn, middle).forEach((cards, index) => groups.push({
    id: `add-${index}`,
    kind: 'add',
    cardIds: cards.map((card) => card.id),
    label: cards.map((card) => card.rank).join(' + '),
  }));
  return groups;
}

function optionFromGroups(groups: CaptureGroup[], id: string): CaptureOption {
  const capturedCardIds = groups.flatMap((group) => group.cardIds);
  return { id, groups, capturedCardIds, label: groups.map((group) => group.label).join(' • '), cardCount: capturedCardIds.length + 1 };
}

function largestDisjointGroupSet(groups: CaptureGroup[]): CaptureGroup[] {
  const ordered = [...groups].sort((a, b) => b.cardIds.length - a.cardIds.length);
  let best: CaptureGroup[] = [];
  let visited = 0;
  const walk = (index: number, chosen: CaptureGroup[], used: Set<string>) => {
    if (++visited > 50000) return;
    if (used.size > new Set(best.flatMap((group) => group.cardIds)).size) best = [...chosen];
    if (index >= ordered.length) return;
    for (let next = index; next < ordered.length; next += 1) {
      const group = ordered[next];
      if (group.cardIds.some((id) => used.has(id))) continue;
      group.cardIds.forEach((id) => used.add(id));
      chosen.push(group);
      walk(next + 1, chosen, used);
      chosen.pop();
      group.cardIds.forEach((id) => used.delete(id));
    }
  };
  walk(0, [], new Set());
  return best;
}

function partitionAdditionCards(cards: Card[], target: number): Card[][] | undefined {
  if (!cards.length) return [];
  const first = cards[0];
  let answer: Card[][] | undefined;
  const findGroup = (index: number, chosen: Card[], total: number) => {
    if (answer || total > target) return;
    if (total === target && chosen.length >= 2) {
      const chosenIds = new Set(chosen.map((card) => card.id));
      const rest = cards.filter((card) => !chosenIds.has(card.id));
      const remainder = partitionAdditionCards(rest, target);
      if (remainder) answer = [chosen, ...remainder];
      return;
    }
    for (let next = index; next < cards.length; next += 1) {
      const card = cards[next];
      findGroup(next + 1, [...chosen, card], total + (card.value ?? 0));
    }
  };
  findGroup(1, [first], first.value ?? 0);
  return answer;
}

export function findCaptureOptions(state: GameState, drawn: Card): CaptureOption[] {
  if (drawn.rank === 'JOKER') {
    const opponentCards = state.players.filter((_, index) => index !== state.currentPlayerIndex).flatMap((player) => player.captured);
    const ids = [...state.center, ...opponentCards].map((card) => card.id);
    return [{ id: 'joker-sweep', groups: [{ id: 'joker', kind: 'joker', cardIds: ids, label: 'Joker sweep' }], capturedCardIds: ids, label: 'Joker sweep', cardCount: ids.length + 1 }];
  }
  const options: CaptureOption[] = [];
  const currentPile = state.players[state.currentPlayerIndex].captured;
  const pileTop = currentPile[currentPile.length - 1];
  if (pileTop?.rank === drawn.rank) {
    const group: CaptureGroup = { id: `pile-match-${drawn.rank}`, kind: 'match', cardIds: [], label: `Pile ${pileTop.rank} = ${drawn.rank}` };
    options.push({ id: group.id, groups: [group], capturedCardIds: [], label: group.label, cardCount: 1 });
  }
  state.players.forEach((player, index) => {
    if (index === state.currentPlayerIndex || !player.captured.length) return;
    const top = player.captured[player.captured.length - 1];
    if (top.rank !== drawn.rank) return;
    const stack: Card[] = [];
    for (let cardIndex = player.captured.length - 1; cardIndex >= 0 && player.captured[cardIndex].rank === drawn.rank; cardIndex -= 1) stack.unshift(player.captured[cardIndex]);
    const group: CaptureGroup = { id: `take-pile-${player.id}-${drawn.rank}`, kind: 'match', cardIds: stack.map((card) => card.id), label: `Take ${player.name}'s ${drawn.rank} stack`, targetPlayerId: player.id };
    options.push({ id: group.id, groups: [group], capturedCardIds: group.cardIds, targetPlayerId: player.id, label: group.label, cardCount: stack.length + 1 });
  });
  const middleGroups = middleCaptureGroups(drawn, state.center);
  middleGroups.forEach((group) => options.push(optionFromGroups([group], group.id)));
  const largestSet = largestDisjointGroupSet(middleGroups);
  if (largestSet.length > 1) options.push(optionFromGroups(largestSet, `multi-${largestSet.map((group) => group.id).join('-')}`));
  return options.sort((a, b) => b.cardCount - a.cardCount);
}

export function optionForSelection(options: CaptureOption[], selectedIds: string[]): CaptureOption | undefined {
  const key = [...selectedIds].sort().join('|');
  return options.find((option) => [...option.capturedCardIds].sort().join('|') === key);
}

export function captureForSelection(state: GameState, selectedIds: string[]): CaptureOption | undefined {
  const existing = optionForSelection(state.turn.captureOptions, selectedIds);
  if (existing) return existing;
  const drawn = state.turn.drawnCard;
  if (!drawn || !selectedIds.length || new Set(selectedIds).size !== selectedIds.length) return undefined;
  const selected = selectedIds.map((id) => state.center.find((card) => card.id === id));
  if (selected.some((card) => !card)) return undefined;
  const cards = selected as Card[];
  const matches = cards.filter((card) => card.rank === drawn.rank);
  const additionCards = cards.filter((card) => card.rank !== drawn.rank);
  if (additionCards.some((card) => card.value === null) || (additionCards.length && drawn.value === null)) return undefined;
  const additions = additionCards.length ? partitionAdditionCards(additionCards, drawn.value!) : [];
  if (!additions) return undefined;
  const groups: CaptureGroup[] = matches.map((card) => ({ id: `match-${card.id}`, kind: 'match', cardIds: [card.id], label: `Match ${card.rank}` }));
  additions.forEach((groupCards, index) => groups.push({ id: `add-selected-${index}`, kind: 'add', cardIds: groupCards.map((card) => card.id), label: groupCards.map((card) => card.rank).join(' + ') }));
  if (!groups.length) return undefined;
  return optionFromGroups(groups, `selected-${[...selectedIds].sort().join('-')}`);
}

export function cardPoints(card: Card): number { return ['J', 'Q', 'K'].includes(card.rank) ? 20 : card.rank === 'JOKER' ? 1 : 5; }
export function playerPoints(cards: Card[]): number { return cards.reduce((total, card) => total + cardPoints(card), 0); }
