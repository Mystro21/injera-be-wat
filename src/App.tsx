import { useEffect, useMemo, useState } from 'react';
import { Logo } from './components/Logo';
import { Toggle } from './components/Toggle';
import { GameBoard } from './components/GameBoard';
import { CardView } from './components/CardView';
import { TutorialOverlay } from './components/TutorialOverlay';
import { createInitialGame, drawCard, applyMove, calculateFinalScores } from './game/engine';
import { chooseAICard, chooseAIMove } from './game/ai';
import { GameState, MatchSettings } from './game/models';
import { captureForSelection } from './game/rules';
import { clearGame, loadGame, loadSettings, saveGame, saveSettings } from './game/storage';
import { useSound } from './hooks/useSound';
import { getUsernameError, normalizeUsername } from './game/username';

type Screen = 'menu' | 'setup' | 'rules' | 'credits' | 'game';
const DM_LOGO = `${import.meta.env.BASE_URL}dm-logo.png`;
const DEFAULT_SETTINGS: MatchSettings = { playerName: '', playerCount: 2, difficulty: 'medium', room: 'classic', turnSeconds: 20, sound: true, hints: true, reduceMotion: false };

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [settings, setSettings] = useState(() => loadSettings(DEFAULT_SETTINGS));
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedMiddleIds, setSelectedMiddleIds] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [notice, setNotice] = useState('');
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(DEFAULT_SETTINGS.turnSeconds);
  const sound = useSound(game?.sound ?? settings.sound);
  const savedGame = useMemo(() => loadGame(), [screen]);

  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { if (game && game.turn.phase !== 'game-over') saveGame(game); }, [game]);
  useEffect(() => { if (game) setTurnTimeLeft(game.turnSeconds); }, [game?.currentPlayerIndex, game?.turn.phase, game?.moveNumber, game?.turnSeconds]);
  useEffect(() => {
    if (!game || screen !== 'game' || paused || showTutorial || game.turn.phase === 'game-over' || !game.players[game.currentPlayerIndex].isHuman || turnTimeLeft <= 0) return;
    const timer = window.setInterval(() => setTurnTimeLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [game, screen, paused, showTutorial, turnTimeLeft]);
  useEffect(() => {
    if (!game || screen !== 'game' || paused || showTutorial || game.turn.phase === 'game-over' || !game.players[game.currentPlayerIndex].isHuman || turnTimeLeft !== 0) return;
    setTurnTimeLeft(-1);
    setSelectedMiddleIds([]);
    setNotice(game.turn.phase === 'draw' ? 'Time! A Circle card was picked for you.' : 'Time! Your turn ended with no take-back.');
    setGame((latest) => {
      if (!latest || !latest.players[latest.currentPlayerIndex].isHuman) return latest;
      if (latest.turn.phase === 'draw') return latest.ring[0] ? drawCard(latest, latest.ring[0].id) : latest;
      if (latest.turn.phase === 'choose') return applyMove(latest, null);
      return latest;
    });
  }, [game, screen, paused, showTutorial, turnTimeLeft]);
  useEffect(() => {
    if (!game || screen !== 'game' || paused || game.turn.phase === 'game-over') return;
    const current = game.players[game.currentPlayerIndex];
    if (current.isHuman) return;
    const timer = window.setTimeout(() => {
      setGame((latest) => {
        if (!latest) return latest;
        if (latest.turn.phase === 'draw') return drawCard(latest, chooseAICard(latest));
        if (latest.turn.phase === 'choose') return applyMove(latest, chooseAIMove(latest)?.id ?? null);
        return latest;
      });
      if (game.turn.phase === 'choose') sound(game.turn.captureOptions.length ? 'capture' : 'draw');
    }, game.turn.phase === 'choose' ? (game.reduceMotion ? 900 : 1800) : game.room === 'rush' ? (game.reduceMotion ? 220 : 1550) : (game.reduceMotion ? 120 : 620));
    return () => window.clearTimeout(timer);
  }, [game, screen, paused, sound]);

  const startGame = () => { if (getUsernameError(settings.playerName)) return; const readySettings = { ...settings, playerName: normalizeUsername(settings.playerName) }; setSettings(readySettings); const next = createInitialGame(readySettings); clearGame(); setGame(next); setScreen('game'); setSelectedMiddleIds([]); setShowTutorial(readySettings.hints); setNotice(''); };
  const chooseTable = (room: MatchSettings['room']) => { setSettings((current) => ({ ...current, room, turnSeconds: room === 'rush' ? 10 : 20 })); setScreen('setup'); };
  const resumeGame = () => { const restored = loadGame(); if (restored) { setGame(restored); setScreen('game'); setNotice('Match restored'); } };
  const handleDraw = (id: string) => { if (!game) return; setGame(drawCard(game, id)); setSelectedMiddleIds([]); setNotice(''); sound('draw'); };
  const toggleMiddle = (id: string) => { setSelectedMiddleIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]); setNotice(''); };
  const selectPile = (playerId: string) => { if (!game) return; const option = game.turn.captureOptions.find((item) => item.targetPlayerId === playerId); if (!option) return; setSelectedMiddleIds(option.capturedCardIds); setNotice(''); };
  const confirmMove = () => { if (!game) return; const option = captureForSelection(game, selectedMiddleIds); if (!option) { setNotice(selectedMiddleIds.length === 1 ? 'That card does not match. Try again or end your turn.' : 'Those selected cards do not add up to your picked card. Try another combination or end your turn.'); return; } setGame(applyMove(game, option)); setSelectedMiddleIds([]); setNotice(''); sound('capture'); };
  const endTurn = () => { if (!game) return; setGame(applyMove(game, null)); setSelectedMiddleIds([]); setNotice(''); sound('draw'); };
  const goMenu = () => { setPaused(false); setScreen('menu'); };
  const restartGame = () => { clearGame(); setGame(createInitialGame(settings)); setPaused(false); setConfirmForfeit(false); setSelectedMiddleIds([]); setShowTutorial(false); setNotice('Fresh deal — same settings'); };
  const startNewGame = () => { clearGame(); setGame(null); setPaused(false); setConfirmForfeit(false); setSelectedMiddleIds([]); setShowTutorial(false); setNotice(''); setScreen('setup'); };
  const forfeitGame = () => { clearGame(); setGame(null); setPaused(false); setConfirmForfeit(false); setScreen('menu'); setSelectedMiddleIds([]); setNotice(''); };

  return <div className="app-shell">
    {screen !== 'game' && <Header onHome={() => setScreen('menu')} />}
    {screen === 'menu' && <Menu onChooseTable={chooseTable} onRules={() => setScreen('rules')} onCredits={() => setScreen('credits')} canResume={!!savedGame} onResume={resumeGame} />}
    {screen === 'setup' && <Setup settings={settings} setSettings={setSettings} onStart={startGame} onBack={() => setScreen('menu')} />}
    {screen === 'rules' && <Rules onBack={() => setScreen('menu')} />}
    {screen === 'credits' && <Credits onBack={() => setScreen('menu')} />}
    {screen === 'game' && game && <GameScreen game={game} turnTimeLeft={turnTimeLeft} selectedMiddleIds={selectedMiddleIds} onMiddleSelect={toggleMiddle} onPileSelect={selectPile} onDraw={handleDraw} onConfirm={confirmMove} onEndTurn={endTurn} onPause={() => setPaused(true)} onMenu={goMenu} onRematch={() => setGame(createInitialGame(settings))} notice={notice} />}
    {paused && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal pause-modal"><span className="eyebrow">MATCH PAUSED</span><h2>The table is waiting</h2><p>Your current match is saved on this device.</p><div className="pause-game-actions"><button className="secondary-button" onClick={restartGame}><b>↻ Restart Match</b><small>Fresh deal with the same settings</small></button><button className="secondary-button" onClick={startNewGame}><b>＋ Start New Game</b><small>Choose room, players, and timer</small></button></div><div className="modal-actions pause-actions"><button className="danger-button" onClick={() => { setPaused(false); setConfirmForfeit(true); }}>Forfeit match</button><button className="text-button" onClick={goMenu}>Return to school</button><button className="primary-button" onClick={() => setPaused(false)}>Resume match</button></div></div></div>}
    {confirmForfeit && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="forfeit-title"><div className="modal forfeit-modal"><span className="eyebrow">FORFEIT MATCH?</span><h2 id="forfeit-title">Leave the table?</h2><p>This match and its saved progress will be erased. Teacher Mesob will be awarded the win.</p><div className="modal-actions"><button className="secondary-button" onClick={() => { setConfirmForfeit(false); setPaused(true); }}>Keep playing</button><button className="danger-button danger-confirm" onClick={forfeitGame}>Forfeit and leave</button></div></div></div>}
    {showTutorial && <TutorialOverlay onDone={() => setShowTutorial(false)} />}
  </div>;
}

