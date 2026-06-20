// ============================================================
// HERD MENTALITY
// ============================================================
let myHerdAnswer = null;

function showHerdHost() { showScreen('screen-herd-host'); }
function showHerdGuest() { showScreen('screen-herd-guest'); }

function herdTab(t) {
  document.querySelectorAll('#screen-herd-host .tab').forEach((el,i) => el.classList.toggle('active', (i===0&&t==='ai')||(i===1&&t==='manual')||(i===2&&t==='file')));
  document.getElementById('herd-ai-tab').style.display = t==='ai'?'block':'none';
  document.getElementById('herd-manual-tab').style.display = t==='manual'?'block':'none';
  document.getElementById('herd-file-tab').style.display = t==='file'?'block':'none';
}

let herdUploadedQueue = [];
function processHerdRows(rows) {
  herdUploadedQueue = rows.map(r => r.pregunta).filter(Boolean);
  document.getElementById('herd-sheet-picker').style.display = 'none';
  const previewEl = document.getElementById('herd-file-preview');
  if (!herdUploadedQueue.length) {
    previewEl.innerHTML = '<div class="text-sm">No se encontraron preguntas válidas. Verifica la columna "pregunta".</div>';
    previewEl.style.display = 'block';
    document.getElementById('herd-file-use-btn').style.display = 'none';
    return;
  }
  previewEl.innerHTML = herdUploadedQueue.map((q,i) => `<div class="upload-preview-row">${i+1}. ${q}</div>`).join('');
  previewEl.style.display = 'block';
  document.getElementById('herd-file-use-btn').style.display = 'block';
  document.getElementById('herd-file-use-btn').textContent = `Usar estas ${herdUploadedQueue.length} preguntas`;
}

function pickHerdSheet(sheetName) {
  const rows = window.__herdGetRowsForSheet(sheetName);
  processHerdRows(rows);
}

function handleHerdFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('herd-file-preview').style.display = 'none';
  document.getElementById('herd-file-use-btn').style.display = 'none';
  document.getElementById('herd-sheet-picker').style.display = 'none';
  parseUploadedFile(file, processHerdRows, () => alert('No se pudo leer el archivo. Verifica el formato.'),
    (sheetNames, getRowsForSheet) => {
      window.__herdGetRowsForSheet = getRowsForSheet;
      renderSheetPicker('herd-sheet-picker', sheetNames, 'pickHerdSheet');
    });
}

async function useUploadedHerdQueue() {
  if (!herdUploadedQueue.length) return;
  const room = await getRoomData(state.roomCode);
  room.gameState.herdFileQueue = herdUploadedQueue;
  room.gameState.herdFileQueueIndex = 0;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  await sendHerdQ(herdUploadedQueue[0]);
}

function openProposeModal() { document.getElementById('herd-propose-form').style.display = 'block'; }
function closeProposeModal() { document.getElementById('herd-propose-form').style.display = 'none'; document.getElementById('herd-propose-input').value = ''; }

async function submitProposedQuestion() {
  const q = document.getElementById('herd-propose-input').value.trim();
  if (!q) return;
  const room = await getRoomData(state.roomCode);
  const queue = room.herdQueue || {};
  const id = 'q' + Date.now();
  queue[id] = { text: q, author: state.playerName };
  await updateRoomData(state.roomCode, { herdQueue: queue });
  closeProposeModal();
  alert('¡Pregunta enviada al host!');
}

function renderHerdQueue(room) {
  const queue = room.herdQueue || {};
  const entries = Object.entries(queue);
  document.getElementById('herd-queue-count').textContent = entries.length;
  const listEl = document.getElementById('herd-queue-list');
  if (!entries.length) { listEl.innerHTML = '<div class="text-sm text-center" style="padding:8px 0">Nadie ha propuesto preguntas todavía</div>'; return; }
  listEl.innerHTML = entries.map(([id, item]) => `
    <div class="queue-item">
      <span>"${item.text}" — <span class="text-sm">${item.author}</span></span>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-sm btn-primary" onclick="useQueuedQuestion('${id}')">Usar</button>
        <button class="btn btn-sm" onclick="dismissQueuedQuestion('${id}')">✕</button>
      </div>
    </div>
  `).join('');
}

async function useQueuedQuestion(id) {
  const room = await getRoomData(state.roomCode);
  const item = (room.herdQueue || {})[id];
  if (!item) return;
  delete room.herdQueue[id];
  await updateRoomData(state.roomCode, { herdQueue: room.herdQueue });
  await sendHerdQ(item.text);
}

