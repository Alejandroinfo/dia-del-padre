// ============================================================
// SOUND FISHY (adivinador rotativo, estilo Fibbage/Balderdash)
// ============================================================
let sfUploadedQueue = []; // [{statement, answer}]

function showSFHost() {
  showScreen('screen-sf-host');
  document.getElementById('sf-source-section').style.display = 'block';
  document.getElementById('sf-writing-section').style.display = 'none';
  document.getElementById('sf-guessing-host-section').style.display = 'none';
  document.getElementById('sf-result-section').style.display = 'none';
}
function showSFGuest() { showScreen('screen-sf-guest'); }

function sfTab(t) {
  document.querySelectorAll('#screen-sf-host .tab').forEach((el,i) => el.classList.toggle('active', (i===0&&t==='ai')||(i===1&&t==='manual')||(i===2&&t==='file')));
  document.getElementById('sf-ai-tab').style.display = t==='ai'?'block':'none';
  document.getElementById('sf-manual-tab').style.display = t==='manual'?'block':'none';
  document.getElementById('sf-file-tab').style.display = t==='file'?'block':'none';
}

function processSFRows(rows) {
  sfUploadedQueue = rows.map(r => ({ statement: r.afirmacion, answer: r.respuesta })).filter(r => r.statement && r.answer);
  document.getElementById('sf-sheet-picker').style.display = 'none';
  const previewEl = document.getElementById('sf-file-preview');
  if (!sfUploadedQueue.length) {
    previewEl.innerHTML = '<div class="text-sm">No se encontraron filas válidas. Verifica las columnas "afirmacion" (pregunta) y "respuesta".</div>';
    previewEl.style.display = 'block';
    document.getElementById('sf-file-use-btn').style.display = 'none';
    return;
  }
  previewEl.innerHTML = sfUploadedQueue.map((r,i) => `<div class="upload-preview-row">${i+1}. ${r.statement} <b>→ ${r.answer}</b></div>`).join('');
  previewEl.style.display = 'block';
  document.getElementById('sf-file-use-btn').style.display = 'block';
  document.getElementById('sf-file-use-btn').textContent = `Usar estas ${sfUploadedQueue.length} preguntas`;
}

function pickSFSheet(sheetName) {
  const rows = window.__sfGetRowsForSheet(sheetName);
  processSFRows(rows);
}

function handleSFFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('sf-file-preview').style.display = 'none';
  document.getElementById('sf-file-use-btn').style.display = 'none';
  document.getElementById('sf-sheet-picker').style.display = 'none';
  parseUploadedFile(file, processSFRows, () => alert('No se pudo leer el archivo. Verifica el formato.'),
    (sheetNames, getRowsForSheet) => {
      window.__sfGetRowsForSheet = getRowsForSheet;
      renderSheetPicker('sf-sheet-picker', sheetNames, 'pickSFSheet');
    });
}

async function useUploadedSFQueue() {
  if (!sfUploadedQueue.length) return;
  const room = await getRoomData(state.roomCode);
  room.gameState.sfFileQueue = sfUploadedQueue;
  room.gameState.sfFileQueueIndex = 0;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  await startSFRound(sfUploadedQueue[0].statement, sfUploadedQueue[0].answer);
}

async function generateSFStatement() {
  const btn = document.getElementById('sf-gen-btn');
  const hint = document.getElementById('sf-dad-hint').value.trim();
  btn.textContent = 'Generando...'; btn.disabled = true;
  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        max_tokens: 200,
        messages: [{ role: 'user', content: `Genera UNA pregunta de hechos con una respuesta corta y específica, sobre un papá o familia (estilo "¿Cuál fue el primer trabajo de papá?" o "¿En qué ciudad nació papá?"). ${hint?'Contexto: '+hint:''} Responde SOLO con JSON: {"statement":"la pregunta aquí","answer":"la respuesta real aquí"}` }]
      })
    });
    const data = await res.json();
    let text = data.content[0].text.replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(text);
    await startSFRound(parsed.statement, parsed.answer);
  } catch(e) {
    const examples = [
      {statement:"¿Cuál es la comida favorita de papá?", answer:"Los tacos"},
      {statement:"¿En qué año nació papá?", answer:"1975"},
      {statement:"¿Cuál fue el primer trabajo de papá?", answer:"Respuesta libre"},
    ];
    const ex = examples[Math.floor(Math.random()*examples.length)];
    await startSFRound(ex.statement, ex.answer);
  }
  btn.textContent = 'Generar pregunta'; btn.disabled = false;
}