function SchoolCrest({ small = false }: { small?: boolean }) {
  return <span className={`school-crest ${small ? 'school-crest-small' : ''}`} aria-hidden="true"><i>✦</i><b>DM</b><em>EST. 2026</em></span>;
}

function Header({ onHome }: { onHome: () => void }) { return <header className="site-header school-site-header"><button className="school-home-button" onClick={onHome} aria-label="Da Mystro Elementary School home"><SchoolCrest small /><span><strong>Da Mystro</strong><small>ELEMENTARY SCHOOL</small></span></button><div className="school-header-note"><span>STUDENT GAME PORTAL</span><i /><i /><i /></div></header>; }

function Menu({ onChooseTable, onRules, onCredits, canResume, onResume }: { onChooseTable: (room: MatchSettings['room']) => void; onRules: () => void; onCredits: () => void; canResume: boolean; onResume: () => void }) {
  return <main className="school-start-screen school-lobby-screen">
    <section className="school-hallway">
      <div className="hallway-lights" aria-hidden="true"><i /><i /><i /></div>
      <div className="hallway-lockers hallway-lockers-left" aria-hidden="true"><i /><i /><i /></div>
      <div className="hallway-lockers hallway-lockers-right" aria-hidden="true"><i /><i /><i /></div>
      <div className="school-lobby-sign"><SchoolCrest /><span>YOU'VE WALKED INTO</span><h1>Da Mystro Elementary</h1><p>Math &amp; Strategy Game Hall</p></div>
      <div className="pick-table-heading"><span>WELCOME, STUDENT</span><h2>Choose a classroom</h2><p>Each classroom has its own Injera Be Wat table. Pick the room where you want to play.</p></div>
      <div className="lobby-table-grid" role="group" aria-label="Choose a game classroom">
        <button className="lobby-table-card classic-lobby-table" onClick={() => onChooseTable('classic')}>
          <span className="room-door-number">CLASSROOM 8 · ORIGINAL</span>
          <span className="table-preview" aria-hidden="true"><i className="preview-ring">{Array.from({ length: 14 }, (_, index) => <b key={index} style={{ '--preview-card': index } as React.CSSProperties} />)}</i><em>IBW</em></span>
          <strong>Original Classroom</strong><small>Enter the emerald classroom and choose any face-down card from the Circle.</small><span className="enter-table-label">ENTER CLASSROOM <b>→</b></span>
        </button>
        <button className="lobby-table-card rush-lobby-table" onClick={() => onChooseTable('rush')}>
          <span className="room-door-number">CLASSROOM 9 · RUSH</span>
          <span className="table-preview" aria-hidden="true"><i className="preview-ring">{Array.from({ length: 14 }, (_, index) => <b key={index} style={{ '--preview-card': index } as React.CSSProperties} />)}</i><em>SPIN</em><u>◆</u></span>
          <strong>Rush &amp; Roulette Classroom</strong><small>Enter the high-energy classroom, spin the table, and let the Circle choose.</small><span className="enter-table-label">ENTER CLASSROOM <b>→</b></span>
        </button>
      </div>
      {canResume && <button className="lobby-resume-button" onClick={onResume}><span>↻</span><b>Resume the game already at your desk</b><small>Your saved match is waiting.</small></button>}
      <div className="lobby-help-links"><button onClick={onRules}>How to Play</button><i>•</i><button onClick={onCredits}>School Credits</button></div>
      <div className="hallway-floor" aria-hidden="true" />
    </section>
  </main>;
}

