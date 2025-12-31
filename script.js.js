/* ===========================
   Injera Be Wat — Game Logic
   script.js
   =========================== */

const $ = (id)=>document.getElementById(id);
const suits = ["♠","♥","♦","♣"];
const PHASE = { SETUP_STARTERS:"SETUP (STARTERS)", SETUP_MIDDLE:"SETUP (SEED MIDDLE)", PLAY:"PLAY", ENDED:"ENDED" };

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
function randomInsertBack(deck, card){
  const idx=Math.floor(Math.random()*(deck.length+1));
  deck.splice(idx,0,card);
}
function isNumericCard(card){
  return card.rank==="A" || (typeof card.rank==="number" && card.rank>=2 && card.rank<=10);
}
function addValue(card){
  if(card.rank==="A") return 1;
  if(typeof card.rank==="number") return card.rank;
  if(card.type==="face") return 10;
  if(card.type==="joker") return 1;
  return 0;
}
function scoreCard(card){
  if(card.type==="joker") return 1;
  if(card.type==="face") return 10;
  return 1;
}
function totalPoints(pile){
  return pile.reduce((s,c)=>s+scoreCard(c),0);
}

let state;

function newDeck(){
  const deck=[];
  for(const s of suits){
    deck.push({rank:"A", suit:s, type:"num", id:crypto.randomUUID()});
    for(let n=2;n<=10;n++) deck.push({rank:n, suit:s, type:"num", id:crypto.randomUUID()});
    ["J","Q","K"].forEach(r=> deck.push({rank:r, suit:s, type:"face", id:crypto.randomUUID()}));
  }
  deck.push({rank:"JOKER", suit:"", type:"joker", id:crypto.randomUUID()});
  deck.push({rank:"JOKER", suit:"", type:"joker", id:crypto.randomUUID()});
  return shuffle(deck);
}

function initGame(players){
  state = {
    players: players.map(name => ({name, pile:[]})),
    turn: 0,
    deck: newDeck(),
    middle: [],
    picked: null,
    capturedThisTurn: false,
    selectedIds: new Set(),
    phase: PHASE.SETUP_STARTERS,
    setupStarterIndex: 0,
    setupMiddleTarget: 3,
    lastPickTriggered: false,
    lastPickerIndex: null,
    lastDraw: null
  };
  logClear();
  logMsg(`New game started. <strong>${state.players.length}</strong> players.`);
  logMsg(`Setup: each player draws <strong>1 starter</strong> (auto-banked).`);
  render();
}

function cardLabel(card){
  return (card.type==="joker") ? "JOKER" : `${card.rank}${card.suit}`;
}

function renderCard(card, {selected=false}={}){
  const div=document.createElement("div");
  div.className="card"+(selected?" selected":"");
  div.dataset.id=card.id;

  const rank=document.createElement("div");
  rank.className="rank";
  rank.textContent=(card.type==="joker") ? "★" : card.rank;
  div.appendChild(rank);

  const corner=document.createElement("div");
  corner.className="corner";
  corner.textContent=(card.type==="joker") ? "JOKER" : card.suit;
  div.appendChild(corner);

  return div;
}

function currentPlayer(){ return state.players[state.turn]; }
function advanceTurn(){ state.turn = (state.turn+1) % state.players.length; }

