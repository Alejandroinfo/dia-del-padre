// ============================================================
// WAVELENGTH (2 equipos, escala 1-20, slider compartido en tiempo real)
// ============================================================
let wlUploadedQueue = []; // [{categoria}]
let wlDraggingSlider = false;
let mySideGuessSubmitted = false;

// ---- Setup de equipos ----
function goToWavelengthTeamSetup() {
  showScreen('screen-wl-team-setup');
}

async function setupWavelengthTeams(mode) {
  const room = await getRoomData(state.roomCode);
  if (mode === 'random') {
    const shuffled = [...room.players].sort(() => Math.random() - 0.5);
    const half = Math.ceil(shuffled.length / 2);
    const teamA = shuffled.slice(0, half).map(p => p.id);
    const teamB = shuffled.slice(half).map(p => p.id);
    await initWavelengthGame(teamA, teamB);
  } else {
    // choice mode: clear any prior picks, let everyone choose
    await updateRoomData(state.roomCode, { wlTeamChoices: {} });
    showScreen('screen-wl-team-choice');
    renderWLTeamChoiceScreen(await getRoomData(state.roomCode));
  }
}

async function chooseWavelengthTeam(team) {
  soundClick();
  const room = await getRoomData(state.roomCode);
  const choices = room.wlTeamChoices || {};
  choices[state.playerName] = team;
  await updateRoomData(state.roomCode, { wlTeamChoices: choices });
}

function renderWLTeamChoiceScreen(room) {
  const choices = room.wlTeamChoices || {};
  const teamAMembers = room.players.filter(p => choices[p.id] === 'A');
  const teamBMembers = room.players.filter(p => choices[p.id] === 'B');
  document.getElementById('wl-team-a-members').innerHTML = teamAMembers.length
    ? teamAMembers.map(p => p.name).join(', ') : 'Nadie ha elegido este equipo';
  document.getElementById('wl-team-b-members').innerHTML = teamBMembers.length
    ? teamBMembers.map(p => p.name).join(', ') : 'Nadie ha elegido este equipo';

  if (state.isHost) {
    document.getElementById('wl-guest-wait-teams').style.display = 'none';
    const bothHaveMembers = teamAMembers.length > 0 && teamBMembers.length > 0;
    document.getElementById('wl-host-start-area').style.display = bothHaveMembers ? 'block' : 'none';
  } else {
    document.getElementById('wl-guest-wait-teams').style.display = 'block';
  }
}

async function startWavelengthGame() {
  const room = await getRoomData(state.roomCode);
  const choices = room.wlTeamChoices || {};
  const teamA = room.players.filter(p => choices[p.id] === 'A').map(p => p.id);
  const teamB = room.players.filter(p => choices[p.id] === 'B').map(p => p.id);
  // Anyone who didn't choose gets auto-assigned to balance teams
  const unassigned = room.players.filter(p => !choices[p.id]).map(p => p.id);
  unassigned.forEach((id, i) => { (teamA.length <= teamB.length ? teamA : teamB).push(id); });
  await initWavelengthGame(teamA, teamB);
}

async function initWavelengthGame(teamA, teamB) {
  const room = await getRoomData(state.roomCode);
  const startingTeam = Math.random() < 0.5 ? 'A' : 'B';
  const otherTeam = startingTeam === 'A' ? 'B' : 'A';
  room.gameState.wl = {
    phase: 'category-setup',
    teams: { A: teamA, B: teamB },
    startingTeam,
    turnTeam: startingTeam,
    psychicIndex: { A: 0, B: 0 },
    category: null,
    targetNumber: null,
    clue: '',
    sliderValue: 10,
    confirmed: false,
    guessSide: null,
    scores: { [startingTeam]: 0, [otherTeam]: 1 }
  };
  await updateRoomData(state.roomCode, { game: 'wavelength', gameState: room.gameState });
  routeWavelengthScreen(await getRoomData(state.roomCode));
}

function getWLPsychicId(room) {
  const wl = room.gameState.wl;
  const team = wl.teams[wl.turnTeam];
  const idx = wl.psychicIndex[wl.turnTeam] % team.length;
  return team[idx];
}

function getWLOtherTeam(team) { return team === 'A' ? 'B' : 'A'; }