async function dismissQueuedQuestion(id) {
  const room = await getRoomData(state.roomCode);
  if (!room.herdQueue) return;
  delete room.herdQueue[id];
  await updateRoomData(state.roomCode, { herdQueue: room.herdQueue });
}

async function generateHerdQ() {
  const btn = document.getElementById('herd-gen-btn');
  btn.textContent = 'Generando...'; btn.disabled = true;
  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        max_tokens: 150,
        messages: [{ role: 'user', content: 'Genera UNA pregunta divertida y fácil para el juego Herd Mentality (donde todos intentan responder lo mismo). Debe ser sobre temas familiares, comida, películas, o cultura popular. Debe tener respuestas posibles obvias. Responde SOLO con JSON: {"question":"¿pregunta aquí?"}' }]
      })
    });
    const data = await res.json();
    let text = data.content[0].text.replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(text);
    await sendHerdQ(parsed.question);
  } catch(e) {
    const qs = ["¿Cuál es el mejor día de la semana?","¿Cuál es el animal más popular como mascota?","¿Qué comida pides primero en una pizzería?","¿Cuál es el color favorito de los papás?","¿Qué película de acción es la más famosa?"];
    await sendHerdQ(qs[Math.floor(Math.random()*qs.length)]);
  }
  btn.textContent = 'Generar pregunta'; btn.disabled = false;
}

async function sendManualHerd() {
  const q = document.getElementById('herd-manual-q').value.trim();
  if (!q) { alert('Escribe una pregunta'); return; }
  await sendHerdQ(q);
}

async function sendHerdQ(question) {
  myHerdAnswer = null;
  const room = await getRoomData(state.roomCode);
  room.gameState.herdQ = question;
  room.gameState.herdAnswers = {};
  room.gameState.herdRevealed = false;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  document.getElementById('herd-current').style.display = 'block';
  document.getElementById('herd-results').style.display = 'none';
  document.getElementById('herd-q-text').textContent = question;
  document.getElementById('herd-host-answer-form').style.display = 'block';
  document.getElementById('herd-host-answered').style.display = 'none';
  document.getElementById('herd-host-answer-input').value = '';
}

async function submitHostHerdAnswer() {
  const ans = document.getElementById('herd-host-answer-input').value.trim();
  if (!ans) { alert('Escribe tu respuesta'); return; }
  const room = await getRoomData(state.roomCode);
  if (!room.gameState.herdAnswers) room.gameState.herdAnswers = {};
  room.gameState.herdAnswers[state.playerName] = ans;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  soundClick();
  document.getElementById('herd-host-answer-form').style.display = 'none';
  document.getElementById('herd-host-answered').style.display = 'block';
  updateHerdCount(room);
}

function updateHerdCount(room) {
  const ans = room.gameState.herdAnswers || {};
  const total = room.players.length;
  const count = Object.keys(ans).length;
  document.getElementById('herd-ans-count').textContent = count;
  document.getElementById('herd-ans-total').textContent = total;
  document.getElementById('herd-progress').style.width = (total>0?count/total*100:0)+'%';
  // Reflect whether host already answered (e.g. after a refresh/reconnect)
  const hostAnswered = ans[state.playerName] !== undefined;
  if (hostAnswered) {
    document.getElementById('herd-host-answer-form').style.display = 'none';
    document.getElementById('herd-host-answered').style.display = 'block';
  }
}

async function revealHerd() {
  const room = await getRoomData(state.roomCode);
  const answers = room.gameState.herdAnswers || {};
  const normalized = {};
  Object.entries(answers).forEach(([id, ans]) => { normalized[id] = ans.toLowerCase().trim(); });
  const freq = {};
  Object.values(normalized).forEach(a => freq[a] = (freq[a]||0)+1);
  const maxFreq = Math.max(...Object.values(freq), 0);
  const winAns = Object.entries(freq).filter(([,v])=>v===maxFreq).map(([k])=>k);
  room.players.forEach(p => {
    const myAns = normalized[p.id];
    if (myAns && winAns.includes(myAns) && maxFreq > 1) {
      room.gameState.scores = room.gameState.scores || {};
      room.gameState.scores[p.id] = (room.gameState.scores[p.id]||0) + 1;
    }
  });
  room.gameState.herdRevealed = true;
  room.gameState.herdWinAnswers = winAns;
  room.gameState.herdFreq = freq;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  showHerdResultHost(room);
}