function render(){
  $("turnName").textContent = state.players[state.turn]?.name ?? "-";
  $("phaseName").textContent = state.phase;
  $("deckCount").textContent = state.deck.length;
  $("midCount").textContent = state.middle.length;

  const circle=$("circleBtn");
  const circleDisabled =
    (state.phase===PHASE.ENDED) ||
    (state.phase===PHASE.PLAY && !!state.picked && !state.capturedThisTurn);
  circle.classList.toggle("disabled", circleDisabled);

  const hint=$("circleHint");
  if(state.phase===PHASE.SETUP_STARTERS) hint.textContent=`Setup: ${state.players[state.setupStarterIndex].name} draw a starter card.`;
  else if(state.phase===PHASE.SETUP_MIDDLE) hint.textContent=`Setup: Seed the Middle (${state.middle.length}/${state.setupMiddleTarget}).`;
  else if(state.phase===PHASE.PLAY){
    hint.textContent = state.picked
      ? (state.capturedThisTurn
          ? "You captured! You can CAPTURE again with the same picked card, or click the Circle to PICK again (same turn)."
          : "Select Middle cards, then CAPTURE — or END TURN if you miss it.")
      : "Click the Circle to draw 1 card.";
  } else {
    hint.textContent="Game over. Start a new game to play again.";
  }

  // Picked Slot
  const slot=$("pickedSlot"); slot.innerHTML="";
  if(state.picked){
    slot.appendChild(renderCard(state.picked,{selected:false}));
  } else if(state.phase!==PHASE.PLAY && state.lastDraw){
    slot.appendChild(renderCard(state.lastDraw,{selected:false}));
    const h=document.createElement("div");
    h.className="hint";
    h.innerHTML="<small>Setup draw</small>";
    slot.appendChild(h);
  } else {
    const h=document.createElement("div");
    h.className="hint";
    h.textContent="No picked card yet.";
    slot.appendChild(h);
  }

  // Middle cards ALWAYS render
  const mid=$("middleRow"); mid.innerHTML="";
  state.middle.forEach(c=>{
    const selected=state.selectedIds.has(c.id);
    const node=renderCard(c,{selected});
    node.addEventListener("click", ()=>{
      if(state.phase!==PHASE.PLAY) return;
      if(!state.picked) return;
      if(state.selectedIds.has(c.id)) state.selectedIds.delete(c.id);
      else state.selectedIds.add(c.id);
      updateSelectionUI();
      node.classList.toggle("selected", state.selectedIds.has(c.id));
    });
    mid.appendChild(node);
  });

  // Players box
  const pbox=$("playersBox"); pbox.innerHTML="";
  state.players.forEach((p,idx)=>{
    const card=document.createElement("div");
    card.className="stat";
    const pts=totalPoints(p.pile);
    card.innerHTML = `
      <div class="name">${idx===state.turn && state.phase!==PHASE.ENDED ? "▶ " : ""}${p.name}</div>
      <div class="meta">Cards collected: <b>${p.pile.length}</b></div>
      <div class="meta">Points (if ended now): <b>${pts}</b></div>
    `;
    pbox.appendChild(card);
  });

  updateSelectionUI();
}

function updateSelectionUI(){
  const selectedCards = state.middle.filter(c=>state.selectedIds.has(c.id));
  let sum=0; selectedCards.forEach(c=> sum += addValue(c));
  $("selSum").textContent = sum;

  const hasPicked = !!state.picked && state.phase===PHASE.PLAY;
  $("btnClear").disabled = !hasPicked || state.selectedIds.size===0;
  $("btnMatch").disabled = !hasPicked || state.selectedIds.size===0;

  const canAdd = hasPicked && isNumericCard(state.picked) && selectedCards.length >= 2;
  $("btnAdd").disabled = !canAdd;
  $("btnEnd").disabled = !hasPicked;

  if(state.phase!==PHASE.PLAY){
    $("btnClear").disabled = true;
    $("btnMatch").disabled = true;
    $("btnAdd").disabled = true;
    $("btnEnd").disabled = true;
  }
}

function logMsg(html){
  const item=document.createElement("div");
  item.className="logItem";
  item.innerHTML=html;
  $("log").prepend(item);
}
function logClear(){ $("log").innerHTML=""; }

function maybeEndGameIfTriggered(){
  if(!state.lastPickTriggered) return;
  if(state.deck.length===0 && !state.picked && state.phase===PHASE.PLAY){
    const lastP = state.players[state.lastPickerIndex];
    if(state.middle.length){
      lastP.pile.push(...state.middle);
      logMsg(`<strong>END:</strong> ${lastP.name} picked the last Circle card and collects the remaining <b>${state.middle.length}</b> Middle card(s).`);
      state.middle=[];
    } else {
      logMsg(`<strong>END:</strong> Circle is empty and Middle is empty.`);
    }

    const results = state.players
      .map(p=>({name:p.name, points: totalPoints(p.pile)}))
      .sort((a,b)=>b.points-a.points);

    const top=results[0];
    const ties=results.filter(r=>r.points===top.points);

    if(ties.length>1){
      logMsg(`<strong>🏁 Game Over:</strong> Tie at <b>${top.points}</b> points between ${ties.map(t=>`<strong>${t.name}</strong>`).join(", ")}.`);
    } else {
      logMsg(`<strong>🏁 Game Over:</strong> Winner is <strong>${top.name}</strong> with <b>${top.points}</b> points.`);
    }

    state.phase=PHASE.ENDED;
    render();
  }
}

