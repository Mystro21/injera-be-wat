import { useEffect, useRef, useState } from 'react';
import { CardView } from './CardView';
import { GameState } from '../game/models';

const STUDENT_TAUNTS = [
  { emoji: '😎', text: 'Too easy, Teacher!' },
  { emoji: '😂', text: 'I saw that one!' },
  { emoji: '🧠', text: 'Big brain move!' },
  { emoji: '🔥', text: 'I’m on a roll!' },
  { emoji: '👑', text: 'Table champion!' },
  { emoji: '👏', text: 'Give me a hand!' },
  { emoji: '😛', text: 'Can’t catch me!' },
];
const TEACHER_REPLIES = [
  { emoji: '👀', text: 'Show me the math!' },
  { emoji: '✏️', text: 'Class is still in session!' },
  { emoji: '🧠', text: 'Clever move, scholar!' },
  { emoji: '🦁', text: 'The lion is watching!' },
  { emoji: '📚', text: 'Study the Middle!' },
];

function EmojiTaunts({ game }: { game: GameState }) {
  const [reaction, setReaction] = useState<{ side: 'student' | 'teacher'; emoji: string; text: string } | null>(null);
  const [replyIndex, setReplyIndex] = useState(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  const sendTaunt = (taunt: typeof STUDENT_TAUNTS[number]) => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    setReaction({ side: 'student', ...taunt });
    const reply = TEACHER_REPLIES[replyIndex % TEACHER_REPLIES.length];
    setReplyIndex((index) => index + 1);
    timers.current.push(window.setTimeout(() => setReaction({ side: 'teacher', ...reply }), 1050));
    timers.current.push(window.setTimeout(() => setReaction(null), 3100));
  };
  if (game.players.length !== 2 || game.turn.phase === 'game-over') return null;
  return <>
    {reaction && <div className={`emoji-taunt-bubble emoji-taunt-${reaction.side}`} role="status"><b>{reaction.emoji}</b><span>{reaction.text}</span></div>}
    <div className="emoji-taunt-bar" aria-label="Friendly emoji taunts"><span>TAUNT</span>{STUDENT_TAUNTS.map((taunt) => <button key={taunt.emoji} onClick={() => sendTaunt(taunt)} aria-label={`Send ${taunt.text}`} title={taunt.text}>{taunt.emoji}</button>)}</div>
  </>;
}

function AIMathBoard({ game }: { game: GameState }) {
  const current = game.players[game.currentPlayerIndex];
  const drawn = game.turn.drawnCard;
  const role = game.currentPlayerIndex === 1 ? 'TEACHER' : 'CLASSMATE';
  if (current.isHuman) return <aside className="table-blackboard rule-blackboard teacher-board" aria-label="Teacher math blackboard"><span>TEACHER'S BOARD</span><strong>WATCH HERE</strong><small>The teacher shows the math<br />on their turn.</small></aside>;
  if (game.turn.phase === 'draw') return <aside className="table-blackboard rule-blackboard teacher-board" aria-label={`${current.name} math blackboard`}><span>{role}</span><strong>PICKING…</strong><small>First, draw from<br />the Circle.</small></aside>;
  if (drawn?.rank === 'JOKER') return <aside className="table-blackboard rule-blackboard teacher-board" aria-label={`${current.name} Joker lesson`}><span>{role} SHOWS</span><strong>JOKER!</strong><small>Middle + rivals’ cards<br />= big sweep</small></aside>;
  const option = game.turn.captureOptions[0];
  if (!option || !drawn) return <aside className="table-blackboard rule-blackboard teacher-board" aria-label={`${current.name} math blackboard`}><span>{role} SHOWS</span><strong>NO EQUATION</strong><small>No add or match.<br />Turn ends.</small></aside>;
  const group = option.groups[0];
  const pileMatch = option.id.startsWith('pile-match-');
  const pileTake = !!option.targetPlayerId;
  const target = pileTake ? game.players.find((player) => player.id === option.targetPlayerId) : undefined;
  const equation = pileMatch ? `${drawn.rank} = PILE ${drawn.rank}` : pileTake ? `${drawn.rank} = ${target?.name.toUpperCase()} PILE` : option.groups.map((captureGroup) => {
    const cards = captureGroup.cardIds.map((id) => game.center.find((card) => card.id === id)).filter(Boolean);
    return captureGroup.kind === 'add' ? `${cards.map((card) => card?.rank).join(' + ')} = ${drawn.rank}` : `${cards[0]?.rank} = ${drawn.rank}`;
  }).join('  •  ');
  return <aside className="table-blackboard rule-blackboard teacher-board" aria-label={`${current.name} math blackboard`}><span>{role} SHOWS</span><strong className="math-equation">{equation}</strong><small>{pileMatch ? 'Same as the top pile card.' : pileTake ? `Takes ${option.capturedCardIds.length} matching top card${option.capturedCardIds.length === 1 ? '' : 's'}.` : option.groups.length > 1 ? 'Every group solves the drawn card.' : group.kind === 'add' ? 'The selected Middle cards add up.' : 'Same rank makes a match.'}</small></aside>;
}