// ---- Category setup (host picks source) ----
function wlTab(t) {
  document.querySelectorAll('#screen-wl-category-setup .tab').forEach((el,i) => el.classList.toggle('active', (i===0&&t==='ai')||(i===1&&t==='manual')||(i===2&&t==='file')));
  document.getElementById('wl-ai-tab').style.display = t==='ai'?'block':'none';
  document.getElementById('wl-manual-tab').style.display = t==='manual'?'block':'none';
  document.getElementById('wl-file-tab').style.display = t==='file'?'block':'none';
}

function processWLRows(rows) {
  wlUploadedQueue = rows.map(r => ({ categoria: r.categoria })).filter(r => r.categoria);
  document.getElementById('wl-sheet-picker').style.display = 'none';
  const previewEl = document.getElementById('wl-file-preview');
  if (!wlUploadedQueue.length) {
    previewEl.innerHTML = '<div class="text-sm">No se encontraron filas válidas. Verifica la columna "categoria".</div>';
    previewEl.style.display = 'block';
    document.getElementById('wl-file-use-btn').style.display = 'none';
    return;
  }
  previewEl.innerHTML = wlUploadedQueue.map((r,i) => `<div class="upload-preview-row">${i+1}. ${r.categoria}</div>`).join('');
  previewEl.style.display = 'block';
  document.getElementById('wl-file-use-btn').style.display = 'block';
  document.getElementById('wl-file-use-btn').textContent = `Usar estas ${wlUploadedQueue.length} categorías`;
}

function pickWLSheet(sheetName) {
  const rows = window.__wlGetRowsForSheet(sheetName);
  processWLRows(rows);
}

function handleWLFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('wl-file-preview').style.display = 'none';
  document.getElementById('wl-file-use-btn').style.display = 'none';
  document.getElementById('wl-sheet-picker').style.display = 'none';
  parseUploadedFile(file, processWLRows, () => alert('No se pudo leer el archivo. Verifica el formato.'),
    (sheetNames, getRowsForSheet) => {
      window.__wlGetRowsForSheet = getRowsForSheet;
      renderSheetPicker('wl-sheet-picker', sheetNames, 'pickWLSheet');
    });
}

async function useUploadedWLQueue() {
  if (!wlUploadedQueue.length) return;
  const room = await getRoomData(state.roomCode);
  room.gameState.wlFileQueue = wlUploadedQueue;
  room.gameState.wlFileQueueIndex = 0;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  const first = wlUploadedQueue[0];
  await startWLTurn(first.categoria);
}

async function generateWLCategory() {
  const btn = document.getElementById('wl-gen-btn');
  btn.textContent = 'Generando...'; btn.disabled = true;
  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Genera UNA categoría corta (1-3 palabras) para el juego Wavelength, donde el grupo debe imaginar un espectro del 1 al 20 (ej: "Picante", "Utilidad", "Fama", "Suerte"). Que sea divertida y familiar. Responde SOLO con JSON: {"categoria":"..."}' }]
      })
    });
    const data = await res.json();
    let text = data.content[0].text.replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(text);
    await startWLTurn(parsed.categoria);
  } catch(e) {
    const examples = ['Picante', 'Fama', 'Probabilidad', 'Suerte', 'Utilidad', 'Comodidad', 'Velocidad'];
    const ex = examples[Math.floor(Math.random()*examples.length)];
    await startWLTurn(ex);
  }
  btn.textContent = '✨ Generar categoría'; btn.disabled = false;
}

async function useManualWLCategory() {
  const cat = document.getElementById('wl-manual-cat').value.trim();
  if (!cat) { alert('Escribe una categoría'); return; }
  await startWLTurn(cat);
}

async function startWLTurn(categoria) {
  const room = await getRoomData(state.roomCode);
  const wl = room.gameState.wl;
  wl.category = { name: categoria };
  wl.targetNumber = Math.floor(Math.random() * 20) + 1; // 1-20
  wl.clue = '';
  wl.sliderValue = 10;
  wl.confirmed = false;
  wl.guessSide = null;
  wl.phase = 'clue';
  mySideGuessSubmitted = false;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  routeWavelengthScreen(await getRoomData(state.roomCode));
}

