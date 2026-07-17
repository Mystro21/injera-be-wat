import { createDeck, seededRandom, shuffleDeck } from './deck';
import { CaptureOption, EMPTY_STATS, GameState, MatchSettings, Player } from './models';
import { findCaptureOptions, playerPoints } from './rules';

export function createInitialGame(settings: MatchSettings, seed = Date.now()): GameState {
  const random = seededRandom(seed);
  const shuffled = shuffleDeck(createDeck(), random);
  const center = shuffled.slice(0, 4);
  const ring = shuffled.slice(4);
  const players: Player[] = Array.from({ length: settings.playerCount }, (_, index) => ({ id: `player-${index}`, name: index === 0 ? settings.playerName.trim() || 'Player' : index === 1 ? 'Teacher Mesob' : `Classmate ${index}`, isHuman: index === 0, captured: [], stats: EMPTY_STATS() }));
  const firstPlayerIndex = Math.floor(random() * players.length);
  return { ring, center, players, currentPlayerIndex: firstPlayerIndex, firstPlayerIndex, difficulty: settings.difficulty, room: settings.room, turnSeconds: settings.turnSeconds, sound: settings.sound, hints: settings.hints, reduceMotion: settings.reduceMotion, winnerIds: [], moveNumber: 0, turn: { phase: 'draw', captureOptions: [], message: `${players[firstPlayerIndex].name} begins` } };
}

export function drawCard(state: GameState, cardId: string): GameState {
  if (state.turn.phase !== 'draw') return state;
  const drawn = state.ring.find((card) => card.id === cardId);
  if (!drawn) return state;
  const next: GameState = { ...state, ring: state.ring.filter((card) => card.id !== cardId), moveNumber: state.moveNumber + 1, turn: { phase: 'choose', drawnCard: drawn, captureOptions: [], message: 'Find a match or cards that add up' } };
  next.turn.captureOptions = findCaptureOptions(next, drawn);
  return drawn.rank === 'JOKER' ? applyMove(next, 'joker-sweep') : next;
}

function finishLastDraw(state: GameState): GameState {
  if (state.ring.length > 0) return state;
  const players = state.players.map((player) => ({ ...player, captured: [...player.captured] }));
  players[state.currentPlayerIndex].captured.push(...state.center);
  const max = Math.max(...players.map((player) => playerPoints(player.captured)));
  return { ...state, center: [], players, winnerIds: players.filter((player) => playerPoints(player.captured) === max).map((player) => player.id), turn: { phase: 'game-over', captureOptions: [], message: 'The last card was drawn' } };
}

export function applyMove(state: GameState, optionChoice: string | CaptureOption | null): GameState {
  const drawn = state.turn.drawnCard;
  if (state.turn.phase !== 'choose' || !drawn) return state;
  const option = typeof optionChoice === 'object' && optionChoice ? optionChoice : typeof optionChoice === 'string' ? state.turn.captureOptions.find((item) => item.id === optionChoice) : undefined;
  if (optionChoice && !option) return state;
  const players = state.players.map((player) => ({ ...player, captured: [...player.captured], stats: { ...player.stats } }));
  const current = players[state.currentPlayerIndex];
  if (!option) {
    const withMiddle = { ...state, center: [...state.center, drawn], players, turn: { phase: 'draw' as const, captureOptions: [], message: 'Turn ended' } };
    if (state.ring.length === 0) return finishLastDraw(withMiddle);
    return { ...withMiddle, currentPlayerIndex: (state.currentPlayerIndex + 1) % players.length };
  }
  if (option.groups[0].kind === 'joker') {
    const otherCards = players.filter((_, index) => index !== state.currentPlayerIndex).flatMap((player) => player.captured);
    players.forEach((player, index) => { if (index !== state.currentPlayerIndex) player.captured = []; });
    current.captured.push(...otherCards, ...state.center, drawn);
    current.stats.jokerSweeps += 1;
    current.stats.successfulCaptures += 1;
    current.stats.largestSingleCapture = Math.max(current.stats.largestSingleCapture, option.cardCount);
    current.stats.extraTurns += state.ring.length > 0 ? 1 : 0;
    return finishLastDraw({ ...state, center: [], players, turn: { phase: 'draw', captureOptions: [], message: `${current.name} swept the table with a Joker` } });
  }
  if (option.targetPlayerId) {
    const target = players.find((player) => player.id === option.targetPlayerId);
    if (!target) return state;
    const captureIds = new Set(option.capturedCardIds);
    const captured = target.captured.filter((card) => captureIds.has(card.id));
    target.captured = target.captured.filter((card) => !captureIds.has(card.id));
    current.captured.push(...captured, drawn);
    current.stats.successfulCaptures += 1;
    current.stats.largestSingleCapture = Math.max(current.stats.largestSingleCapture, captured.length + 1);
    current.stats.extraTurns += state.ring.length > 0 ? 1 : 0;
    return finishLastDraw({ ...state, players, turn: { phase: 'draw', captureOptions: [], message: `${current.name} took ${captured.length} top pile card${captured.length === 1 ? '' : 's'} and picks again` } });
  }
  const captureIds = new Set(option.capturedCardIds);
  const captured = state.center.filter((card) => captureIds.has(card.id));
  current.captured.push(...captured, drawn);
  current.stats.successfulCaptures += 1;
  current.stats.largestSingleCapture = Math.max(current.stats.largestSingleCapture, captured.length + 1);
  current.stats.extraTurns += state.ring.length > 0 ? 1 : 0;
  return finishLastDraw({ ...state, center: state.center.filter((card) => !captureIds.has(card.id)), players, turn: { phase: 'draw', captureOptions: [], message: `${current.name} captured and picks again` } });
}

export function calculateFinalScores(state: GameState) {
  return state.players.map((player) => {
    const faceCards = player.captured.filter((card) => ['J', 'Q', 'K'].includes(card.rank)).length;
    const jokers = player.captured.filter((card) => card.rank === 'JOKER').length;
    const numberCards = player.captured.length - faceCards - jokers;
    return {
      playerId: player.id,
      name: player.name,
      cards: player.captured.length,
      numberCards,
      numberPoints: numberCards * 5,
      faceCards,
      facePoints: faceCards * 20,
      jokers,
      jokerPoints: jokers * 30,
      points: playerPoints(player.captured),
      stats: player.stats,
    };
  }).sort((a, b) => b.points - a.points);
}
export function isGameOver(state: GameState) { return state.turn.phase === 'game-over'; }