async function sendManualSF() {
  const text = document.getElementById('sf-manual-text').value.trim();
  const answer = document.getElementById('sf-manual-answer').value.trim();
  if (!text || !answer) { alert('Completa la pregunta y la respuesta real'); return; }
  await startSFRound(text, answer);
}

function pickNextSFGuesser(room) {
  const order = room.players.map(p => p.id);
  const lastIdx = room.gameState.sfTurnIndex ?? -1;
  const nextIdx = (lastIdx + 1) % order.length;
  return { guesserId: order[nextIdx], turnOrder: order, turnIndex: nextIdx };
}

async function startSFRound(statement, answer) {
  const room = await getRoomData(state.roomCode);
  const { guesserId, turnOrder, turnIndex } = pickNextSFGuesser(room);
  room.gameState.sfTurnIndex = turnIndex;
  room.gameState.sf = {
    phase: 'writing',
    question: statement,
    realAnswer: answer,
    guesserId,
    turnOrder,
    submissions: {},
    revealOrder: [],
    judgments: {},
    failedAt: null
  };
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  showSFWritingHost(room);
}

function showSFWritingHost(room) {
  document.getElementById('sf-source-section').style.display = 'none';
  document.getElementById('sf-writing-section').style.display = 'block';
  document.getElementById('sf-guessing-host-section').style.display = 'none';
  document.getElementById('sf-result-section').style.display = 'none';
  renderSFWritingHost(room);
}

function renderSFWritingHost(room) {
  const sf = room.gameState.sf;
  const guesser = room.players.find(p => p.id === sf.guesserId);
  document.getElementById('sf-host-question-text').textContent = sf.question;
  document.getElementById('sf-host-guesser-name').textContent = guesser ? guesser.name : sf.guesserId;

  const amGuesser = state.playerName === sf.guesserId;
  const ownArea = document.getElementById('sf-host-own-answer-area');
  const ownAnswered = document.getElementById('sf-host-own-answered');
  if (amGuesser) {
    ownArea.style.display = 'none'; ownAnswered.style.display = 'none';
  } else {
    const submitted = sf.submissions && sf.submissions[state.playerName] !== undefined;
    ownArea.style.display = submitted ? 'none' : 'block';
    ownAnswered.style.display = submitted ? 'block' : 'none';
  }

  const writers = room.players.filter(p => p.id !== sf.guesserId);
  const subCount = Object.keys(sf.submissions || {}).length;
  document.getElementById('sf-write-count').textContent = subCount;
  document.getElementById('sf-write-total').textContent = writers.length;
  document.getElementById('sf-write-progress').style.width = (writers.length>0 ? subCount/writers.length*100 : 0) + '%';
  document.getElementById('sf-start-guessing-btn').disabled = subCount < writers.length;
}

async function submitHostSFAnswer() {
  const val = document.getElementById('sf-host-answer-input').value.trim();
  if (!val) { alert('Escribe tu respuesta'); return; }
  const room = await getRoomData(state.roomCode);
  room.gameState.sf.submissions[state.playerName] = val;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  soundClick();
  renderSFWritingHost(room);
}

async function startSFGuessing() {
  const room = await getRoomData(state.roomCode);
  room.gameState.sf.phase = 'guessing';
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  showSFGuessingHost(room);
}

function showSFGuessingHost(room) {
  document.getElementById('sf-source-section').style.display = 'none';
  document.getElementById('sf-writing-section').style.display = 'none';
  document.getElementById('sf-guessing-host-section').style.display = 'block';
  document.getElementById('sf-result-section').style.display = 'none';
  renderSFGuessingHost(room);
}