// Setup
function setupDrawStarter(){
  const p = state.players[state.setupStarterIndex];
  const c = state.deck.pop();

  if(c.type==="joker"){
    randomInsertBack(state.deck,c);
    logMsg(`<strong>${p.name}</strong> drew a <strong>JOKER</strong> during setup — it goes back into the Circle randomly. Draw again.`);
    render(); return;
  }

  p.pile.push(c);
  state.lastDraw=c;
  logMsg(`<strong>${p.name}</strong> starter card: <strong>${cardLabel(c)}</strong> (auto-banked).`);

  state.setupStarterIndex += 1;
  if(state.setupStarterIndex >= state.players.length){
    state.phase=PHASE.SETUP_MIDDLE;
    logMsg(`Now seed the Middle with <strong>${state.setupMiddleTarget}</strong> cards.`);
  }
  render();
}

function setupSeedMiddle(){
  if(state.middle.length >= state.setupMiddleTarget) return;

  const c=state.deck.pop();
  if(c.type==="joker"){
    randomInsertBack(state.deck,c);
    logMsg(`<strong>Setup:</strong> drew a <strong>JOKER</strong> while seeding — it goes back into the Circle randomly. Draw again.`);
    render(); return;
  }

  state.middle.push(c);
  logMsg(`<strong>Setup:</strong> Middle seeded with <strong>${cardLabel(c)}</strong> (${state.middle.length}/${state.setupMiddleTarget}).`);

  if(state.middle.length >= state.setupMiddleTarget){
    state.phase=PHASE.PLAY;
    state.turn=0;
    logMsg(`<strong>Play begins.</strong> ${currentPlayer().name} goes first.`);
  }
  render();
}

// Play
function drawCard(){
  if(state.phase===PHASE.SETUP_STARTERS) return setupDrawStarter();
  if(state.phase===PHASE.SETUP_MIDDLE) return setupSeedMiddle();
  if(state.phase!==PHASE.PLAY) return;

  // If a picked card is still showing:
  // - if you've captured at least once with it, you may PICK again (same turn),
  //   but we first bank the picked card into your pile.
  // - if you haven't captured yet, you must CAPTURE or END TURN first.
  if(state.picked){
    if(state.capturedThisTurn){
      currentPlayer().pile.push(state.picked);
      logMsg(`<strong>${currentPlayer().name}</strong> banks picked card <strong>${cardLabel(state.picked)}</strong> and picks again.`);
      state.picked = null;
      state.selectedIds.clear();
      state.capturedThisTurn = false;
    } else {
      return;
    }
  }

  if(state.deck.length===0){
    maybeEndGameIfTriggered();
    return;
  }

  state.picked = state.deck.pop();
  state.lastDraw = state.picked;
  state.selectedIds.clear();
  state.capturedThisTurn = false;

  if(state.deck.length===0 && !state.lastPickTriggered){
    state.lastPickTriggered = true;
    state.lastPickerIndex = state.turn;
  }

  if(state.picked.type==="joker"){
    resolveJoker();
    return;
  }

  logMsg(`<strong>${currentPlayer().name}</strong> picked <strong>${cardLabel(state.picked)}</strong>. Select Middle cards, then CAPTURE — or END TURN if you miss it.`);
  render();
}

function resolveJoker(){
  const taker=currentPlayer();
  const jokerCard=state.picked;
  const midTaken=state.middle.length;

  taker.pile.push(...state.middle);
  state.middle=[];

  let pilesTaken=0;
  state.players.forEach((p,idx)=>{
    if(idx!==state.turn){
      pilesTaken += p.pile.length;
      taker.pile.push(...p.pile);
      p.pile=[];
    }
  });

  taker.pile.push(jokerCard);
  state.picked=null;
  state.selectedIds.clear();

  logMsg(`<strong>${taker.name}</strong> drew a <strong>JOKER</strong> and collects <b>${pilesTaken}</b> cards from other players + <b>${midTaken}</b> Middle card(s) + the Joker. <strong>Pick again.</strong>`);
  maybeEndGameIfTriggered();
  render();
}

function clearSelection(){
  state.selectedIds.clear();
  render();
}

// after a successful capture, DO NOT end turn — keep picked active
function captureMatch(){
  if(state.phase!==PHASE.PLAY) return;
  if(!state.picked) return;

  const selected = state.middle.filter(c=>state.selectedIds.has(c.id));
  if(selected.length===0){
    logMsg(`Select at least 1 Middle card for <strong>MATCH</strong>.`);
    return;
  }

  const ok = selected.every(c=> c.rank === state.picked.rank);
  if(!ok){
    logMsg(`❌ MATCH failed. Selected cards must all match the picked rank (<strong>${state.picked.rank}</strong>).`);
    return;
  }

  state.middle = state.middle.filter(c=> !state.selectedIds.has(c.id));

  const p = currentPlayer();
  p.pile.push(...selected);

  state.selectedIds.clear();
  state.capturedThisTurn = true;

  logMsg(`✅ <strong>${p.name}</strong> MATCH captured <b>${selected.length}</b> Middle card(s). You can capture again with <strong>${cardLabel(state.picked)}</strong>, or click <strong>PICK</strong> to bank it and draw another card (same turn).`);
  render();
}

