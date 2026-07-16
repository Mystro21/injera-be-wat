import { CaptureOption, Difficulty, GameState } from './models';

export function chooseAICard(state: GameState, random: () => number = Math.random): string {
  return state.ring[Math.floor(random() * state.ring.length)]?.id ?? '';
}

export function chooseAIMove(state: GameState, difficulty: Difficulty = state.difficulty, random: () => number = Math.random): CaptureOption | null {
  const options = state.turn.captureOptions;
  if (!options.length) return null;
  if (difficulty === 'easy') {
    if (random() < 0.18) return null;
    return options[Math.floor(random() * options.length)];
  }
  return [...options].sort((a, b) => score(b) - score(a))[0];
  function score(option: CaptureOption) {
    let value = option.cardCount * (difficulty === 'hard' ? 10 : 5);
    if (option.groups.some((group) => group.kind === 'joker')) value += 20;
    return value;
  }
}