function Setup({ settings, setSettings, onStart, onBack }: { settings: MatchSettings; setSettings: (settings: MatchSettings) => void; onStart: () => void; onBack: () => void }) {
  const update = <K extends keyof MatchSettings>(key: K, value: MatchSettings[K]) => setSettings({ ...settings, [key]: value });
  const usernameError = getUsernameError(settings.playerName);
  return <main className="content-page setup-page">
    <button className="back-button" onClick={onBack}>← Choose another classroom</button><span className="eyebrow">YOUR CLASSROOM IS READY</span><h1>{settings.room === 'rush' ? 'Rush & Roulette Classroom' : 'Original Injera Be Wat Classroom'}</h1><p className="lede">Create your student seat, choose your classmates, and begin the lesson.</p>
    <div className={`selected-room-ticket ${settings.room === 'rush' ? 'rush-ticket' : ''}`}><span>{settings.room === 'rush' ? '🎡' : '🦁'}</span><div><b>{settings.room === 'rush' ? 'CLASSROOM 9 · SPIN TABLE' : 'CLASSROOM 8 · CLASSIC TABLE'}</b><small>{settings.room === 'rush' ? 'The Circle spins before every draw.' : 'Choose any face-down card from the Circle.'}</small></div><i>SELECTED</i></div>
    <div className="setup-grid"><section className="panel"><h2>Players</h2><label className={`field username-field ${usernameError ? 'field-error' : ''}`}><span>Create your username</span><input value={settings.playerName} minLength={3} maxLength={18} autoComplete="username" autoCapitalize="none" spellCheck={false} aria-invalid={!!usernameError} aria-describedby="username-help" placeholder="Example: AddisAce" onChange={(e) => update('playerName', e.target.value)} /><small id="username-help" className="username-help">{usernameError || 'Only this username will appear to other players.'}</small></label><fieldset><legend>Total players</legend><div className="segment">{([2, 3, 4] as const).map((count) => <button type="button" className={settings.playerCount === count ? 'active' : ''} onClick={() => update('playerCount', count)} key={count}>{count}</button>)}</div></fieldset><fieldset><legend>AI difficulty</legend><div className="segment">{(['easy', 'medium', 'hard'] as const).map((level) => <button type="button" className={settings.difficulty === level ? 'active' : ''} onClick={() => update('difficulty', level)} key={level}>{level}</button>)}</div></fieldset></section><section className="panel"><h2>Table preferences</h2><fieldset className="timer-setting"><legend>Turn timer</legend><div className="segment">{([10, 15, 20, 30] as const).map((seconds) => <button type="button" className={settings.turnSeconds === seconds ? 'active' : ''} onClick={() => update('turnSeconds', seconds)} key={seconds}>{seconds}s</button>)}</div><small>{settings.room === 'rush' ? '10 seconds keeps Rush fast.' : '20 seconds is recommended for classroom math.'}</small></fieldset><Toggle checked={settings.sound} onChange={(v) => update('sound', v)} label="Sound" description="Original synthesized table cues" /><Toggle checked={settings.hints} onChange={(v) => update('hints', v)} label="Tutorial hints" description="Show the playable tour when the match begins" /><Toggle checked={settings.reduceMotion} onChange={(v) => update('reduceMotion', v)} label="Reduce motion" description="Minimize card movement and celebration" /></section></div>
    <button className="primary-button large start-button" disabled={!!usernameError} onClick={onStart}>Enter {settings.room === 'rush' ? 'Rush & Roulette' : 'Royal Classroom'} <span>→</span></button>
  </main>;
}