// ---- Slider rendering (shared component used in 3 places: psychic helper view, team view, reveal view) ----
function renderWLSliderHTML(containerId, opts) {
  // opts: { value, interactive, showTarget, targetValue, idPrefix }
  const idPrefix = opts.idPrefix || 'wl';
  const html = `
    <div class="wl-slider-scale-labels"><span>1</span><span>20</span></div>
    <div class="wl-slider-track-wrap">
      <div class="wl-slider-track" id="${idPrefix}-track">
        ${opts.showTarget ? `<div class="wl-slider-target-marker" id="${idPrefix}-target-marker"></div>` : ''}
        <div class="wl-slider-handle" id="${idPrefix}-handle">${opts.value}</div>
      </div>
    </div>
    <div class="wl-slider-value-readout" id="${idPrefix}-readout">${opts.value}</div>
  `;
  document.getElementById(containerId).innerHTML = html;
  positionWLHandle(idPrefix, opts.value);
  if (opts.showTarget && opts.targetValue) {
    positionWLTargetMarker(idPrefix, opts.targetValue);
  }
  if (opts.interactive) {
    attachWLSliderDrag(idPrefix);
  }
}

function valueToPercent(val) { return ((val - 1) / 19) * 100; }

function positionWLHandle(idPrefix, value) {
  const handle = document.getElementById(`${idPrefix}-handle`);
  if (!handle) return;
  handle.style.left = valueToPercent(value) + '%';
  handle.textContent = value;
  const readout = document.getElementById(`${idPrefix}-readout`);
  if (readout) readout.textContent = value;
}

function positionWLTargetMarker(idPrefix, value) {
  const marker = document.getElementById(`${idPrefix}-target-marker`);
  if (!marker) return;
  marker.style.left = valueToPercent(value) + '%';
}

function attachWLSliderDrag(idPrefix) {
  const track = document.getElementById(`${idPrefix}-track`);
  const handle = document.getElementById(`${idPrefix}-handle`);
  if (!track || !handle) return;

  function valueFromClientX(clientX) {
    const rect = track.getBoundingClientRect();
    let pct = (clientX - rect.left) / rect.width;
    pct = Math.max(0, Math.min(1, pct));
    return Math.round(pct * 19) + 1;
  }

  function onMove(clientX) {
    const val = valueFromClientX(clientX);
    positionWLHandle(idPrefix, val);
    pushWLSliderValue(val);
  }

  function onPointerDown(e) {
    wlDraggingSlider = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    onMove(clientX);
    e.preventDefault();
  }
  function onPointerMoveWindow(e) {
    if (!wlDraggingSlider) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    onMove(clientX);
  }
  function onPointerUp() { wlDraggingSlider = false; }

  handle.addEventListener('mousedown', onPointerDown);
  handle.addEventListener('touchstart', onPointerDown, { passive: false });
  track.addEventListener('mousedown', onPointerDown);
  track.addEventListener('touchstart', onPointerDown, { passive: false });
  window.addEventListener('mousemove', onPointerMoveWindow);
  window.addEventListener('touchmove', onPointerMoveWindow, { passive: false });
  window.addEventListener('mouseup', onPointerUp);
  window.addEventListener('touchend', onPointerUp);
}

let wlSliderPushTimeout = null;
async function pushWLSliderValue(val) {
  // Throttle writes to Firebase so dragging doesn't spam updates
  clearTimeout(wlSliderPushTimeout);
  wlSliderPushTimeout = setTimeout(async () => {
    const room = await getRoomData(state.roomCode);
    if (!room.gameState.wl || room.gameState.wl.confirmed) return;
    room.gameState.wl.sliderValue = val;
    await updateRoomData(state.roomCode, { gameState: room.gameState });
  }, 80);
}

// ---- Psychic screen ----
function showWLPsychic(room) {
  showScreen('screen-wl-psychic');
  const wl = room.gameState.wl;
  document.getElementById('wl-psychic-cat-name').textContent = wl.category.name;
  document.getElementById('wl-psychic-number-display').textContent = wl.targetNumber;

  const clueSent = !!wl.clue;
  document.getElementById('wl-psychic-clue-form').style.display = clueSent ? 'none' : 'block';
  document.getElementById('wl-psychic-clue-sent').style.display = clueSent ? 'block' : 'none';

  const sliderArea = document.getElementById('wl-psychic-slider-area');
  if (clueSent && wl.phase === 'clue') {
    sliderArea.style.display = 'block';
    renderWLSliderHTML('wl-psychic-slider-area', { value: wl.sliderValue, interactive: true, idPrefix: 'wl-psy' });
  } else {
    sliderArea.style.display = 'none';
  }
}

