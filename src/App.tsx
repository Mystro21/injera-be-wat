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

type Screen = 'menu' | 'setup' | 'rules' | 'credits' | 'game';
const DM_LOGO = `${import.meta.env.BASE_URL}dm-logo.png`;
const DEFAULT_SETTINGS: MatchSettings = { playerName: 'Player', playerCount: 2, difficulty: 'medium', room: 'classic', sound: true, hints: true, reduceMotion: false };

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [settings, setSettings] = useState(() => loadSettings(DEFAULT_SETTINGS));
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedMiddleIds, setSelectedMiddleIds] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [notice, setNotice] = useState('');
  const sound = useSound(game?.sound ?? settings.sound);
  const savedGame = useMemo(() => loadGame(), [screen]);

  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { if (game && game.turn.phase !== 'game-over') saveGame(game); }, [game]);
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

  const startGame = () => { const next = createInitialGame(settings); clearGame(); setGame(next); setScreen('game'); setSelectedMiddleIds([]); setShowTutorial(settings.hints); setNotice(''); };
  const resumeGame = () => { const restored = loadGame(); if (restored) { setGame(restored); setScreen('game'); setNotice('Match restored'); } };
  const handleDraw = (id: string) => { if (!game) return; setGame(drawCard(game, id)); setSelectedMiddleIds([]); setNotice(''); sound('draw'); };
  const toggleMiddle = (id: string) => { setSelectedMiddleIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]); setNotice(''); };
  const selectPile = (playerId: string) => { if (!game) return; const option = game.turn.captureOptions.find((item) => item.targetPlayerId === playerId); if (!option) return; setSelectedMiddleIds(option.capturedCardIds); setNotice(''); };
  const confirmMove = () => { if (!game) return; const option = captureForSelection(game, selectedMiddleIds); if (!option) { setNotice(selectedMiddleIds.length === 1 ? 'That card does not match. Try again or end your turn.' : 'Those selected cards do not add up to your picked card. Try another combination or end your turn.'); return; } setGame(applyMove(game, option)); setSelectedMiddleIds([]); setNotice(''); sound('capture'); };
  const endTurn = () => { if (!game) return; setGame(applyMove(game, null)); setSelectedMiddleIds([]); setNotice(''); sound('draw'); };
  const goMenu = () => { setPaused(false); setScreen('menu'); };
  const forfeitGame = () => { clearGame(); setGame(null); setPaused(false); setConfirmForfeit(false); setScreen('menu'); setSelectedMiddleIds([]); setNotice(''); };

  return <div className="app-shell">
    {screen !== 'game' && <Header onHome={() => setScreen('menu')} />}
    {screen === 'menu' && <Menu onPlay={() => setScreen('setup')} onRules={() => setScreen('rules')} onCredits={() => setScreen('credits')} canResume={!!savedGame} onResume={resumeGame} />}
    {screen === 'setup' && <Setup settings={settings} setSettings={setSettings} onStart={startGame} onBack={() => setScreen('menu')} />}
    {screen === 'rules' && <Rules onBack={() => setScreen('menu')} />}
    {screen === 'credits' && <Credits onBack={() => setScreen('menu')} />}
    {screen === 'game' && game && <GameScreen game={game} selectedMiddleIds={selectedMiddleIds} onMiddleSelect={toggleMiddle} onPileSelect={selectPile} onDraw={handleDraw} onConfirm={confirmMove} onEndTurn={endTurn} onPause={() => setPaused(true)} onMenu={goMenu} onRematch={() => setGame(createInitialGame(settings))} notice={notice} />}
    {paused && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal"><span className="eyebrow">MATCH PAUSED</span><h2>The table is waiting</h2><p>Your current match is saved on this device.</p><div className="modal-actions pause-actions"><button className="danger-button" onClick={() => { setPaused(false); setConfirmForfeit(true); }}>Forfeit match</button><button className="text-button" onClick={goMenu}>Return to school</button><button className="primary-button" onClick={() => setPaused(false)}>Resume match</button></div></div></div>}
    {confirmForfeit && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="forfeit-title"><div className="modal forfeit-modal"><span className="eyebrow">FORFEIT MATCH?</span><h2 id="forfeit-title">Leave the table?</h2><p>This match and its saved progress will be erased. Teacher Mesob will be awarded the win.</p><div className="modal-actions"><button className="secondary-button" onClick={() => { setConfirmForfeit(false); setPaused(true); }}>Keep playing</button><button className="danger-button danger-confirm" onClick={forfeitGame}>Forfeit and leave</button></div></div></div>}
    {showTutorial && <TutorialOverlay onDone={() => setShowTutorial(false)} />}
  </div>;
}