function Rules({ onBack }: { onBack: () => void }) { return <main className="content-page"><button className="back-button" onClick={onBack}>← Back</button><span className="eyebrow">HOW TO PLAY</span><h1>Add. Match. Think fast.</h1><p className="lede">Pick one card from the face-down circle. Spot a match or addition in the middle yourself—there are no hints and no take-backs.</p><div className="rule-grid">{[
['01', 'Match one', 'Match the Middle, your own top card, or an opponent’s visible top stack. Deeper pile cards stay locked.'], ['02', 'Add cards', 'Capture two or more numeric Middle cards when their values add to your picked card. Face cards match only.'], ['03', 'Keep going', 'A successful capture lets you pick again. End your turn and play passes immediately.'], ['04', 'Joker sweep', 'Either Joker immediately takes the entire middle and every card collected by all opponents.'], ['05', 'Last pick', 'When the circle empties, the player who picked the final card collects everything left in the middle.'], ['06', 'Score', 'Aces and number cards score 5 points. Jacks, Queens, and Kings score 20 points each. Jokers score 30 points each.'],
].map(([n, title, text]) => <article className="rule-card" key={n}><span>{n}</span><h2>{title}</h2><p>{text}</p></article>)}</div><button className="primary-button" onClick={onBack}>Ready to play</button></main>; }

