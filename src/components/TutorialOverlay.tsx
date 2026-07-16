import { useState } from 'react';
const steps = [
  ['Pick from the circle', 'The face-down cards form the circle. On your turn, select any one card.'],
  ['Look at the middle', 'Several cards begin face-up here. You must spot a match or addition yourself.'],
  ['Match one', 'Select one middle card with the same number as the card you picked.'],
  ['Or add cards', 'Select two or more middle cards when their total equals your picked card.'],
  ['Jokers shake it up', 'A Joker immediately takes the entire middle and every card collected by the other players.'],
  ['Think fast', 'Capture to pick again. End your turn and there are no take-backs. The last picker takes the middle.'],
];
export function TutorialOverlay({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0); const [practiced, setPracticed] = useState(false);
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tutorial-title"><div className="modal tutorial-modal"><span className="eyebrow">PLAYABLE TOUR · {step + 1}/{steps.length}</span><h2 id="tutorial-title">{steps[step][0]}</h2><p>{steps[step][1]}</p><div className="tutorial-practice"><button className={`practice-ring ${practiced ? 'done' : ''}`} onClick={() => setPracticed(true)} aria-label="Practice drawing from the ring">{practiced ? '✓ Card drawn' : 'Tap a ring card'}</button><div className="practice-cards"><span>3</span><b>+</b><span>4</span><b>=</b><span>7</span></div></div><div className="modal-actions"><button className="text-button" onClick={onDone}>Skip tour</button><button className="primary-button" onClick={() => { if (step === steps.length - 1) onDone(); else { setStep(step + 1); setPracticed(false); } }}>{step === steps.length - 1 ? 'Start playing' : 'Next lesson'}</button></div></div></div>;
}