function showHerdResultHost(room) {
  document.getElementById('herd-current').style.display = 'none';
  document.getElementById('herd-results').style.display = 'block';
  renderHerdAnswers(room, 'herd-answers-grid', 'herd-result-msg');
  renderHerdScores(room, 'herd-host-scores');
}

function renderHerdAnswers(room, gridId, msgId) {
  const answers = room.gameState.herdAnswers || {};
  const winAns = room.gameState.herdWinAnswers || [];
  const freq = room.gameState.herdFreq || {};
  const maxFreq = Math.max(...Object.values(freq), 0);
  let html = '';
  room.players.forEach(p => {
    const ans = answers[p.id] || '—';
    const isWinner = winAns.includes(ans.toLowerCase().trim()) && maxFreq > 1;
    html += `<div class="answer-card ${isWinner?'winner':'loser'}"><div class="answer-name">${p.name}</div><div class="answer-text">${ans}</div></div>`;
  });
  document.getElementById(gridId).innerHTML = html;
  if (msgId) {
    const msg = maxFreq > 1 ? `🎉 Respuesta ganadora: "${winAns[0]}" (${maxFreq} votos)` : '🐄 ¡Nadie coincidió! La vaca rosada busca dueño...';
    document.getElementById(msgId).textContent = msg;
  }
}

function renderHerdScores(room, tblId) {
  const scores = room.gameState.scores || {};
  const sorted = room.players.map(p => ({ name: p.name, score: scores[p.id] || 0 })).sort((a,b) => b.score - a.score);
  document.getElementById(tblId).innerHTML = '<tr><th>Jugador</th><th>Pts</th></tr>' +
    sorted.map((p,i) => `<tr><td class="${i===0?'rank-1':''}">${i===0?'🥇 ':''}${p.name}</td><td>${p.score}</td></tr>`).join('');
}

async function nextHerdRound() {
  myHerdAnswer = null;
  const room = await getRoomData(state.roomCode);
  const queue = room.gameState.herdFileQueue;
  document.getElementById('herd-current').style.display = 'none';
  document.getElementById('herd-results').style.display = 'none';
  if (queue && room.gameState.herdFileQueueIndex < queue.length - 1) {
    room.gameState.herdFileQueueIndex++;
    const next = queue[room.gameState.herdFileQueueIndex];
    room.gameState.herdQ = null;
    room.gameState.herdRevealed = false;
    await updateRoomData(state.roomCode, { gameState: room.gameState });
    await sendHerdQ(next);
  } else {
    room.gameState.herdQ = null;
    room.gameState.herdRevealed = false;
    await updateRoomData(state.roomCode, { gameState: room.gameState });
  }
}

async function submitHerdAnswer() {
  const ans = document.getElementById('herd-my-answer').value.trim();
  if (!ans) { alert('Escribe tu respuesta'); return; }
  myHerdAnswer = ans;
  soundClick();
  const room = await getRoomData(state.roomCode);
  if (!room.gameState.herdAnswers) room.gameState.herdAnswers = {};
  room.gameState.herdAnswers[state.playerName] = ans;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  document.getElementById('herd-guest-answer').style.display = 'none';
  document.getElementById('herd-guest-answered').style.display = 'block';
}

function updateHerdUI(room) {
  if (state.isHost) {
    updateHerdCount(room);
    renderHerdQueue(room);
    if (room.gameState.herdRevealed) showHerdResultHost(room);
  } else {
    const q = room.gameState.herdQ;
    if (!q) {
      document.getElementById('herd-guest-wait').style.display = 'block';
      document.getElementById('herd-guest-answer').style.display = 'none';
      document.getElementById('herd-guest-answered').style.display = 'none';
      document.getElementById('herd-guest-result').style.display = 'none';
      myHerdAnswer = null;
    } else if (room.gameState.herdRevealed) {
      document.getElementById('herd-guest-wait').style.display = 'none';
      document.getElementById('herd-guest-answer').style.display = 'none';
      document.getElementById('herd-guest-answered').style.display = 'none';
      document.getElementById('herd-guest-result').style.display = 'block';
      renderHerdAnswers(room, 'herd-guest-answers-grid', 'herd-guest-result-msg');
      renderHerdScores(room, 'herd-guest-scores');
    } else if (!myHerdAnswer) {
      document.getElementById('herd-guest-wait').style.display = 'none';
      document.getElementById('herd-guest-answer').style.display = 'block';
      document.getElementById('herd-guest-answered').style.display = 'none';
      document.getElementById('herd-guest-result').style.display = 'none';
      document.getElementById('herd-guest-q').textContent = q;
      document.getElementById('herd-my-answer').value = '';
    }
  }
}