function renderSFGuessingHost(room) {
  const sf = room.gameState.sf;
  const guesser = room.players.find(p => p.id === sf.guesserId);
  document.getElementById('sf-host-guessing-question').textContent = sf.question;

  const amGuesser = state.playerName === sf.guesserId;
  document.getElementById('sf-host-is-guesser-area').style.display = amGuesser ? 'block' : 'none';
  document.getElementById('sf-host-watching-area').style.display = amGuesser ? 'none' : 'block';
  if (amGuesser) {
    if (!sf.failedAt && sf.revealOrder.length < room.players.length - 1) {
      renderSFGuesserOptions(room, 'sf-host-guesser-options');
    }
  } else {
    document.getElementById('sf-host-guessing-name').textContent = guesser ? guesser.name : sf.guesserId;
  }
  renderSFRevealLog(room, 'sf-host-reveal-log');

  if (sf.failedAt || (sf.revealOrder.length === room.players.length - 1)) {
    finishSFRoundCompute(room);
  }
}

function renderSFRevealLog(room, containerId) {
  const sf = room.gameState.sf;
  const html = sf.revealOrder.map(id => {
    const p = room.players.find(pp => pp.id === id);
    const ans = sf.submissions[id];
    const judgment = sf.judgments[id];
    const isReal = normPhotoVal(ans) === normPhotoVal(sf.realAnswer);
    const icon = judgment === 'correct' ? '✅' : '❌';
    return `<div class="player-item"><span>${icon} <b>${p ? p.name : id}</b>: "${ans}" ${isReal ? '(era la verdad)' : '(mentira)'}</span></div>`;
  }).join('');
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = html || '<div class="text-sm text-center">Aún no ha revelado a nadie</div>';
}

let sfRoundFinishedComputed = false;
async function finishSFRoundCompute(room) {
  if (sfRoundFinishedComputed) return;
  sfRoundFinishedComputed = true;
  const sf = room.gameState.sf;
  const writers = room.players.filter(p => p.id !== sf.guesserId);
  const revealedIds = new Set(sf.revealOrder);
  const unrevealed = writers.filter(p => !revealedIds.has(p.id)).map(p => p.id);
  const failedAt = sf.failedAt;
  const safeGroup = failedAt ? [...unrevealed, failedAt] : unrevealed;
  const n = safeGroup.length;

  room.gameState.scores = room.gameState.scores || {};
  const correctCount = Object.values(sf.judgments).filter(j => j === 'correct').length;
  if (correctCount > 0) {
    room.gameState.scores[sf.guesserId] = (room.gameState.scores[sf.guesserId] || 0) + correctCount;
  }
  safeGroup.forEach(id => {
    room.gameState.scores[id] = (room.gameState.scores[id] || 0) + n;
  });
  if (failedAt) {
    room.gameState.scores[failedAt] = (room.gameState.scores[failedAt] || 0) + 2;
  }

  sf.phase = 'result';
  sf.pointsSummary = { correctCount, safeGroup, n, failedAt, guesserId: sf.guesserId };
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  showSFResultHost(room);
}

function showSFResultHost(room) {
  document.getElementById('sf-source-section').style.display = 'none';
  document.getElementById('sf-writing-section').style.display = 'none';
  document.getElementById('sf-guessing-host-section').style.display = 'none';
  document.getElementById('sf-result-section').style.display = 'block';
  renderSFResultSummary(room, 'sf-result-summary');
}

function renderSFResultSummary(room, containerId) {
  const sf = room.gameState.sf;
  const ps = sf.pointsSummary || {};
  const guesser = room.players.find(p => p.id === sf.guesserId);
  const fooler = ps.failedAt ? room.players.find(p => p.id === ps.failedAt) : null;

  let html = `<div class="text-center mb1"><b>Respuesta real:</b> ${sf.realAnswer}</div>`;
  html += `<div class="text-sm mb1">🎯 ${guesser ? guesser.name : sf.guesserId} acertó ${ps.correctCount || 0} antes de ${ps.failedAt ? 'fallar' : 'terminar la ronda'} → +${ps.correctCount || 0} pts</div>`;
  if (fooler) {
    html += `<div class="text-sm mb1">🐟 ${fooler.name} engañó al adivinador → +${ps.n + 2} pts (${ps.n} base + 2 extra)</div>`;
  }
  (ps.safeGroup || []).filter(id => id !== ps.failedAt).forEach(id => {
    const p = room.players.find(pp => pp.id === id);
    html += `<div class="text-sm mb1">🙂 ${p ? p.name : id} no fue descubierto → +${ps.n} pts</div>`;
  });
  document.getElementById(containerId).innerHTML = html;
}