function SchoolCrest({ small = false }: { small?: boolean }) {
  return <span className={`school-crest ${small ? 'school-crest-small' : ''}`} aria-hidden="true"><i>✦</i><b>DM</b><em>EST. 2026</em></span>;
}

function Header({ onHome }: { onHome: () => void }) { return <header className="site-header school-site-header"><button className="school-home-button" onClick={onHome} aria-label="Da Mystro Elementary School home"><SchoolCrest small /><span><strong>Da Mystro</strong><small>ELEMENTARY SCHOOL</small></span></button><div className="school-header-note"><span>STUDENT GAME PORTAL</span><i /><i /><i /></div></header>; }

function Menu({ onPlay, onRules, onCredits, canResume, onResume }: { onPlay: () => void; onRules: () => void; onCredits: () => void; canResume: boolean; onResume: () => void }) {
  return <main className="school-start-screen">
    <section className="school-welcome">
      <div className="school-welcome-copy"><span className="school-kicker">WELCOME TO</span><h1>Da Mystro<span>Elementary School</span></h1><p>Where bright minds gather, cultures are celebrated, and every lesson becomes an adventure.</p><div className="school-motto"><i>LEARN</i><b>•</b><i>PLAY</i><b>•</b><i>GROW</i></div><button className="school-hero-cta" onClick={onPlay}>Enter the Injera Be Wat Classroom <span>→</span></button></div>
      <div className="dm-royal-crest"><img src={DM_LOGO} alt="Da Mystro Gamings royal lion crest" /></div>
    </section>
    <section className="school-entry-panel">
      <div className="classroom-window" aria-hidden="true"><span>ROOM 8</span><div className="window-board"><small>TODAY'S LESSON</small><b>3 + 5 = 8</b><i>LOOK TWICE!</i></div><div className="window-desk"><i /><i /><i /></div></div>
      <article className="featured-classroom"><span className="class-label">MATH &amp; STRATEGY LAB · LESSON 01</span><div className="game-title-lockup"><span className="mini-game-mark">IBW</span><div><h2>Injera Be Wat</h2><p>ADD · MATCH · THINK FAST</p></div></div><p className="class-description">Take your seat at the blackboard table. Add numbers, spot matches, outthink Teacher Mesob, and watch for the Jokers.</p><div className="class-details"><span><b>SUBJECT</b>Math &amp; Strategy</span><span><b>TEACHER</b>Teacher Mesob</span><span><b>PLAYERS</b>2–4 students</span></div><div className="school-actions"><button className="primary-button school-enter-button" onClick={onPlay}>Enter Classroom <span>→</span></button>{canResume && <button className="secondary-button school-resume-button" onClick={onResume}>Resume My Lesson</button>}</div></article>
      <aside className="school-notice-board"><span>FRONT OFFICE</span><h3>Student Resources</h3><button onClick={onRules}><b>01</b><span>How to Play<small>Read the classroom rules</small></span><i>→</i></button><button onClick={onCredits}><b>02</b><span>School Credits<small>Meet the game makers</small></span><i>→</i></button><p>“Every great player starts as a curious student.”</p></aside>
    </section>
  </main>;
}