function captureAdd(){
  if(state.phase!==PHASE.PLAY) return;
  if(!state.picked) return;

  if(!isNumericCard(state.picked)){
    logMsg(`ADD only works when the picked card is <strong>A</strong> or <strong>2–10</strong>.`);
    return;
  }

  const selected = state.middle.filter(c=>state.selectedIds.has(c.id));
  if(selected.length < 2){
    logMsg(`Select <strong>2 or more</strong> Middle cards to <strong>ADD</strong>.`);
    return;
  }

  const target = addValue(state.picked);
  const sum = selected.reduce((a,c)=>a+addValue(c),0);

  if(sum !== target){
    logMsg(`❌ ADD failed. Selected sum is <b>${sum}</b> but picked is <b>${target}</b>.`);
    return;
  }

  state.middle = state.middle.filter(c=> !state.selectedIds.has(c.id));

  const p = currentPlayer();
  p.pile.push(...selected);

  state.selectedIds.clear();
  state.capturedThisTurn = true;

  logMsg(`✅ <strong>${p.name}</strong> ADD captured <b>${selected.length}</b> Middle card(s) (sum <b>${sum}</b>). You can capture again with <strong>${cardLabel(state.picked)}</strong>, or click <strong>PICK</strong> to bank it and draw another card (same turn).`);
  render();
}

function endTurn(){
  if(state.phase!==PHASE.PLAY) return;

  if(!state.picked){
    advanceTurn();
    render();
    return;
  }

  if(state.capturedThisTurn){
    currentPlayer().pile.push(state.picked);
    logMsg(`<strong>${currentPlayer().name}</strong> ends turn and banks picked card <strong>${cardLabel(state.picked)}</strong>.`);

    state.picked = null;
    state.selectedIds.clear();
    state.capturedThisTurn = false;

    if(state.lastPickTriggered){
      maybeEndGameIfTriggered();
      return;
    }

    advanceTurn();
    render();
    return;
  }

  state.middle.push(state.picked);
  logMsg(`<strong>${currentPlayer().name}</strong> ends turn — unplayed picked card <strong>${cardLabel(state.picked)}</strong> goes to the Middle.`);

  state.picked = null;
  state.selectedIds.clear();
  state.capturedThisTurn = false;

  if(state.lastPickTriggered){
    maybeEndGameIfTriggered();
    return;
  }

  advanceTurn();
  render();
}

// Setup overlay UI
function showSetup(){
  const ov=$("setupOverlay");
  ov.classList.add("show");
  ov.setAttribute("aria-hidden","false");
  rebuildNameFields();
}
function hideSetup(){
  const ov=$("setupOverlay");
  ov.classList.remove("show");
  ov.setAttribute("aria-hidden","true");
}
function rebuildNameFields(){
  const count=parseInt($("playerCount").value,10);
  const box=$("nameFields");
  box.innerHTML="";
  for(let i=0;i<count;i++){
    const wrap=document.createElement("div");
    wrap.className="field";
    wrap.innerHTML = `<label>Player ${i+1} name</label><input type="text" id="pname_${i}" placeholder="Player ${i+1}" />`;
    box.appendChild(wrap);
  }
}

$("playerCount").addEventListener("change", rebuildNameFields);
$("btnCancelSetup").addEventListener("click", ()=> hideSetup());
$("btnStartSetup").addEventListener("click", ()=>{
  const count=parseInt($("playerCount").value,10);
  const names=[];
  for(let i=0;i<count;i++){
    const v=($("pname_"+i).value||"").trim();
    names.push(v || `Player ${i+1}`);
  }
  hideSetup();
  initGame(names);
});

// Wire up
$("circleBtn").addEventListener("click", ()=>{
  if($("circleBtn").classList.contains("disabled")) return;
  drawCard();
});
$("btnClear").addEventListener("click", clearSelection);
$("btnMatch").addEventListener("click", captureMatch);
$("btnAdd").addEventListener("click", captureAdd);
$("btnEnd").addEventListener("click", endTurn);
$("btnNew").addEventListener("click", showSetup);

// Start
showSetup();