function renderSFScores(room, tblId) {
  if (!tblId) return;
  const scores = room.gameState.scores || {};
  const sorted = room.players.map(p => ({ name: p.name, score: scores[p.id] || 0 })).sort((a,b) => b.score - a.score);
  const tbl = document.getElementById(tblId);
  if (tbl) tbl.innerHTML = '<tr><th>Jugador</th><th>Pts</th></tr>' +
    sorted.map((p,i) => `<tr><td class="${i===0?'rank-1':''}">${i===0?'🥇 ':''}${p.name}</td><td>${p.score}</td></tr>`).join('');
}

async function nextSFRound() {
  sfRoundFinishedComputed = false;
  const room = await getRoomData(state.roomCode);
  const queue = room.gameState.sfFileQueue;
  room.gameState.sf = null;
  if (queue && room.gameState.sfFileQueueIndex < queue.length - 1) {
    room.gameState.sfFileQueueIndex++;
    const next = queue[room.gameState.sfFileQueueIndex];
    await updateRoomData(state.roomCode, { gameState: room.gameState });
    await startSFRound(next.statement, next.answer);
  } else {
    await updateRoomData(state.roomCode, { gameState: room.gameState });
    showSFHost();
  }
}

// ---- Guest side ----
async function submitGuestSFAnswer() {
  const val = document.getElementById('sf-guest-answer-input').value.trim();
  if (!val) { alert('Escribe tu respuesta'); return; }
  const room = await getRoomData(state.roomCode);
  room.gameState.sf.submissions[state.playerName] = val;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  soundClick();
  document.getElementById('sf-guest-write-form').style.display = 'none';
  document.getElementById('sf-guest-write-sent').style.display = 'block';
}

let pendingSFRevealTarget = null;
let pendingSFRevealIsReal = false;

async function pickSFRevealTarget(targetId) {
  const room = await getRoomData(state.roomCode);
  const sf = room.gameState.sf;
  if (sf.revealOrder.includes(targetId) || sf.failedAt) return;
  const ans = sf.submissions[targetId];
  const isReal = normPhotoVal(ans) === normPhotoVal(sf.realAnswer);
  pendingSFRevealTarget = targetId;
  pendingSFRevealIsReal = isReal;
  renderSFGuesserOptions(room, state.isHost ? 'sf-host-guesser-options' : 'sf-guesser-options');
}

async function judgeSFReveal(judgmentIsTrue) {
  const room = await getRoomData(state.roomCode);
  const sf = room.gameState.sf;
  const targetId = pendingSFRevealTarget;
  const correct = judgmentIsTrue === pendingSFRevealIsReal;
  sf.revealOrder.push(targetId);
  sf.judgments[targetId] = correct ? 'correct' : 'wrong';
  if (!correct) { sf.failedAt = targetId; }
  pendingSFRevealTarget = null;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  correct ? soundCorrect() : soundWrong();
  const roundOver = sf.failedAt || sf.revealOrder.length === room.players.length - 1;
  if (state.isHost) {
    renderSFGuessingHost(room); // will handle round-over via finishSFRoundCompute internally
  } else if (roundOver) {
    document.getElementById('sf-guest-guesser-turn').style.display = 'none';
    document.getElementById('sf-guest-watching').style.display = 'block';
  } else {
    renderSFGuesserOptions(room, 'sf-guesser-options');
  }
}

