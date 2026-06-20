
// ============================================================
// ESTADO GLOBAL
// ============================================================
const COLORS = ['av-blue','av-coral','av-teal','av-amber','av-purple','av-pink','av-green','av-gray'];
let state = { role: null, playerName: '', roomCode: '', isHost: false };
let roomListenerRef = null;
let fbReady = false;
let lastSeenBuzzerWinner = null;
let myBuzzPressed = false;
let isReconnecting = false;
let connectionLostAt = null;

window.addEventListener('firebase-ready', () => {
  fbReady = true;
  attemptAutoReconnect();
});

// ---- Perfil persistente (nombre recordado en este dispositivo) ----
function getSavedName() { return localStorage.getItem('fdr_player_name') || ''; }
function saveName(name) { localStorage.setItem('fdr_player_name', name); }

// ---- Sesión activa persistente (para reconexión automática) ----
function saveActiveSession() {
  localStorage.setItem('fdr_active_session', JSON.stringify({
    playerName: state.playerName,
    roomCode: state.roomCode,
    isHost: state.isHost,
    savedAt: Date.now()
  }));
}
function getActiveSession() {
  try {
    const raw = localStorage.getItem('fdr_active_session');
    if (!raw) return null;
    const session = JSON.parse(raw);
    // Sessions older than 12 hours are considered stale (event is over)
    if (Date.now() - session.savedAt > 12 * 60 * 60 * 1000) { clearActiveSession(); return null; }
    return session;
  } catch { return null; }
}
function clearActiveSession() { localStorage.removeItem('fdr_active_session'); }

async function attemptAutoReconnect() {
  const session = getActiveSession();
  if (!session || !session.roomCode || !session.playerName) return;
  const currentScreen = document.querySelector('.screen.active').id;
  if (currentScreen !== 'screen-home') return; // already navigated somewhere, don't override

  showReconnectBanner(true);
  const room = await getRoomData(session.roomCode);
  if (!room) { clearActiveSession(); showReconnectBanner(false); return; }

  const stillThere = room.players.find(p => p.id === session.playerName);
  if (!stillThere) { clearActiveSession(); showReconnectBanner(false); return; }

  state.playerName = session.playerName;
  state.roomCode = session.roomCode;
  state.isHost = session.isHost && room.host === session.playerName;
  state.role = state.isHost ? 'host' : 'guest';

  enterLobby();
  // If a game is already in progress, jump straight back into it
  if (room.game) {
    handleGameChange(room);
    updateGameUI(room);
  }
  showReconnectBanner(false);
}

function showReconnectBanner(show) {
  let banner = document.getElementById('reconnect-banner');
  if (show && !banner) {
    banner = document.createElement('div');
    banner.id = 'reconnect-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#185FA5;color:#fff;text-align:center;padding:8px;font-size:13px;z-index:99999;';
    banner.innerHTML = '<span class="spinner" style="border-color:rgba(255,255,255,0.4);border-top-color:#fff;"></span> Reconectando a tu sala...';
    document.body.prepend(banner);
  } else if (!show && banner) {
    banner.remove();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const saved = getSavedName();
  if (saved) {
    document.getElementById('host-name').value = saved;
    document.getElementById('join-name').value = saved;
  }
});

// ---- Detectar pérdida/recuperación de conexión a internet ----
window.addEventListener('offline', () => {
  connectionLostAt = Date.now();
  showConnectionError('🔴 Sin conexión a internet. Reconectando cuando vuelva la señal...');
});
window.addEventListener('online', () => {
  if (state.roomCode) {
    showConnectionError('🟢 Conexión recuperada, sincronizando...');
    startListening(); // re-attach listener, in case Firebase's own reconnect missed it
  }
});

// ---- Sonidos (Web Audio API, sin archivos externos) ----
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
  return audioCtx;
}
function playTone(freq, duration, type='sine', volume=0.15, delay=0) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain); gain.connect(ctx.destination);
    const startTime = ctx.currentTime + delay;
    osc.start(startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.stop(startTime + duration);
  } catch(e) { /* audio not available, ignore */ }
}
function soundBuzzer() { playTone(880, 0.15, 'square', 0.12); }
function soundCorrect() { playTone(523, 0.1, 'sine', 0.12, 0); playTone(659, 0.1, 'sine', 0.12, 0.1); playTone(784, 0.18, 'sine', 0.12, 0.2); }
function soundWrong() { playTone(180, 0.3, 'sawtooth', 0.1); }
function soundClick() { playTone(440, 0.06, 'sine', 0.06); }
function soundWin() {
  [523,659,784,1046].forEach((f,i) => playTone(f, 0.22, 'sine', 0.13, i*0.15));
}