export function GameBoard({ game, onDraw, selectedMiddleIds, onMiddleSelect, onPileSelect, onConfirm, onEndTurn, teachingBoard }: { game: GameState; onDraw: (id: string) => void; selectedMiddleIds: string[]; onMiddleSelect: (id: string) => void; onPileSelect: (playerId: string) => void; onConfirm: () => void; onEndTurn: () => void; teachingBoard?: React.ReactNode }) {
  const [spinAngle, setSpinAngle] = useState(0);
  const [ballAngle, setBallAngle] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const spinTimer = useRef<number | null>(null);
  useEffect(() => () => { if (spinTimer.current) window.clearTimeout(spinTimer.current); }, []);
  const current = game.players[game.currentPlayerIndex];
  const spinToCard = (cardIndex: number, cardCount: number) => {
    setIsSpinning(true);
    setSpinAngle((angle) => {
      const currentPosition = ((angle % 360) + 360) % 360;
      const landingPosition = ((-(cardIndex * 360 / cardCount) % 360) + 360) % 360;
      const landingDelta = (landingPosition - currentPosition + 360) % 360;
      return angle + (game.reduceMotion ? 360 : 1080) + landingDelta;
    });
    setBallAngle((angle) => {
      const currentPosition = ((angle % 360) + 360) % 360;
      return angle - (game.reduceMotion ? 360 : 1440) - currentPosition;
    });
  };
  useEffect(() => {
    if (game.room !== 'rush' || current.isHuman || game.turn.phase !== 'draw') return;
    if (spinTimer.current) window.clearTimeout(spinTimer.current);
    const landedIndex = Math.floor(Math.random() * game.ring.length);
    const landedCard = game.ring[landedIndex];
    if (!landedCard) return;
    spinToCard(landedIndex, game.ring.length);
    spinTimer.current = window.setTimeout(() => { setIsSpinning(false); onDraw(landedCard.id); }, game.reduceMotion ? 150 : 1400);
  }, [game.room, game.currentPlayerIndex, game.turn.phase, game.moveNumber, game.reduceMotion, current.isHuman]);
  const canDraw = current.isHuman && game.turn.phase === 'draw';
  const canPickCircleCard = canDraw && game.room !== 'rush';
  const canSelect = current.isHuman && game.turn.phase === 'choose' && game.turn.drawnCard?.rank !== 'JOKER';
  const circleRadius = 'clamp(250px, 31vmin, 365px)';
  const mobileCircleRadius = 'clamp(130px, 38vw, 172px)';
  const canPileMatch = game.turn.captureOptions.some((option) => option.id.startsWith('pile-match-'));
  const selectedPileTake = game.turn.captureOptions.find((option) => option.targetPlayerId && option.capturedCardIds.length === selectedMiddleIds.length && option.capturedCardIds.every((id) => selectedMiddleIds.includes(id)));
  const tableMoment = game.turn.message.includes('swept') ? 'joker-sweep' : game.turn.message.includes('captured') || game.turn.message.includes('took') ? 'capture-success' : '';
  const spinTable = () => {
    if (!canDraw || isSpinning) return;
    const landedIndex = Math.floor(Math.random() * game.ring.length);
    const landedCard = game.ring[landedIndex];
    if (!landedCard) return;
    spinToCard(landedIndex, game.ring.length);
    spinTimer.current = window.setTimeout(() => {
      setIsSpinning(false);
      onDraw(landedCard.id);
    }, game.reduceMotion ? 150 : 1400);
  };
  return <div className={`table-wrap classroom-desk ${game.room === 'rush' ? 'rush-room' : 'classic-room'} ${tableMoment} ${game.reduceMotion ? 'reduce-motion' : ''}`}>
    <div className="royal-room-brand" aria-hidden="true"><i>♛</i><span>DA MYSTRO GAMINGS</span><b>{game.room === 'rush' ? 'RUSH & ROULETTE CLASSROOM' : 'ORIGINAL INJERA BE WAT'}</b></div>
    <div className="royal-table-jewel" aria-hidden="true">◆</div>
    <div className={`dm-hover-crown ${isSpinning ? 'crown-spinning' : ''}`} aria-hidden="true" style={{ '--crown-spin': `${spinAngle}deg` } as React.CSSProperties}><div className="dm-crown-body"><i>♛</i><b>DM</b><small>GAMINGS</small></div></div>
    <div className="royal-lion-seal royal-lion-left" aria-hidden="true"><span>♛</span><b>DM</b></div>
    <div className="royal-lion-seal royal-lion-right" aria-hidden="true"><span>♛</span><b>DM</b></div>
    <EmojiTaunts game={game} />
    {game.room === 'rush' && canDraw && <button className={`spin-table-button ${isSpinning ? 'is-spinning' : ''}`} onClick={spinTable} disabled={isSpinning}><span>🎡</span>{isSpinning ? 'SPINNING…' : 'SPIN THE TABLE'}</button>}
    <div className="desk-supplies" aria-hidden="true"><i className="chalk-piece chalk-white" /><i className="chalk-piece chalk-yellow" /><i className="board-eraser" /><i className="school-pencil" /></div>
    {game.players.length === 2 && <div className="student-hands" aria-hidden="true"><span className="student-arm arm-player"><i /><b /></span><span className="student-arm arm-ai"><i /><b /></span></div>}
    {game.players.length === 2 && game.players.map((player, index) => {
      const top = player.captured[player.captured.length - 1];
      const pileOption = game.turn.captureOptions.find((option) => option.targetPlayerId === player.id);
      const selected = !!pileOption && pileOption.capturedCardIds.every((id) => selectedMiddleIds.includes(id));
      return <div className={`table-player-seat seat-${index === 0 ? 'left' : 'right'} ${index === 1 ? 'teacher-seat' : ''} ${index === game.currentPlayerIndex ? 'active' : ''}`} aria-label={`${player.name}, ${player.captured.length} collected cards`} key={`seat-${player.id}`}><span>{index === 1 ? 'T' : player.name.slice(0, 1).toUpperCase()}</span><b>{player.name}</b><small>{index === 1 ? 'AI teacher' : 'student'} · {player.captured.length} cards</small>{top && <CardView key={top.id} card={top} className={`seat-pile-top pile-arrive ${selected ? 'pile-selected' : ''}`} label={pileOption ? `Take ${player.name}'s top ${top.rank} stack` : `${player.name}'s top pile card is ${top.rank}`} onClick={pileOption && current.isHuman ? () => onPileSelect(player.id) : undefined} />}</div>;
    })}
    {teachingBoard && <aside className="table-blackboard lesson-blackboard">{teachingBoard}</aside>}
    <AIMathBoard game={game} />
    {canSelect && <div className="table-turn-actions"><button className="table-action table-add-action" disabled={!selectedMiddleIds.length && !canPileMatch} onClick={onConfirm} aria-label={selectedPileTake ? 'Take selected opponent pile stack' : canPileMatch && !selectedMiddleIds.length ? `Add ${game.turn.drawnCard?.rank} to your matching pile` : 'Submit add or match'}><span>{selectedPileTake ? 'TAKE STACK' : canPileMatch && !selectedMiddleIds.length ? 'ADD TO PILE' : 'ADD / MATCH'}</span><b>=</b></button><button className="table-action table-end-action" onClick={onEndTurn}><span>END</span><b>TURN</b></button></div>}
    <div className="game-table">
      {game.room === 'rush' && <><div className={`roulette-table-disk ${isSpinning ? 'ring-spinning' : ''}`} aria-hidden="true" style={{ '--table-spin': `${spinAngle}deg` } as React.CSSProperties}>{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--slot': index } as React.CSSProperties}>{index + 1}</i>)}</div><div className={`roulette-ball-track ${isSpinning ? 'ball-spinning' : ''}`} aria-hidden="true" style={{ '--ball-spin': `${ballAngle}deg` } as React.CSSProperties}><i /></div><div className="roulette-pointer" aria-hidden="true">◆</div>{isSpinning && <div className="roulette-spin-status" aria-live="polite">BALL IN PLAY</div>}</>}
      <div className="table-pattern" aria-hidden="true" style={game.room === 'rush' ? { '--table-spin': `${spinAngle}deg` } as React.CSSProperties : undefined} />
      <div className="table-crest dm-table-crest" aria-hidden="true"><i>♛</i><b>DM</b><small>INJERA BE WAT</small></div>
      <div className={`ring ${isSpinning ? 'ring-spinning' : ''}`} aria-label={`Injera ring, ${game.ring.length} cards remaining`} style={{ '--table-spin': `${spinAngle}deg`, '--circle-radius': circleRadius, '--circle-diameter': 'clamp(500px, 62vmin, 730px)', '--mobile-radius': mobileCircleRadius, '--mobile-circle-diameter': 'clamp(260px, 76vw, 344px)' } as React.CSSProperties}>
        {game.ring.map((card, index) => {
          const total = game.ring.length;
          const angle = (360 / Math.max(total, 1)) * index - 90;
          // Keep one full-size Circle throughout the match. As cards leave,
          // the same circumference is divided between fewer cards so gaps grow.
          return <CardView key={card.id} card={card} faceDown className={`ring-card ${total > 36 ? 'dense-ring' : ''} single-ring`} label={canPickCircleCard ? `Draw card ${index + 1} from the Circle` : game.room === 'rush' && canDraw ? 'Spin the table to draw this face-down card' : 'Face-down Circle card'} onClick={canPickCircleCard ? () => onDraw(card.id) : undefined} style={{ '--angle': `${angle}deg`, '--radius': 'var(--circle-radius)', '--ring-z': 1 } as React.CSSProperties} />;
        })}
      </div>
      <section className="wot" aria-label="Middle cards">
        <span className="wot-label">THE MIDDLE</span>
        <div className="center-cards">{game.center.length ? game.center.map((card) => <CardView key={card.id} card={card} className={selectedMiddleIds.includes(card.id) ? 'middle-selected' : ''} label={canSelect ? `Select ${card.rank} of ${card.suit}` : `${card.rank} of ${card.suit}`} onClick={canSelect ? () => onMiddleSelect(card.id) : undefined} />) : <span className="empty-wot">Middle is empty</span>}</div>
      </section>
      {game.turn.drawnCard && <div className="drawn-card"><span>DRAWN</span><CardView card={game.turn.drawnCard} className="is-drawn" /></div>}
    </div>
  </div>;
}
