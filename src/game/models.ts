export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

export type Suit = (typeof SUITS)[number] | 'joker';
export type Rank = (typeof RANKS)[number] | 'JOKER';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameRoom = 'classic' | 'rush';

export interface Card { id: string; suit: Suit; rank: Rank; value: number | null }
export interface MatchStatistics { successfulCaptures: number; jokerSweeps: number; largestSingleCapture: number; extraTurns: number }
export interface Player { id: string; name: string; isHuman: boolean; captured: Card[]; stats: MatchStatistics }
export interface MatchSettings { playerName: string; playerCount: 2 | 3 | 4; difficulty: Difficulty; room: GameRoom; sound: boolean; hints: boolean; reduceMotion: boolean }
export type CaptureKind = 'match' | 'add' | 'joker';
export interface CaptureGroup { id: string; kind: CaptureKind; cardIds: string[]; label: string; targetPlayerId?: string }
export interface CaptureOption { id: string; groups: CaptureGroup[]; capturedCardIds: string[]; targetPlayerId?: string; label: string; cardCount: number }
export type TurnPhase = 'draw' | 'choose' | 'game-over';
export interface TurnState { phase: TurnPhase; drawnCard?: Card; captureOptions: CaptureOption[]; message: string }
export interface GameState {
  ring: Card[]; center: Card[]; players: Player[]; currentPlayerIndex: number;
  firstPlayerIndex: number; turn: TurnState; difficulty: Difficulty;
  room: GameRoom; sound: boolean; hints: boolean; reduceMotion: boolean; winnerIds: string[]; moveNumber: number;
}

export const EMPTY_STATS = (): MatchStatistics => ({ successfulCaptures: 0, jokerSweeps: 0, largestSingleCapture: 0, extraTurns: 0 });