async function submitWLClue() {
  const clue = document.getElementById('wl-clue-input').value.trim();
  if (!clue) { alert('Escribe una pista'); return; }
  const room = await getRoomData(state.roomCode);
  room.gameState.wl.clue = clue;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  soundClick();
}

// ---- Team (in-turn) screen: everyone on the turn team (including psychic) can drag ----
function showWLTeamSlider(room) {
  showScreen('screen-wl-team-slider');
  const wl = room.gameState.wl;
  document.getElementById('wl-team-cat-name').textContent = wl.category.name;
  document.getElementById('wl-team-clue-display').textContent = '"' + wl.clue + '"';
  renderWLSliderHTML('wl-slider-container', { value: wl.sliderValue, interactive: true, idPrefix: 'wl-team' });
}

function updateWLPsychicLive(room) {
  const wl = room.gameState.wl;
  const clueSent = !!wl.clue;
  const sliderAlreadyRendered = document.getElementById('wl-psy-handle') !== null;

  if (clueSent && !sliderAlreadyRendered) {
    // First time the clue gets sent (could be from this device or a teammate) — build the slider now
    showWLPsychic(room);
    return;
  }
  if (!clueSent) {
    // Clue not sent yet — keep showing the clue form (no rebuild needed unless state changed)
    return;
  }
  // Slider already exists — just move it, don't rebuild (preserves any in-progress drag)
  if (!wlDraggingSlider) {
    positionWLHandle('wl-psy', wl.sliderValue);
  }
}

function updateWLTeamSliderLive(room) {
  // called on every realtime update while on this screen, to reflect teammates' drags
  if (wlDraggingSlider) return; // don't fight the local user's own drag
  positionWLHandle('wl-team', room.gameState.wl.sliderValue);
}

async function confirmWLSliderValue() {
  const room = await getRoomData(state.roomCode);
  room.gameState.wl.confirmed = true;
  room.gameState.wl.phase = 'guessing-side';
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  soundCorrect();
}

// ---- Other team: guessing left/right ----
function showWLGuessSide(room) {
  showScreen('screen-wl-guess-side');
  renderWLSliderHTML('wl-guess-slider-display', { value: room.gameState.wl.sliderValue, interactive: false, idPrefix: 'wl-guessdisp' });
}

async function submitWLSideGuess(side) {
  if (mySideGuessSubmitted) return;
  mySideGuessSubmitted = true;
  soundClick();
  const room = await getRoomData(state.roomCode);
  if (room.gameState.wl.guessSide) return; // someone on the team already answered
  room.gameState.wl.guessSide = side;
  room.gameState.wl.phase = 'reveal';
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  computeWLPoints(await getRoomData(state.roomCode));
}

// ---- Reveal & scoring ----
let wlPointsComputed = false;
async function computeWLPoints(room) {
  if (wlPointsComputed) return;
  wlPointsComputed = true;
  const wl = room.gameState.wl;
  const target = wl.targetNumber;
  const guess = wl.sliderValue;
  const distance = Math.abs(target - guess);

  let turnTeamPoints = 0;
  if (distance === 0) turnTeamPoints = 4;
  else if (distance === 1) turnTeamPoints = 3;
  else if (distance === 2) turnTeamPoints = 2;
  else if (distance <= 4) turnTeamPoints = 1;

  const actualSide = target < guess ? 'left' : (target > guess ? 'right' : null);
  const otherTeamCorrect = wl.guessSide && actualSide && wl.guessSide === actualSide;
  const otherTeam = getWLOtherTeam(wl.turnTeam);

  wl.scores[wl.turnTeam] = (wl.scores[wl.turnTeam] || 0) + turnTeamPoints;
  if (otherTeamCorrect) { wl.scores[otherTeam] = (wl.scores[otherTeam] || 0) + 1; }

  wl.lastResult = { distance, turnTeamPoints, otherTeamCorrect, actualSide };
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  (turnTeamPoints >= 3) ? soundWin() : (turnTeamPoints > 0 ? soundCorrect() : soundWrong());
  if (turnTeamPoints >= 3) launchConfetti();
  showWLReveal(await getRoomData(state.roomCode));
}

