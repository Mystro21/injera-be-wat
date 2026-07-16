import { Card } from '../game/models';

const suitGlyph: Record<Card['suit'], string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠', joker: '✦' };
const courtName: Partial<Record<Card['rank'], string>> = { J: 'JACK', Q: 'QUEEN', K: 'KING', JOKER: 'JOKER' };

export function CardView({ card, faceDown = false, className = '', label, onClick, style }: { card?: Card; faceDown?: boolean; className?: string; label?: string; onClick?: () => void; style?: React.CSSProperties }) {
  const red = card?.suit === 'hearts' || card?.suit === 'diamonds';
  const glyph = card ? suitGlyph[card.suit] : '';
  const displayRank = card?.rank === 'JOKER' ? 'J' : card?.rank;
  const typeClass = card?.rank === 'JOKER' ? 'joker-card' : ['J', 'Q', 'K'].includes(card?.rank ?? '') ? 'court-card' : card?.rank === 'A' ? 'ace-card' : '';
  const content = faceDown ? (
    <span className="card-back-frame" aria-hidden="true"><span className="mesob-mark"><b>IBW</b><i>◆</i></span></span>
  ) : (
    <>
      <span className="card-weave card-weave-top" aria-hidden="true" />
      <span className="card-corner card-corner-top"><b>{displayRank}</b><i>{glyph}</i></span>
      <span className="card-center"><b className="card-rank">{displayRank}</b><span className="card-suit">{glyph}</span>{card && courtName[card.rank] && <small>{courtName[card.rank]}</small>}</span>
      <span className="card-corner card-corner-bottom"><b>{displayRank}</b><i>{glyph}</i></span>
      <span className="card-weave card-weave-bottom" aria-hidden="true" />
    </>
  );
  const classes = `playing-card ${faceDown ? 'card-back' : 'card-face'} ${red ? 'red-card' : ''} ${typeClass} ${className}`;
  if (onClick) return <button type="button" className={classes} aria-label={label} onClick={onClick} style={style}>{content}</button>;
  return <div className={classes} aria-label={label} style={style}>{content}</div>;
}