function Credits({ onBack }: { onBack: () => void }) { return <main className="content-page credits-page"><button className="back-button" onClick={onBack}>← Back</button><span className="eyebrow">CREDITS</span><h1>Made for the table.</h1><div className="credit-lockup royal-credit-lockup"><img src={DM_LOGO} alt="Da Mystro Gamings" /><div><h2>Injera Be Wat</h2><p>Presented by <strong>Da Mystro Gamings</strong>.</p><p>This original digital interpretation celebrates Ethiopian culture through a royal emerald-and-gold strategy room designed for the students of Da Mystro Elementary School.</p></div></div><button className="primary-button" onClick={onBack}>Return home</button></main>; }

function TeachingBoard({ game }: { game: GameState }) {
  if (!game.hints) return null;
  const drawn = game.turn.drawnCard;
  const currentPile = game.players[game.currentPlayerIndex].captured;
  const pileTop = currentPile[currentPile.length - 1];
  const canPileMatch = !!drawn && pileTop?.rank === drawn.rank;
  const pileTake = game.turn.captureOptions.find((option) => option.targetPlayerId);
  const targetPile = pileTake ? game.players.find((player) => player.id === pileTake.targetPlayerId) : undefined;
  let title = game.room === 'rush' ? 'Spin to Draw' : 'Pick from the Circle'; let lesson = game.room === 'rush' ? 'Press Spin the Table. The wheel chooses and draws the card under the pointer automatically.' : 'Any face-down card may be chosen. The Circle gets smaller after every pick.'; let example = game.room === 'rush' ? 'SPIN → LAND → DRAW 1' : 'CIRCLE → PICK 1';
  if (game.turn.message.includes('Joker')) { title = 'Joker Moment'; lesson = 'A Joker sweeps the whole Middle and every opponent’s collected cards. Cards in the Circle stay put.'; example = 'JOKER = BIG SWEEP'; }
  else if (game.turn.phase === 'choose' && drawn) {
    if (canPileMatch && pileTake) { title = 'Choose a Pile'; lesson = `Your ${drawn.rank} can join your pile, or take the matching top stack from ${targetPile?.name}.`; example = `YOUR PILE  •  OR TAKE THEIRS`; }
    else if (pileTake) { title = 'Take the Top Stack'; lesson = `${targetPile?.name}'s visible top card matches your ${drawn.rank}. Select that pile to take its matching top stack.`; example = `${drawn.rank} = TOP PILE  •  TAKE IT`; }
    else if (canPileMatch) { title = 'Match Your Pile'; lesson = `Your collected pile ends in ${pileTop.rank}. The new ${drawn.rank} can go straight onto it.`; example = `${pileTop.rank} = ${drawn.rank}  •  ADD TO PILE`; }
    else if (['J', 'Q', 'K'].includes(drawn.rank)) { title = 'Court Card Rule'; lesson = 'Court cards cannot add. Look for one Middle card with the same rank.'; example = `${drawn.rank} MATCHES ${drawn.rank}`; }
    else { title = 'Solve the Middle'; lesson = 'Select every match and addition group you see. Each group must equal your picked card.'; example = 'MATCH + EACH VALID SUM'; }
  }
  return <section className="teaching-board" key={`${game.moveNumber}-${game.turn.phase}-${title}`} aria-label={`Teaching moment: ${title}`}><span>TEACHING MOMENT</span><h3>{title}</h3><p>{lesson}</p><b>{example}</b></section>;
}