function Setup({ settings, setSettings, onStart, onBack }: { settings: MatchSettings; setSettings: (settings: MatchSettings) => void; onStart: () => void; onBack: () => void }) {
  const update = <K extends keyof MatchSettings>(key: K, value: MatchSettings[K]) => setSettings({ ...settings, [key]: value });
  return <main className="content-page setup-page"><button className="back-button" onClick={onBack}>← Back</button><span className="eyebrow">MATCH SETUP</span><h1>Choose your game room</h1><p className="lede">Both rooms use the same two-deck Add &amp; Match rules. Rush &amp; Roulette adds a player-controlled spinning Circle.</p><div className="room-selector" role="group" aria-label="Game room"><button type="button" className={settings.room === 'classic' ? 'active' : ''} onClick={() => update('room', 'classic')}><b>🦁 Royal Classroom</b><span>The classic emerald strategy table.</span></button><button type="button" className={settings.room === 'rush' ? 'active rush-choice' : 'rush-choice'} onClick={() => update('room', 'rush')}><b>🎡 Rush &amp; Roulette</b><span>Spin the Circle before choosing a card.</span></button></div><div className="setup-grid"><section className="panel"><h2>Players</h2><label className="field"><span>Your name</span><input value={settings.playerName} maxLength={18} onChange={(e) => update('playerName', e.target.value)} /></label><fieldset><legend>Total players</legend><div className="segment">{([2, 3, 4] as const).map((count) => <button type="button" className={settings.playerCount === count ? 'active' : ''} onClick={() => update('playerCount', count)} key={count}>{count}</button>)}</div></fieldset><fieldset><legend>AI difficulty</legend><div className="segment">{(['easy', 'medium', 'hard'] as const).map((level) => <button type="button" className={settings.difficulty === level ? 'active' : ''} onClick={() => update('difficulty', level)} key={level}>{level}</button>)}</div></fieldset></section><section className="panel"><h2>Table preferences</h2><Toggle checked={settings.sound} onChange={(v) => update('sound', v)} label="Sound" description="Original synthesized table cues" /><Toggle checked={settings.hints} onChange={(v) => update('hints', v)} label="Tutorial hints" description="Show the playable tour when the match begins" /><Toggle checked={settings.reduceMotion} onChange={(v) => update('reduceMotion', v)} label="Reduce motion" description="Minimize card movement and celebration" /></section></div><button className="primary-button large start-button" onClick={onStart}>Enter {settings.room === 'rush' ? 'Rush & Roulette' : 'Royal Classroom'} <span>→</span></button></main>;
}