// ---- Confeti ----
function launchConfetti() {
  const colors = ['#185FA5','#BA7517','#3B6D11','#A32D2D','#5B4FC4','#FAC775'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random()*100 + 'vw';
    piece.style.background = colors[Math.floor(Math.random()*colors.length)];
    piece.style.animationDuration = (2 + Math.random()*1.5) + 's';
    piece.style.opacity = 0.7 + Math.random()*0.3;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 4000);
  }
}

function roomRef(code) {
  const { ref, db } = window.__fb;
  return ref(db, 'rooms/' + code);
}

async function getRoomData(code) {
  const { get } = window.__fb;
  try {
    const snap = await get(roomRef(code));
    return snap.exists() ? snap.val() : null;
  } catch (e) {
    console.error('Error reading room:', e);
    showConnectionError();
    return null;
  }
}

async function setRoomData(code, data) {
  const { set } = window.__fb;
  try { await set(roomRef(code), data); } catch (e) { console.error('Error writing room:', e); showConnectionError(); }
}

async function updateRoomData(code, partialData) {
  const { update } = window.__fb;
  try { await update(roomRef(code), partialData); } catch (e) { console.error('Error updating room:', e); showConnectionError(); }
}

function showConnectionError(customMsg) {
  // Floating banner works on any screen, not just screen-home
  let el = document.getElementById('floating-connection-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'floating-connection-banner';
    el.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#A32D2D;color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;z-index:99999;box-shadow:0 4px 14px rgba(0,0,0,0.2);max-width:90%;text-align:center;';
    document.body.appendChild(el);
  }
  el.textContent = customMsg || 'No se pudo conectar. Verifica tu conexión a internet.';
  el.style.display = 'block';
  clearTimeout(el._hideTimeout);
  el._hideTimeout = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:5}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}

// ============================================================
// NAVEGACIÓN
// ============================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function goToCreateRoom() { showScreen('screen-create'); }

async function createRoom() {
  const name = document.getElementById('host-name').value.trim();
  if (!name) { alert('Ingresa tu nombre'); return; }
  saveName(name);
  const btn = document.getElementById('create-room-btn');
  btn.disabled = true; btn.textContent = 'Creando...';

  state.playerName = name;
  state.roomCode = generateCode();
  state.isHost = true;
  state.role = 'host';

  const room = {
    code: state.roomCode,
    host: name,
    players: [{ name, color: COLORS[0], id: name }],
    game: null,
    gameState: {},
    totalScores: { [name]: 0 },
    history: [],
    herdQueue: {},
    photoSubmissionQueue: {}
  };
  await setRoomData(state.roomCode, room);

  btn.disabled = false; btn.textContent = 'Crear sala';
  enterLobby();
}

async function joinRoom() {
  const name = document.getElementById('join-name').value.trim();
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  if (!name) { alert('Ingresa tu nombre'); return; }
  if (code.length < 4) { alert('Ingresa el código de sala'); return; }
  saveName(name);

  const btn = document.getElementById('join-room-btn');
  btn.disabled = true; btn.textContent = 'Conectando...';

  const room = await getRoomData(code);
  if (!room) {
    alert('Sala no encontrada. Verifica el código.');
    btn.disabled = false; btn.textContent = 'Entrar a la sala';
    return;
  }

  const existing = room.players.find(p => p.id === name);
  if (!existing) {
    const colorIdx = room.players.length % COLORS.length;
    room.players.push({ name, color: COLORS[colorIdx], id: name });
    if (!room.totalScores) room.totalScores = {};
    room.totalScores[name] = room.totalScores[name] || 0;
    await setRoomData(code, room);
  }

  state.playerName = name;
  state.roomCode = code;
  state.isHost = false;
  state.role = 'guest';

  btn.disabled = false; btn.textContent = 'Entrar a la sala';
  enterLobby();
}

function enterLobby() {
  showScreen('screen-lobby');
  document.getElementById('lobby-code').textContent = state.roomCode;
  if (state.isHost) {
    document.getElementById('lobby-host-tag').style.display = 'inline';
    document.getElementById('host-controls').style.display = 'block';
    document.getElementById('guest-wait').style.display = 'none';
  } else {
    document.getElementById('lobby-host-tag').style.display = 'none';
    document.getElementById('host-controls').style.display = 'none';
    document.getElementById('guest-wait').style.display = 'block';
  }
  saveActiveSession();
  startListening();
}