function showWLReveal(room) {
  showScreen('screen-wl-reveal');
  const wl = room.gameState.wl;
  document.getElementById('wl-reveal-number').textContent = wl.targetNumber;
  renderWLSliderHTML('wl-reveal-slider-display', { value: wl.sliderValue, interactive: false, showTarget: true, targetValue: wl.targetNumber, idPrefix: 'wl-reveal' });

  const r = wl.lastResult || {};
  const turnTeamLabel = wl.turnTeam === 'A' ? '🔵 Equipo Azul' : '🔴 Equipo Rojo';
  const otherTeamLabel = wl.turnTeam === 'A' ? '🔴 Equipo Rojo' : '🔵 Equipo Azul';
  let html = `<div>${turnTeamLabel} estuvo a ${r.distance} de distancia → <b>+${r.turnTeamPoints} pts</b></div>`;
  if (wl.guessSide) {
    html += `<div>${otherTeamLabel} adivinó "${wl.guessSide === 'left' ? 'izquierda' : 'derecha'}" → ${r.otherTeamCorrect ? '<b>+1 pt (correcto)</b>' : 'incorrecto, 0 pts'}</div>`;
  }
  document.getElementById('wl-points-breakdown').innerHTML = html;

  const winningTeam = Object.entries(wl.scores).find(([,s]) => s >= 10);
  document.getElementById('wl-host-next-btn').style.display = (state.isHost && !winningTeam) ? 'block' : 'none';
  document.getElementById('wl-guest-wait-next').style.display = (!state.isHost && !winningTeam) ? 'block' : 'none';

  if (winningTeam && state.isHost) {
    setTimeout(() => showWLWinner(room), 2500);
  } else if (winningTeam) {
    setTimeout(() => { if (document.querySelector('.screen.active').id === 'screen-wl-reveal') showWLWinner(room); }, 2500);
  }
}

function showWLWinner(room) {
  const wl = room.gameState.wl;
  showScreen('screen-wl-winner');
  const winningTeamKey = Object.entries(wl.scores).find(([,s]) => s >= 10)[0];
  const label = winningTeamKey === 'A' ? '🔵 ¡Gana el Equipo Azul!' : '🔴 ¡Gana el Equipo Rojo!';
  document.getElementById('wl-winner-team-name').textContent = label;
  document.getElementById('wl-final-score-row').innerHTML = `
    <div class="wl-score-side"><div class="wl-score-num" style="color:#185FA5;">${wl.scores.A || 0}</div><div class="wl-score-label">🔵 Azul</div></div>
    <div class="wl-score-vs">VS</div>
    <div class="wl-score-side"><div class="wl-score-num" style="color:#A32D2D;">${wl.scores.B || 0}</div><div class="wl-score-label">🔴 Rojo</div></div>
  `;
}

async function nextWLTurn() {
  wlPointsComputed = false;
  mySideGuessSubmitted = false;
  const room = await getRoomData(state.roomCode);
  const wl = room.gameState.wl;
  // Advance psychic index for the team that just played, then switch turn to the other team
  wl.psychicIndex[wl.turnTeam] = (wl.psychicIndex[wl.turnTeam] || 0) + 1;
  wl.turnTeam = getWLOtherTeam(wl.turnTeam);
  wl.phase = 'category-setup';
  wl.category = null;
  wl.targetNumber = null;
  wl.clue = '';
  wl.sliderValue = 10;
  wl.confirmed = false;
  wl.guessSide = null;
  wl.lastResult = null;

  const queue = room.gameState.wlFileQueue;
  await updateRoomData(state.roomCode, { gameState: room.gameState });

  if (queue && room.gameState.wlFileQueueIndex < queue.length - 1) {
    room.gameState.wlFileQueueIndex++;
    const next = queue[room.gameState.wlFileQueueIndex];
    await updateRoomData(state.roomCode, { gameState: room.gameState });
    await startWLTurn(next.categoria);
  } else {
    routeWavelengthScreen(await getRoomData(state.roomCode));
  }
}