function Rules({ onBack }: { onBack: () => void }) { return <main className="content-page"><button className="back-button" onClick={onBack}>← Back</button><span className="eyebrow">HOW TO PLAY</span><h1>Add. Match. Think fast.</h1><p className="lede">Pick one card from the face-down circle. Spot a match or addition in the middle yourself—there are no hints and no take-backs.</p><div className="rule-grid">{[
['01', 'Match one', 'Match the Middle, your own top card, or an opponent’s visible top stack. Deeper pile cards stay locked.'], ['02', 'Add cards', 'Capture two or more numeric Middle cards when their values add to your picked card. Face cards match only.'], ['03', 'Keep going', 'A successful capture lets you pick again. End your turn and play passes immediately.'], ['04', 'Joker sweep', 'Either Joker immediately takes the entire middle and every card collected by all opponents.'], ['05', 'Last pick', 'When the circle empties, the player who picked the final card collects everything left in the middle.'], ['06', 'Score', 'Numbers, Aces, and Jokers score 1 point. Jacks, Queens, and Kings score 10 points each.'],
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

function GameScreen({ game, selectedMiddleIds, onMiddleSelect, onPileSelect, onDraw, onConfirm, onEndTurn, onPause, onMenu, onRematch, notice }: { game: GameState; selectedMiddleIds: string[]; onMiddleSelect: (id: string) => void; onPileSelect: (playerId: string) => void; onDraw: (id: string) => void; onConfirm: () => void; onEndTurn: () => void; onPause: () => void; onMenu: () => void; onRematch: () => void; notice: string }) {
  const current = game.players[game.currentPlayerIndex]; const isHumanChoice = current.isHuman && game.turn.phase === 'choose'; const canPileMatch = game.turn.captureOptions.some((option) => option.id.startsWith('pile-match-')); const selectedPileTake = game.turn.captureOptions.find((option) => option.targetPlayerId && option.capturedCardIds.length === selectedMiddleIds.length && option.capturedCardIds.every((id) => selectedMiddleIds.includes(id)));
  if (game.turn.phase === 'game-over') return <Results game={game} onMenu={onMenu} onRematch={onRematch} />;
  return <main className={`game-screen player-count-${game.players.length}`}>
    <header className="game-header"><Logo /><div className="turn-pill"><i /> <span><small>CURRENT TURN</small><strong>{current.name}{current.isHuman ? ' · You' : ''}</strong></span></div><div className="game-actions"><span className="remaining-count"><strong>{game.ring.length}</strong> cards left</span><button className="icon-button" onClick={onPause} aria-label="Pause match">Ⅱ</button></div></header>
    <div className="score-rail" aria-label="Collected cards">{game.players.map((player, index) => <PlayerChip game={game} index={index} selectedIds={selectedMiddleIds} onPileSelect={onPileSelect} key={player.id} />)}</div>
    <GameBoard game={game} onDraw={onDraw} selectedMiddleIds={selectedMiddleIds} onMiddleSelect={onMiddleSelect} onPileSelect={onPileSelect} onConfirm={onConfirm} onEndTurn={onEndTurn} teachingBoard={<TeachingBoard game={game} />} />
    <aside className="move-panel" aria-live="polite"><span className="eyebrow">{game.turn.phase === 'draw' ? game.room === 'rush' ? 'SPIN TO DRAW' : 'PICK A CARD' : 'ADD OR MATCH'}</span><TeachingBoard game={game} /><h2>{current.isHuman ? game.turn.message : `${current.name} is studying the middle…`}</h2>{notice && <p className="move-error">{notice}</p>}{isHumanChoice && <><p className="no-capture">{selectedPileTake ? `Press equals to take ${selectedPileTake.capturedCardIds.length} matching top card${selectedPileTake.capturedCardIds.length === 1 ? '' : 's'} from the selected pile.` : canPileMatch ? `Your pile ends in ${game.turn.drawnCard?.rank}. Press equals to add the new ${game.turn.drawnCard?.rank} and keep going.` : 'Select every Middle match and every separate group that adds to the drawn card, then press equals.'}</p><button className="primary-button confirm-button" disabled={!selectedMiddleIds.length && !canPileMatch} onClick={onConfirm}>{selectedPileTake ? 'Take top stack' : canPileMatch && !selectedMiddleIds.length ? `Add ${game.turn.drawnCard?.rank} to pile` : 'Add / match'} <span>=</span></button><button className="secondary-button end-turn-button" onClick={onEndTurn}>End turn — no take-backs</button></>}</aside>
  </main>;
}

function Results({ game, onMenu, onRematch }: { game: GameState; onMenu: () => void; onRematch: () => void }) { const scores = calculateFinalScores(game); const winners = game.players.filter((p) => game.winnerIds.includes(p.id)); return <main className={`results-screen ${game.reduceMotion ? 'reduce-motion' : ''}`}><div className="confetti" aria-hidden="true">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}</div><span className="eyebrow">THE CIRCLE IS EMPTY</span><h1>{winners.length > 1 ? 'A shared victory!' : `${winners[0]?.name} wins!`}</h1><p>{winners.length > 1 ? winners.map((p) => p.name).join(' & ') : 'The highest point total takes the game.'}</p><div className="score-lesson"><span>FINAL LESSON</span><b>J · Q · K = 10 points</b><i>All other cards = 1 point</i></div><div className="results-table"><div className="results-row header"><span>Player</span><span>Points</span><span>Cards</span><span>Captures</span><span>Jokers</span><span>Largest</span></div>{scores.map((score, index) => <div className={`results-row ${index === 0 ? 'winner' : ''}`} key={score.playerId}><span><b>{index + 1}</b>{score.name}</span><strong>{score.points}</strong><span>{score.cards}</span><span>{score.stats.successfulCaptures}</span><span>{score.stats.jokerSweeps}</span><span>{score.stats.largestSingleCapture}</span></div>)}</div><div className="result-actions"><button className="secondary-button large" onClick={onMenu}>Return to menu</button><button className="primary-button large" onClick={onRematch}>Play again <span>↻</span></button></div></main>; }