async function leaveRoom() {
  stopListening();
  clearActiveSession();
  if (state.isHost) {
    const { remove } = window.__fb;
    try { await remove(roomRef(state.roomCode)); } catch(e) { console.error(e); }
  } else {
    const room = await getRoomData(state.roomCode);
    if (room) {
      room.players = room.players.filter(p => p.id !== state.playerName);
      await setRoomData(state.roomCode, room);
    }
  }
  showScreen('screen-home');
}

async function backToLobby() {
  stopListening();
  await updateRoomData(state.roomCode, { game: null, gameState: {} });
  enterLobby();
}

function backToLobbyFromHistory() {
  enterLobby();
}

// ============================================================
// LISTENER EN TIEMPO REAL
// ============================================================
function startListening() {
  stopListening();
  const { onValue } = window.__fb;
  roomListenerRef = roomRef(state.roomCode);
  onValue(roomListenerRef, (snapshot) => {
    const room = snapshot.val();
    if (!room) return;
    updateLobbyUI(room);
    renderGlobalScoreBars(room);
    if (room.game && !state.isHost) { handleGameChange(room); }
    if (room.game) { updateGameUI(room); }
    const currentScreen = document.querySelector('.screen.active').id;
    if (currentScreen === 'screen-photo-setup') { renderPhotoQueueCountFromRoom(room); }
  }, (error) => { console.error('Listener error:', error); showConnectionError(); });
}

function stopListening() {
  if (roomListenerRef) { const { off } = window.__fb; off(roomListenerRef); roomListenerRef = null; }
}

function updateLobbyUI(room) {
  document.getElementById('player-count').textContent = room.players.length;
  const list = document.getElementById('player-list');
  list.innerHTML = room.players.map((p) => `
    <div class="player-item">
      <div class="player-avatar ${p.color}">${p.name.charAt(0).toUpperCase()}</div>
      <span>${p.name}</span>
      ${p.name === room.host ? '<span class="tag tag-host">Host</span>' : ''}
    </div>`).join('');
}

// ---- Marcador global persistente (visible en todas las pantallas de juego) ----
function renderGlobalScoreBars(room) {
  const totals = room.totalScores || {};
  const sorted = room.players.map(p => ({ name: p.name, score: totals[p.id] ?? totals[p.name] ?? 0 })).sort((a,b) => b.score - a.score);
  const html = sorted.map((p,i) => `<div class="gsb-chip ${p.name===state.playerName?'me':''}">${i===0&&p.score>0?'<span class="gsb-rank1">🥇</span>':''}${p.name}: <b>${p.score}</b></div>`).join('');
  ['global-score-bar','global-score-bar-jh','global-score-bar-jg','global-score-bar-sf','global-score-bar-sfg','global-score-bar-hh','global-score-bar-hg','global-score-bar-fjg','global-score-bar-hmph','global-score-bar-hmphg','global-score-bar-hmphr','global-score-bar-hmpgv','global-score-bar-hmpgvd','global-score-bar-hmpgg','global-score-bar-hmpgwr','global-score-bar-hmpgr','global-score-bar-phh','global-score-bar-phg'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = sorted.length ? 'flex' : 'none'; el.innerHTML = html; }
  });
}

function handleGameChange(room) {
  const currentScreen = document.querySelector('.screen.active').id;
  const fjScreens = ['screen-fj-guest'];
  const hmpScreens = ['screen-hmp-role','screen-hmp-guest-voting','screen-hmp-guest-voted','screen-hmp-guest-guessing','screen-hmp-guest-waiting-result','screen-hmp-guest-result'];
  if (room.game === 'jeopardy' && room.gameState.finalJeopardy) {
    if (!fjScreens.includes(currentScreen)) { showScreen('screen-fj-guest'); }
  } else if (room.game === 'jeopardy' && currentScreen !== 'screen-jeopardy-guest') {
    myBuzzPressed = false; showJeopardyGuest();
  }
  else if (room.game === 'soundfishy' && currentScreen !== 'screen-sf-guest') showSFGuest();
  else if (room.game === 'herd' && currentScreen !== 'screen-herd-guest') showHerdGuest();
  else if (room.game === 'hmp' && !hmpScreens.includes(currentScreen)) { showScreen('screen-hmp-role'); }
  else if (room.game === 'photos' && currentScreen !== 'screen-photo-guest') { myPhotoAnswered = -1; showPhotoGuest(); }
}