// ---- Master router: decides what screen each player should see based on wl.phase + their team/role ----
function routeWavelengthScreen(room) {
  const wl = room.gameState.wl;
  if (!wl) return;
  const myTeam = wl.teams.A.includes(state.playerName) ? 'A' : (wl.teams.B.includes(state.playerName) ? 'B' : null);
  const isMyTeamTurn = myTeam === wl.turnTeam;
  const psychicId = wl.phase !== 'category-setup' ? getWLPsychicId(room) : null;
  const amPsychic = psychicId === state.playerName;

  if (wl.phase === 'category-setup') {
    if (state.isHost) {
      showScreen('screen-wl-category-setup');
      renderWLCategorySetupInfo(room);
    } else {
      showScreen('screen-wl-other-team-wait');
    }
    return;
  }

  if (wl.phase === 'clue') {
    if (amPsychic) { showWLPsychic(room); }
    else if (isMyTeamTurn) { showWLTeamSlider(room); }
    else { showScreen('screen-wl-other-team-wait'); }
    return;
  }

  if (wl.phase === 'guessing-side') {
    if (isMyTeamTurn) {
      // turn team already confirmed; show them a waiting screen until reveal
      showScreen('screen-wl-other-team-wait');
    } else {
      if (mySideGuessSubmitted || wl.guessSide) {
        showScreen('screen-wl-other-team-wait');
      } else {
        showWLGuessSide(room);
      }
    }
    return;
  }

  if (wl.phase === 'reveal') {
    showWLReveal(room);
    return;
  }
}

function renderWLCategorySetupInfo(room) {
  const wl = room.gameState.wl;
  document.getElementById('wl-setup-score-row').innerHTML = `
    <div class="wl-score-side"><div class="wl-score-num" style="color:#185FA5;">${wl.scores.A || 0}</div><div class="wl-score-label">🔵 Azul</div></div>
    <div class="wl-score-vs">VS</div>
    <div class="wl-score-side"><div class="wl-score-num" style="color:#A32D2D;">${wl.scores.B || 0}</div><div class="wl-score-label">🔴 Rojo</div></div>
  `;
  const turnLabel = wl.turnTeam === 'A' ? '🔵 Equipo Azul' : '🔴 Equipo Rojo';
  document.getElementById('wl-setup-turn-team').textContent = turnLabel;
  const psychicId = getWLPsychicId(room);
  const psychicPlayer = room.players.find(p => p.id === psychicId);
  document.getElementById('wl-setup-psychic-name').textContent = psychicPlayer ? psychicPlayer.name : psychicId;
}

// ---- Hook into the central game router (called from core.js) ----
function handleGameChangeWavelength(room) {
  const wlScreens = ['screen-wl-team-choice','screen-wl-category-setup','screen-wl-psychic','screen-wl-team-slider','screen-wl-other-team-wait','screen-wl-guess-side','screen-wl-reveal','screen-wl-winner'];
  const currentScreen = document.querySelector('.screen.active').id;
  if (!wlScreens.includes(currentScreen)) {
    routeWavelengthScreen(room);
  }
}

function updateGameUIWavelength(room) {
  const wl = room.gameState.wl;
  if (!wl) {
    // Team-choice phase, before wl object exists
    const currentScreen = document.querySelector('.screen.active').id;
    if (currentScreen === 'screen-wl-team-choice') {
      renderWLTeamChoiceScreen(room);
    }
    return;
  }
  const currentScreen = document.querySelector('.screen.active').id;

  // Re-route if the phase changed in a way that requires a different screen
  const expectedScreenChanged = (
    (wl.phase === 'category-setup' && currentScreen !== 'screen-wl-category-setup' && currentScreen !== 'screen-wl-other-team-wait') ||
    (wl.phase === 'clue' && !['screen-wl-psychic','screen-wl-team-slider','screen-wl-other-team-wait'].includes(currentScreen)) ||
    (wl.phase === 'guessing-side' && !['screen-wl-guess-side','screen-wl-other-team-wait'].includes(currentScreen)) ||
    (wl.phase === 'reveal' && currentScreen !== 'screen-wl-reveal' && currentScreen !== 'screen-wl-winner')
  );

  if (expectedScreenChanged) {
    routeWavelengthScreen(room);
    return;
  }

  // Same screen, just refresh live data
  if (currentScreen === 'screen-wl-category-setup') renderWLCategorySetupInfo(room);
  else if (currentScreen === 'screen-wl-team-slider') updateWLTeamSliderLive(room);
  else if (currentScreen === 'screen-wl-psychic') updateWLPsychicLive(room);
  else if (currentScreen === 'screen-wl-guess-side') { if (wl.guessSide) routeWavelengthScreen(room); }
  else if (currentScreen === 'screen-wl-reveal') showWLReveal(room);
}