function PlayerChip({ game, index, selectedIds, onPileSelect }: { game: GameState; index: number; selectedIds: string[]; onPileSelect: (playerId: string) => void }) {
  const player = game.players[index];
  const top = player.captured[player.captured.length - 1];
  const pileOption = game.turn.captureOptions.find((option) => option.targetPlayerId === player.id);
  const selected = !!pileOption && pileOption.capturedCardIds.every((id) => selectedIds.includes(id));
  let stackSize = 0;
  if (top) for (let cardIndex = player.captured.length - 1; cardIndex >= 0 && player.captured[cardIndex].rank === top.rank; cardIndex -= 1) stackSize += 1;
  return <article className={`player-chip ${index === game.currentPlayerIndex ? 'active' : ''} ${index === 1 ? 'teacher-player' : ''}`}><div className="avatar">{index === 1 ? 'T' : player.name.slice(0, 1).toUpperCase()}</div><span><strong>{player.name}</strong><small>{player.isHuman ? 'STUDENT · YOU' : index === 1 ? `AI · TEACHER · ${game.difficulty.toUpperCase()}` : `AI · CLASSMATE`}</small></span><b>{player.captured.length}</b><em>cards</em>{top && <div className="visible-pile"><CardView key={top.id} card={top} className={`player-pile-top pile-arrive ${selected ? 'pile-selected' : ''}`} label={pileOption ? `Take ${player.name}'s top ${top.rank} stack` : `${player.name}'s top pile card is ${top.rank}`} onClick={pileOption && game.players[game.currentPlayerIndex].isHuman ? () => onPileSelect(player.id) : undefined} />{stackSize > 1 && <i>×{stackSize}</i>}</div>}</article>;
}