function updateGameUI(room) {
  if (room.game === 'jeopardy' && room.gameState.finalJeopardy) {
    if (!state.isHost) {
      updateFJGuestUI(room);
    } else {
      const fj = room.gameState.finalJeopardy;
      const currentScreen = document.querySelector('.screen.active').id;
      if (fj.phase === 'wager' && currentScreen === 'screen-fj-host-wager') {
        renderFJWagerStatus(room);
      } else if (fj.phase === 'question' && currentScreen === 'screen-fj-host-question') {
        updateFJAnswerProgress(room);
      } else if (fj.phase === 'reveal' && currentScreen === 'screen-fj-host-reveal') {
        renderFJRevealCards(room);
      }
    }
  } else if (room.game === 'jeopardy') updateJeopardyUI(room);
  else if (room.game === 'soundfishy') updateSFUI(room);
  else if (room.game === 'herd') updateHerdUI(room);
  else if (room.game === 'hmp') {
    if (!state.isHost) {
      updateHMPGuestUI(room);
    } else {
      const currentScreen = document.querySelector('.screen.active').id;
      if (currentScreen === 'screen-hmp-role') renderHMPRoleListInner(room);
      else if (currentScreen === 'screen-hmp-host-voting') { renderHostOwnHMPVote(room); renderHMPHostVotingList(room); }
      else if (currentScreen === 'screen-hmp-host-guessing') { renderHostOwnHMPGuess(room); renderHMPGuessProgress(room); }
    }
  } else if (room.game === 'photos') {
    if (!state.isHost) {
      updatePhotoGuestUI(room);
    } else {
      const currentScreen = document.querySelector('.screen.active').id;
      if (currentScreen === 'screen-photo-host') renderPhotoAnswersList(room);
    }
  }
}

// ============================================================
// HISTORIAL
// ============================================================
async function showHistory() {
  const room = await getRoomData(state.roomCode);
  if (!room) return;
  showScreen('screen-history');
  const totals = room.totalScores || {};
  const sorted = room.players.map(p => ({ name: p.name, score: totals[p.id] ?? totals[p.name] ?? 0 })).sort((a,b) => b.score - a.score);
  document.getElementById('history-global-scores').innerHTML = '<tr><th>Jugador</th><th>Puntos totales</th></tr>' +
    sorted.map((p,i) => `<tr><td class="${i===0?'rank-1':''}">${i===0?'🥇 ':''}${p.name}</td><td>${p.score}</td></tr>`).join('');

  const history = room.history || [];
  const listEl = document.getElementById('history-list');
  const emptyEl = document.getElementById('history-empty');
  if (!history.length) {
    listEl.innerHTML = ''; emptyEl.style.display = 'block';
  } else {
    emptyEl.style.display = 'none';
    const gameNames = { jeopardy: '📺 Jeopardy', soundfishy: '🐟 Sound Fishy', herd: '🐄 Herd Mentality' };
    listEl.innerHTML = history.slice().reverse().map(h => {
      const date = new Date(h.timestamp);
      const dateStr = date.toLocaleString('es-ES', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
      return `<div class="history-card">
        <div class="history-date">${dateStr}</div>
        <div class="history-winner">🏆 ${h.winner || 'Sin definir'}</div>
        <div class="history-games">${gameNames[h.game] || h.game} — ${h.summary || ''}</div>
      </div>`;
    }).join('');
  }
}

async function addToHistory(game, summary, roundScores) {
  const room = await getRoomData(state.roomCode);
  if (!room) return;
  let winner = null, maxScore = -Infinity;
  Object.entries(roundScores || {}).forEach(([name, score]) => { if (score > maxScore) { maxScore = score; winner = name; } });
  const history = room.history || [];
  history.push({ timestamp: Date.now(), game, winner: maxScore > 0 ? winner : null, summary });
  await updateRoomData(state.roomCode, { history });
}

async function addRoundScoresToTotal(roundScores) {
  const room = await getRoomData(state.roomCode);
  if (!room) return;
  const totals = room.totalScores || {};
  Object.entries(roundScores || {}).forEach(([id, score]) => { totals[id] = (totals[id] || 0) + score; });
  await updateRoomData(state.roomCode, { totalScores: totals });
}


// ============================================================
// TERMINAR RONDA GENÉRICO (Sound Fishy / Herd / HMP) -> guarda historial y vuelve al lobby
// ============================================================
async function finishGenericRound(game) {
  const room = await getRoomData(state.roomCode);
  const scores = room.gameState.scores || {};
  const summaries = { soundfishy: 'Verdad o mentira', herd: 'Mayoría manda', hmp: 'El Hermano Más Probable', photos: 'Galería de Recuerdos' };
  const summary = summaries[game] || game;
  await addRoundScoresToTotal(scores);
  await addToHistory(game, summary, scores);
  soundWin();
  launchConfetti();
  await backToLobby();
}

