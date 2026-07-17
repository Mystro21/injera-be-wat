import { GameState, MatchSettings } from './models';
import { findCaptureOptions } from './rules';
const GAME_KEY = 'injera-be-wat-match-v3-two-decks';
const SETTINGS_KEY = 'injera-be-wat-settings-v3';
export const saveGame = (game: GameState) => localStorage.setItem(GAME_KEY, JSON.stringify(game));
export const loadGame = (): GameState | null => { try { const game = JSON.parse(localStorage.getItem(GAME_KEY) || 'null') as GameState | null; if (game && !game.room) game.room = 'classic'; if (game && !game.turnSeconds) game.turnSeconds = game.room === 'rush' ? 10 : 20; if (game?.players[1] && !game.players[1].isHuman && /^Mesob 1$/.test(game.players[1].name)) game.players[1].name = 'Teacher Mesob'; if (game?.turn.phase === 'choose' && game.turn.drawnCard) game.turn.captureOptions = findCaptureOptions(game, game.turn.drawnCard); return game; } catch { return null; } };
export const clearGame = () => localStorage.removeItem(GAME_KEY);
export const saveSettings = (settings: MatchSettings) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
export const loadSettings = (fallback: MatchSettings): MatchSettings => { try { return { ...fallback, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return fallback; } };