function GameScreen({ game, turnTimeLeft, selectedMiddleIds, onMiddleSelect, onPileSelect, onDraw, onConfirm, onEndTurn, onPause, onMenu, onRematch, notice }: { game: GameState; turnTimeLeft: number; selectedMiddleIds: string[]; onMiddleSelect: (id: string) => void; onPileSelect: (playerId: string) => void; onDraw: (id: string) => void; onConfirm: () => void; onEndTurn: () => void; onPause: () => void; onMenu: () => void; onRematch: () => void; notice: string }) {
  const current = game.players[game.currentPlayerIndex]; const isHumanChoice = current.isHuman && game.turn.phase === 'choose'; const canPileMatch = game.turn.captureOptions.some((option) => option.id.startsWith('pile-match-')); const selectedPileTake = game.turn.captureOptions.find((option) => option.targetPlayerId && option.capturedCardIds.length === selectedMiddleIds.length && option.capturedCardIds.every((id) => selectedMiddleIds.includes(id)));
  if (game.turn.phase === 'game-over') return <Results game={game} onMenu={onMenu} onRematch={onRematch} />;
  return <main className={`game-screen player-count-${game.players.length}`}>
    <header className="game-header"><Logo /><div className="turn-pill"><i /> <span><small>CURRENT TURN</small><strong>{current.name}{current.isHuman ? ' · You' : ''}</strong></span></div><div className="game-actions"><div className={`turn-timer ${current.isHuman && turnTimeLeft <= 5 ? 'timer-warning' : ''}`} aria-live="polite"><small>TURN</small><strong>{current.isHuman ? Math.max(0, turnTimeLeft) : 'AI'}</strong><span>{current.isHuman ? 'sec' : ''}</span></div><span className="remaining-count"><strong>{game.ring.length}</strong> cards left</span><button className="icon-button" onClick={onPause} aria-label="Pause match">Ⅱ</button></div></header>
    <div className="score-rail" aria-label="Collected cards">{game.players.map((player, index) => <PlayerChip game={game} index={index} selectedIds={selectedMiddleIds} onPileSelect={onPileSelect} key={player.id} />)}</div>
    <GameBoard game={game} onDraw={onDraw} selectedMiddleIds={selectedMiddleIds} onMiddleSelect={onMiddleSelect} onPileSelect={onPileSelect} onConfirm={onConfirm} onEndTurn={onEndTurn} teachingBoard={<TeachingBoard game={game} />} />
    <aside className="move-panel" aria-live="polite"><span className="eyebrow">{game.turn.phase === 'draw' ? game.room === 'rush' ? 'SPIN TO DRAW' : 'PICK A CARD' : 'ADD OR MATCH'}</span><TeachingBoard game={game} /><h2>{current.isHuman ? game.turn.message : `${current.name} is studying the middle…`}</h2>{notice && <p className="move-error">{notice}</p>}{isHumanChoice && <><p className="no-capture">{selectedPileTake ? `Press equals to take ${selectedPileTake.capturedCardIds.length} matching top card${selectedPileTake.capturedCardIds.length === 1 ? '' : 's'} from the selected pile.` : canPileMatch ? `Your pile ends in ${game.turn.drawnCard?.rank}. Press equals to add the new ${game.turn.drawnCard?.rank} and keep going.` : 'Select every Middle match and every separate group that adds to the drawn card, then press equals.'}</p><button className="primary-button confirm-button" disabled={!selectedMiddleIds.length && !canPileMatch} onClick={onConfirm}>{selectedPileTake ? 'Take top stack' : canPileMatch && !selectedMiddleIds.length ? `Add ${game.turn.drawnCard?.rank} to pile` : 'Add / match'} <span>=</span></button><button className="secondary-button end-turn-button" onClick={onEndTurn}>End turn — no take-backs</button></>}</aside>
  </main>;
}

function Results({ game, onMenu, onRematch }: { game: GameState; onMenu: () => void; onRematch: () => void }) { const scores = calculateFinalScores(game); const winners = game.players.filter((p) => game.winnerIds.includes(p.id)); return <main className={`results-screen ${game.reduceMotion ? 'reduce-motion' : ''}`}><div className="confetti" aria-hidden="true">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}</div><span className="eyebrow">THE CIRCLE IS EMPTY</span><h1>{winners.length > 1 ? 'A shared victory!' : `${winners[0]?.name} wins!`}</h1><p>{winners.length > 1 ? winners.map((p) => p.name).join(' & ') : 'The highest point total takes the game.'}</p><div className="score-lesson"><span>FINAL LESSON</span><b>J · Q · K = 20 points each</b><i>A/1–10 = 5 points each · Jokers = 30 points</i></div><div className="results-table" aria-label="Final card count and points"><div className="results-row header"><span>Player</span><span>Points</span><span>Cards</span><span>Numbers ×5</span><span>Faces ×20</span><span>Jokers ×30</span></div>{scores.map((score, index) => <div className={`results-row ${index === 0 ? 'winner' : ''}`} key={score.playerId}><span><b>{index + 1}</b>{score.name}</span><strong data-label="Total points">{score.points}</strong><span data-label="Cards collected">{score.cards}</span><span className="score-breakdown" data-label="Number cards ×5">{score.numberCards}<small>= {score.numberPoints} pts</small></span><span className="score-breakdown" data-label="Face cards ×20">{score.faceCards}<small>= {score.facePoints} pts</small></span><span className="score-breakdown" data-label="Jokers ×30">{score.jokers}<small>= {score.jokerPoints} pts</small></span></div>)}</div><div className="result-actions"><button className="secondary-button large" onClick={onMenu}>Return to menu</button><button className="primary-button large" onClick={onRematch}>Play again <span>↻</span></button></div></main>; }