function renderSFGuesserOptions(room, containerId) {
  containerId = containerId || 'sf-guesser-options';
  const sf = room.gameState.sf;
  const writers = room.players.filter(p => p.id !== sf.guesserId && !sf.revealOrder.includes(p.id));
  const container = document.getElementById(containerId);
  if (pendingSFRevealTarget) {
    const p = room.players.find(pp => pp.id === pendingSFRevealTarget);
    container.innerHTML = `
      <div class="sf-statement">"${sf.submissions[pendingSFRevealTarget]}"</div>
      <div class="text-sm text-center mb1">¿Crees que ${p ? p.name : pendingSFRevealTarget} dijo la VERDAD o una MENTIRA?</div>
      <div class="vote-btns">
        <button class="vote-btn vote-real" onclick="judgeSFReveal(true)">✅ Es la verdad</button>
        <button class="vote-btn vote-fish" onclick="judgeSFReveal(false)">🐟 Es mentira</button>
      </div>`;
  } else {
    container.innerHTML = writers.map(p =>
      `<div class="hmp-vote-option" onclick="pickSFRevealTarget('${p.id}')">${p.name}</div>`
    ).join('') || '<div class="text-sm text-center">Ya revelaste a todos</div>';
  }
}

function updateSFUI(room) {
  const sf = room.gameState.sf;
  if (state.isHost) {
    if (!sf) { showSFHost(); return; }
    if (sf.phase === 'writing') {
      const writingVisible = document.getElementById('sf-writing-section').style.display !== 'none';
      if (!writingVisible) { showSFWritingHost(room); } else { renderSFWritingHost(room); }
    } else if (sf.phase === 'guessing') {
      const guessingVisible = document.getElementById('sf-guessing-host-section').style.display !== 'none';
      if (!guessingVisible) { showSFGuessingHost(room); } else { renderSFGuessingHost(room); }
    } else if (sf.phase === 'result') {
      const resultVisible = document.getElementById('sf-result-section').style.display !== 'none';
      if (!resultVisible) { showSFResultHost(room); }
    }
  } else {
    if (!sf) { showScreen('screen-sf-guest'); return; }
    const amGuesser = state.playerName === sf.guesserId;
    const sections = ['sf-guest-writing','sf-guest-guesser-turn','sf-guest-watching','sf-guest-result'];
    function showSec(id) { sections.forEach(s => document.getElementById(s).style.display = (s===id ? 'block' : 'none')); }

    if (sf.phase === 'writing') {
      if (amGuesser) {
        showSec('sf-guest-watching');
        document.getElementById('sf-guest-watching-name').textContent = 'Los demás';
        document.getElementById('sf-guest-watching-log').innerHTML = '<div class="text-sm text-center">Escribiendo sus respuestas...</div>';
      } else {
        const submitted = sf.submissions[state.playerName] !== undefined;
        showSec('sf-guest-writing');
        document.getElementById('sf-guest-question-writing').textContent = sf.question;
        const guesser = room.players.find(p => p.id === sf.guesserId);
        document.getElementById('sf-guest-guesser-name').textContent = guesser ? guesser.name : sf.guesserId;
        document.getElementById('sf-guest-real-answer').textContent = `Respuesta real: ${sf.realAnswer}`;
        document.getElementById('sf-guest-write-form').style.display = submitted ? 'none' : 'block';
        document.getElementById('sf-guest-write-sent').style.display = submitted ? 'block' : 'none';
      }
    } else if (sf.phase === 'guessing') {
      if (amGuesser) {
        showSec('sf-guest-guesser-turn');
        document.getElementById('sf-guest-question-guessing').textContent = sf.question;
        if (!(sf.failedAt || sf.revealOrder.length === room.players.length - 1)) {
          renderSFGuesserOptions(room);
        }
      } else {
        showSec('sf-guest-watching');
        const guesser = room.players.find(p => p.id === sf.guesserId);
        document.getElementById('sf-guest-watching-name').textContent = guesser ? guesser.name : sf.guesserId;
        renderSFRevealLog(room, 'sf-guest-watching-log');
      }
    } else if (sf.phase === 'result') {
      showSec('sf-guest-result');
      renderSFResultSummary(room, 'sf-guest-result-summary');
    }
    renderSFScores(room, 'sf-guest-scores');
  }
}


