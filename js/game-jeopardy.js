// ============================================================
// JEOPARDY
// ============================================================
let jeopardyData = null;
let currentJCell = null;
let jpConfig = { size: 3, rows: 4, dd: 1, theme: '' };
let manualCategories = [];

function goToJeopardySetup() {
  document.querySelectorAll('#jp-size-select .pill-option').forEach(el => {
    el.onclick = () => { document.querySelectorAll('#jp-size-select .pill-option').forEach(x=>x.classList.remove('selected')); el.classList.add('selected'); };
  });
  document.querySelectorAll('#jp-rows-select .pill-option').forEach(el => {
    el.onclick = () => { document.querySelectorAll('#jp-rows-select .pill-option').forEach(x=>x.classList.remove('selected')); el.classList.add('selected'); };
  });
  document.querySelectorAll('#jp-dd-select .pill-option').forEach(el => {
    el.onclick = () => { document.querySelectorAll('#jp-dd-select .pill-option').forEach(x=>x.classList.remove('selected')); el.classList.add('selected'); };
  });
  showScreen('screen-jeopardy-setup');
}

function readJPConfig() {
  jpConfig.size = parseInt(document.querySelector('#jp-size-select .selected').dataset.val);
  jpConfig.rows = parseInt(document.querySelector('#jp-rows-select .selected').dataset.val);
  jpConfig.dd = parseInt(document.querySelector('#jp-dd-select .selected').dataset.val);
  jpConfig.theme = document.getElementById('jp-theme').value.trim() || 'Día del Padre y familia';
}

async function goToJeopardyAIConfirm() {
  readJPConfig();
  jeopardyData = null;
  await startGame('jeopardy');
}

function goToJeopardyManualEdit() {
  readJPConfig();
  manualCategories = Array.from({length: jpConfig.size}, () => ({
    name: '', questions: Array.from({length: jpConfig.rows}, (_, i) => ({ points: (i+1)*100, question: '', answer: '' }))
  }));
  renderManualEditForm();
  showScreen('screen-jeopardy-manual');
}

let jpUploadedRows = [];
function goToJeopardyFileUpload() {
  readJPConfig();
  document.getElementById('jp-file-preview').style.display = 'none';
  document.getElementById('jp-file-use-btn').style.display = 'none';
  showScreen('screen-jeopardy-file');
}

function processJPRows(rows) {
  jpUploadedRows = rows.filter(r => r.categoria && r.pregunta);
  document.getElementById('jp-sheet-picker').style.display = 'none';
  const previewEl = document.getElementById('jp-file-preview');
  if (!jpUploadedRows.length) {
    previewEl.innerHTML = '<div class="text-sm">No se encontraron filas válidas. Verifica las columnas "categoria", "puntos", "pregunta", "respuesta".</div>';
    previewEl.style.display = 'block';
    document.getElementById('jp-file-use-btn').style.display = 'none';
    return;
  }
  const cats = [...new Set(jpUploadedRows.map(r => r.categoria))];
  previewEl.innerHTML = `<div class="text-sm mb1"><b>${cats.length}</b> categorías, <b>${jpUploadedRows.length}</b> preguntas</div>` +
    jpUploadedRows.map((r,i) => `<div class="upload-preview-row">${r.categoria} — $${r.puntos}: ${r.pregunta}</div>`).join('');
  previewEl.style.display = 'block';
  document.getElementById('jp-file-use-btn').style.display = 'block';
}

function pickJPSheet(sheetName) {
  const rows = window.__jpGetRowsForSheet(sheetName);
  processJPRows(rows);
}

function handleJPFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('jp-file-preview').style.display = 'none';
  document.getElementById('jp-file-use-btn').style.display = 'none';
  document.getElementById('jp-sheet-picker').style.display = 'none';
  parseUploadedFile(file, processJPRows, () => alert('No se pudo leer el archivo. Verifica el formato.'),
    (sheetNames, getRowsForSheet) => {
      window.__jpGetRowsForSheet = getRowsForSheet;
      renderSheetPicker('jp-sheet-picker', sheetNames, 'pickJPSheet');
    });
}

async function useUploadedJPBoard() {
  if (!jpUploadedRows.length) return;
  const catNames = [...new Set(jpUploadedRows.map(r => r.categoria))];
  jeopardyData = {
    used: {},
    categories: catNames.map(name => ({
      name,
      questions: jpUploadedRows.filter(r => r.categoria === name).map(r => ({
        points: parseInt(r.puntos) || 100,
        question: r.pregunta,
        answer: r.respuesta || ''
      })).sort((a,b) => a.points - b.points)
    }))
  };
  jpConfig.size = catNames.length;
  jpConfig.rows = Math.max(...jeopardyData.categories.map(c => c.questions.length));
  await assignDailyDoubles();
  await startGame('jeopardy', true);
}

function renderManualEditForm() {
  const container = document.getElementById('jp-manual-categories');
  container.innerHTML = manualCategories.map((cat, ci) => `
    <div class="cat-edit-card">
      <input type="text" placeholder="Nombre de categoría ${ci+1}" value="${cat.name}" oninput="manualCategories[${ci}].name = this.value">
      ${cat.questions.map((q, qi) => `
        <div class="q-edit-row">
          <div class="q-edit-label">$${q.points}</div>
          <div style="flex:1;">
            <input type="text" placeholder="Pregunta" value="${q.question}" oninput="manualCategories[${ci}].questions[${qi}].question = this.value">
            <input type="text" placeholder="Respuesta" value="${q.answer}" oninput="manualCategories[${ci}].questions[${qi}].answer = this.value" style="margin-bottom:0;">
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

async function finishManualJeopardy() {
  const hasEmpty = manualCategories.some(c => !c.name || c.questions.some(q => !q.question || !q.answer));
  if (hasEmpty) {
    if (!confirm('Algunas categorías o preguntas están incompletas. ¿Quieres que la IA complete lo que falta?')) return;
  }
  jeopardyData = { categories: manualCategories, used: {} };
  await assignDailyDoubles();
  await startGame('jeopardy', true);
}

async function assignDailyDoubles() {
  jeopardyData.dailyDoubles = {};
  const allCells = [];
  jeopardyData.categories.forEach((cat, ci) => cat.questions.forEach((q, qi) => { if (qi > 0) allCells.push(`${ci}-${qi}`); }));
  for (let i = 0; i < jpConfig.dd && allCells.length; i++) {
    const idx = Math.floor(Math.random() * allCells.length);
    jeopardyData.dailyDoubles[allCells.splice(idx,1)[0]] = true;
  }
}

async function startGame(game, skipScoreReset) {
  const room = await getRoomData(state.roomCode);
  const gameState = { scores: Object.fromEntries(room.players.map(p => [p.id, 0])) };
  if (game === 'jeopardy') gameState.jpConfig = jpConfig;
  await updateRoomData(state.roomCode, { game, gameState });
  if (game === 'jeopardy') showJeopardyHost();
  else if (game === 'soundfishy') showSFHost();
  else if (game === 'herd') showHerdHost();
}

async function showJeopardyHost() {
  showScreen('screen-jeopardy-host');
  document.getElementById('jeopardy-host-title').textContent = jpConfig.theme ? `Jeopardy — ${jpConfig.theme}` : 'Jeopardy — Tablero';
  document.getElementById('jeopardy-loading').style.display = 'block';
  document.getElementById('jeopardy-board').style.display = 'none';
  if (!jeopardyData || !jeopardyData.categories) { await generateJeopardyBoard(); }
  if (!jeopardyData.dailyDoubles) { await assignDailyDoubles(); }
  setupGridColumns();
  renderJeopardyBoard();
}

function showJeopardyGuest() { showScreen('screen-jeopardy-guest'); }

function setupGridColumns() {
  document.getElementById('j-grid').style.gridTemplateColumns = `repeat(${jpConfig.size}, 1fr)`;
}

async function generateJeopardyBoard() {
  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `Genera un tablero de Jeopardy con ${jpConfig.size} categorías y ${jpConfig.rows} preguntas cada una (valores de 100 hasta ${jpConfig.rows*100} de 100 en 100). El tema es: "${jpConfig.theme}". Responde SOLO con JSON válido sin explicaciones ni backticks, con este formato exacto: {"categories":[{"name":"NOMBRE CATEGORIA","questions":[{"points":100,"question":"pregunta en formato jeopardy (la respuesta es...?)","answer":"La respuesta"}]}]}`
        }]
      })
    });
    const data = await res.json();
    let text = data.content[0].text.replace(/```json|```/g,'').trim();
    jeopardyData = JSON.parse(text);
    jeopardyData.used = {};
  } catch(e) {
    jeopardyData = {
      used: {},
      categories: Array.from({length: jpConfig.size}, (_, ci) => ({
        name: `CATEGORÍA ${ci+1}`,
        questions: Array.from({length: jpConfig.rows}, (_, qi) => ({
          points: (qi+1)*100,
          question: `Pregunta de ejemplo ${qi+1} sobre ${jpConfig.theme}`,
          answer: `Respuesta de ejemplo ${qi+1}`
        }))
      }))
    };
  }
}

function renderJeopardyBoard() {
  document.getElementById('jeopardy-loading').style.display = 'none';
  document.getElementById('jeopardy-board').style.display = 'block';
  const grid = document.getElementById('j-grid');
  let html = '';
  jeopardyData.categories.forEach(cat => { html += `<div class="j-category">${cat.name}</div>`; });
  jeopardyData.categories.forEach((cat, ci) => {
    cat.questions.forEach((q, qi) => {
      const key = `${ci}-${qi}`;
      const used = jeopardyData.used[key];
      const isDD = jeopardyData.dailyDoubles && jeopardyData.dailyDoubles[key];
      html += used
        ? `<div class="j-cell used">—</div>`
        : `<div class="j-cell ${isDD?'dd':''}" onclick="openJQuestion(${ci},${qi})">$${q.points}</div>`;
    });
  });
  grid.innerHTML = html;
  renderJScores();
}

async function openJQuestion(ci, qi) {
  const key = `${ci}-${qi}`;
  const isDD = jeopardyData.dailyDoubles && jeopardyData.dailyDoubles[key];
  currentJCell = { ci, qi, isDD, wager: null };

  if (isDD) {
    const room = await getRoomData(state.roomCode);
    document.getElementById('j-dd-player-label').innerHTML = `¿Quién eligió esta casilla?<br><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">` +
      room.players.map(p => `<button class="btn btn-sm btn-amber" onclick="selectDDPlayer('${p.id}')">${p.name}</button>`).join('') + `</div>`;
    document.getElementById('j-dd-wager-area').style.display = 'block';
    return;
  }
  openQuestionDisplay(ci, qi);
}

let ddPlayerId = null;
function selectDDPlayer(playerId) {
  ddPlayerId = playerId;
  document.getElementById('j-dd-player-label').innerHTML = `Jugador: <b>${playerId}</b>`;
}

function confirmDDWager() {
  if (!ddPlayerId) { alert('Selecciona quién eligió la casilla'); return; }
  const wager = parseInt(document.getElementById('j-dd-wager-input').value) || 0;
  currentJCell.wager = wager;
  currentJCell.wagerPlayer = ddPlayerId;
  document.getElementById('j-dd-wager-area').style.display = 'none';
  document.getElementById('j-dd-wager-input').value = '';
  openQuestionDisplay(currentJCell.ci, currentJCell.qi);
}

async function openQuestionDisplay(ci, qi) {
  const q = jeopardyData.categories[ci].questions[qi];
  document.getElementById('j-q-label').textContent = `${jeopardyData.categories[ci].name} — $${q.points}` + (currentJCell.isDD ? ` (Daily Double, apuesta: ${currentJCell.wager})` : '');
  document.getElementById('j-q-text').textContent = q.question;
  document.getElementById('j-q-answer').textContent = q.answer;
  document.getElementById('j-q-answer').style.display = 'none';
  document.getElementById('j-question-area').style.display = 'block';
  document.getElementById('j-buzzer-winner').style.display = 'none';
  document.getElementById('j-buzzer-status').style.display = 'block';

  // Reset buzzer state in Firebase
  await updateRoomData(state.roomCode, { gameState: { ...(await getRoomData(state.roomCode)).gameState, buzzer: { active: true, winner: null, ts: Date.now() } } });

  renderPointButtons(ci, qi);
}

async function renderPointButtons(ci, qi) {
  const q = jeopardyData.categories[ci].questions[qi];
  const points = currentJCell.isDD ? currentJCell.wager : q.points;
  const room = await getRoomData(state.roomCode);
  const ptBtns = document.getElementById('j-point-btns');
  const minusBtns = document.getElementById('j-minus-point-btns');
  ptBtns.innerHTML = room.players.map(p =>
    `<button class="btn btn-sm btn-amber" onclick="awardJPoints('${p.id}',${points})">${p.name} +${points}</button>`
  ).join('');
  minusBtns.innerHTML = room.players.map(p =>
    `<button class="btn btn-sm" onclick="awardJPoints('${p.id}',-${points})">${p.name} -${points}</button>`
  ).join('');
}

function showJAnswer() { document.getElementById('j-q-answer').style.display = 'block'; }

async function resetBuzzer() {
  const room = await getRoomData(state.roomCode);
  room.gameState.buzzer = { active: true, winner: null, ts: Date.now() };
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  document.getElementById('j-buzzer-winner').style.display = 'none';
  document.getElementById('j-buzzer-status').style.display = 'block';
}

async function closeJQuestion() {
  if (currentJCell) {
    const key = `${currentJCell.ci}-${currentJCell.qi}`;
    jeopardyData.used[key] = true;
  }
  document.getElementById('j-question-area').style.display = 'none';
  const room = await getRoomData(state.roomCode);
  room.gameState.buzzer = { active: false, winner: null };
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  renderJeopardyBoard();
}

async function awardJPoints(playerId, points) {
  const room = await getRoomData(state.roomCode);
  if (!room.gameState.scores) room.gameState.scores = {};
  room.gameState.scores[playerId] = (room.gameState.scores[playerId] || 0) + points;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  soundCorrect();
  renderJScores();
}

async function renderJScores() {
  const room = await getRoomData(state.roomCode);
  if (!room) return;
  const scores = room.gameState.scores || {};
  const sorted = room.players.map(p => ({ name: p.name, score: scores[p.id] || 0 })).sort((a,b) => b.score - a.score);
  const tbl = document.getElementById('j-scores-table');
  tbl.innerHTML = '<tr><th>Jugador</th><th>Puntos</th></tr>' +
    sorted.map((p,i) => `<tr><td class="${i===0?'rank-1':''}">${i===0?'🥇 ':''}${p.name}</td><td>$${p.score}</td></tr>`).join('');
}

async function finishJeopardyRound() {
  const room = await getRoomData(state.roomCode);
  const scores = room.gameState.scores || {};
  await addRoundScoresToTotal(scores);
  await addToHistory('jeopardy', jpConfig.theme || 'Día del Padre', scores);
  soundWin();
  launchConfetti();
  await backToLobby();
}

let lastBuzzerWinner = null;
function updateJeopardyUI(room) {
  const buzzer = room.gameState.buzzer || {};
  if (!state.isHost) {
    const scores = room.gameState.scores || {};
    const myScore = scores[state.playerName] || 0;
    document.getElementById('my-j-score').textContent = myScore;
    const sorted = room.players.map(p => ({ name: p.name, score: scores[p.id] || 0 })).sort((a,b) => b.score - a.score);
    const tbl = document.getElementById('guest-j-scores');
    if (tbl) tbl.innerHTML = '<tr><th>Jugador</th><th>Puntos</th></tr>' +
      sorted.map((p,i) => `<tr><td class="${i===0?'rank-1':''}">${i===0?'🥇 ':''}${p.name}</td><td>$${p.score}</td></tr>`).join('');

    // Buzzer UI for guest
    const idleArea = document.getElementById('jg-idle-area');
    const buzzerArea = document.getElementById('jg-buzzer-area');
    const buzzerBtn = document.getElementById('jg-buzzer-btn');
    const resultEl = document.getElementById('jg-buzzer-result');
    if (buzzer.active) {
      idleArea.style.display = 'none';
      buzzerArea.style.display = 'block';
      if (buzzer.winner) {
        buzzerBtn.disabled = true;
        resultEl.textContent = buzzer.winner === state.playerName ? '🎉 ¡Presionaste primero!' : `${buzzer.winner} presionó primero`;
      } else {
        buzzerBtn.disabled = myBuzzPressed;
        resultEl.textContent = myBuzzPressed ? 'Buzzer presionado, esperando...' : '';
      }
    } else {
      idleArea.style.display = 'block';
      buzzerArea.style.display = 'none';
      myBuzzPressed = false;
    }
  } else {
    renderJScores();
    // Host sees who won the buzzer
    if (buzzer.winner && buzzer.winner !== lastBuzzerWinner) {
      lastBuzzerWinner = buzzer.winner;
      document.getElementById('j-buzzer-status').style.display = 'none';
      document.getElementById('j-buzzer-winner').style.display = 'block';
      document.getElementById('j-buzzer-winner').textContent = `🔔 ¡${buzzer.winner} presionó primero!`;
      soundBuzzer();
    }
    if (!buzzer.winner) { lastBuzzerWinner = null; }
  }
}

async function pressBuzzer() {
  if (myBuzzPressed) return;
  myBuzzPressed = true;
  soundClick();
  const room = await getRoomData(state.roomCode);
  if (!room.gameState.buzzer || room.gameState.buzzer.winner) return; // someone already won
  room.gameState.buzzer.winner = state.playerName;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
}

// ============================================================
// FINAL JEOPARDY
// ============================================================
let fjMyWagerSubmitted = false;
let fjMyAnswerSubmitted = false;
let fjRevealIndex = 0;
let fjRevealOrder = [];

function goToFinalJeopardySetup() {
  showScreen('screen-fj-setup');
}

function fjTab(t) {
  document.querySelectorAll('#screen-fj-setup .tab').forEach((el,i) => el.classList.toggle('active', (i===0&&t==='ai')||(i===1&&t==='manual')));
  document.getElementById('fj-ai-tab').style.display = t==='ai'?'block':'none';
  document.getElementById('fj-manual-tab').style.display = t==='manual'?'block':'none';
}

async function generateFJQuestion() {
  const category = document.getElementById('fj-category').value.trim() || jpConfig.theme || 'Familia';
  const btn = document.getElementById('fj-gen-btn');
  btn.textContent = 'Generando...'; btn.disabled = true;
  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        max_tokens: 300,
        messages: [{ role: 'user', content: `Genera UNA pregunta desafiante de "Final Jeopardy" sobre el tema: "${category}". Debe requerir pensar, no ser trivial. Responde SOLO con JSON: {"question":"la pregunta aquí","answer":"la respuesta correcta"}` }]
      })
    });
    const data = await res.json();
    let text = data.content[0].text.replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(text);
    await startFinalJeopardy(category, parsed.question, parsed.answer);
  } catch(e) {
    await startFinalJeopardy(category, `Pregunta final sobre ${category}`, 'Respuesta de ejemplo');
  }
  btn.textContent = '✨ Generar pregunta final'; btn.disabled = false;
}

async function useManualFJQuestion() {
  const category = document.getElementById('fj-category').value.trim() || 'Final';
  const question = document.getElementById('fj-manual-question').value.trim();
  const answer = document.getElementById('fj-manual-answer').value.trim();
  if (!question || !answer) { alert('Completa la pregunta y la respuesta'); return; }
  await startFinalJeopardy(category, question, answer);
}

async function startFinalJeopardy(category, question, answer) {
  const room = await getRoomData(state.roomCode);
  room.gameState.finalJeopardy = {
    phase: 'wager', // wager -> question -> reveal -> done
    category, question, answer,
    wagers: {}, answers: {},
    maxWager: room.gameState.scores || {}
  };
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  showFJHostWager(room);
}

function showFJHostWager(room) {
  showScreen('screen-fj-host-wager');
  document.getElementById('fj-host-category').textContent = room.gameState.finalJeopardy.category;
  renderFJWagerStatus(room);
}

function renderFJWagerStatus(room) {
  const fj = room.gameState.finalJeopardy;
  if (!fj) return;
  const wagers = fj.wagers || {};
  const listEl = document.getElementById('fj-wager-status-list');
  if (listEl) {
    listEl.innerHTML = room.players.map(p => {
      const ready = wagers[p.id] !== undefined;
      return `<div class="fj-wager-card"><span><span class="fj-status-dot ${ready?'ready':''}"></span> ${p.name}</span><span class="text-sm">${ready ? '✅ Apostó' : 'Pensando...'}</span></div>`;
    }).join('');
  }
  const btn = document.getElementById('fj-reveal-q-btn');
  if (btn) {
    const allReady = room.players.every(p => wagers[p.id] !== undefined);
    btn.textContent = allReady ? 'Todos listos — Mostrar la pregunta' : `Esperando apuestas (${Object.keys(wagers).length}/${room.players.length})`;
  }
}

async function revealFJQuestion() {
  const room = await getRoomData(state.roomCode);
  room.gameState.finalJeopardy.phase = 'question';
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  showFJHostQuestion(room);
}

function showFJHostQuestion(room) {
  showScreen('screen-fj-host-question');
  document.getElementById('fj-host-q-text').textContent = room.gameState.finalJeopardy.question;
  updateFJAnswerProgress(room);
}

function updateFJAnswerProgress(room) {
  const fj = room.gameState.finalJeopardy;
  const answers = fj.answers || {};
  const count = Object.keys(answers).length;
  const total = room.players.length;
  document.getElementById('fj-answer-count').textContent = count;
  document.getElementById('fj-answer-total').textContent = total;
  document.getElementById('fj-answer-progress').style.width = (total>0?count/total*100:0)+'%';
}

async function startFJReveal() {
  const room = await getRoomData(state.roomCode);
  room.gameState.finalJeopardy.phase = 'reveal';
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  fjRevealIndex = 0;
  const wagers = room.gameState.finalJeopardy.wagers || {};
  // Reveal in ascending order of wager (lowest first, builds suspense)
  fjRevealOrder = room.players.map(p => p.id).sort((a,b) => (wagers[a]||0) - (wagers[b]||0));
  showScreen('screen-fj-host-reveal');
  document.getElementById('fj-correct-answer-box').textContent = '✅ Respuesta correcta: ' + room.gameState.finalJeopardy.answer;
  document.getElementById('fj-finish-btn').style.display = 'none';
  renderFJRevealCards(room, true);
}

function renderFJRevealCards(room, onlyControls) {
  const fj = room.gameState.finalJeopardy;
  const wagers = fj.wagers || {};
  const answers = fj.answers || {};
  const container = document.getElementById('fj-reveal-cards');
  let html = '';
  fjRevealOrder.forEach((id, idx) => {
    const player = room.players.find(p => p.id === id);
    const visible = idx <= fjRevealIndex;
    if (!visible) return;
    const wager = wagers[id] || 0;
    const ans = answers[id] || '(sin respuesta)';
    const judged = fj.judged && fj.judged[id] !== undefined;
    html += `<div class="fj-reveal-card">
      <div class="fj-reveal-name">${player ? player.name : id}</div>
      <div class="fj-reveal-wager">Apostó: ${wager} pts</div>
      <div class="fj-reveal-answer">"${ans}"</div>
      ${judged ? `<div class="text-sm">${fj.judged[id] ? '✅ Correcto +' + wager : '❌ Incorrecto -' + wager}</div>` :
        `<div class="btn-row"><button class="btn btn-sm btn-success" onclick="judgeFJAnswer('${id}', true, ${wager})">✅ Correcto</button><button class="btn btn-sm" onclick="judgeFJAnswer('${id}', false, ${wager})">❌ Incorrecto</button></div>`}
    </div>`;
  });
  container.innerHTML = html;

  // Show "next" button if there are more to reveal and current one is judged
  const currentId = fjRevealOrder[fjRevealIndex];
  const currentJudged = fj.judged && fj.judged[currentId] !== undefined;
  if (currentJudged && fjRevealIndex < fjRevealOrder.length - 1) {
    container.innerHTML += `<button class="btn btn-primary" onclick="nextFJReveal()">Revelar siguiente jugador →</button>`;
  } else if (currentJudged && fjRevealIndex === fjRevealOrder.length - 1) {
    document.getElementById('fj-finish-btn').style.display = 'block';
  }
}

async function judgeFJAnswer(playerId, correct, wager) {
  const room = await getRoomData(state.roomCode);
  const fj = room.gameState.finalJeopardy;
  if (!fj.judged) fj.judged = {};
  fj.judged[playerId] = correct;
  room.gameState.scores = room.gameState.scores || {};
  room.gameState.scores[playerId] = (room.gameState.scores[playerId] || 0) + (correct ? wager : -wager);
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  correct ? soundCorrect() : soundWrong();
  renderFJRevealCards(room);
}

function nextFJReveal() {
  fjRevealIndex++;
  getRoomData(state.roomCode).then(room => renderFJRevealCards(room));
}

async function finishFinalJeopardy() {
  const room = await getRoomData(state.roomCode);
  const scores = room.gameState.scores || {};
  await addRoundScoresToTotal(scores);
  await addToHistory('jeopardy', (jpConfig.theme || 'Final Jeopardy') + ' (con Final)', scores);
  soundWin();
  launchConfetti();
  await backToLobby();
}

// ---- Guest side: wager + answer submission ----
async function submitFJWager() {
  const val = parseInt(document.getElementById('fjg-wager-input').value);
  if (isNaN(val) || val < 0) { alert('Ingresa una apuesta válida'); return; }
  fjMyWagerSubmitted = true;
  const room = await getRoomData(state.roomCode);
  if (!room.gameState.finalJeopardy.wagers) room.gameState.finalJeopardy.wagers = {};
  room.gameState.finalJeopardy.wagers[state.playerName] = val;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  document.getElementById('fjg-wager-phase').style.display = 'none';
  document.getElementById('fjg-wager-locked').style.display = 'block';
}

async function submitFJAnswer() {
  const val = document.getElementById('fjg-answer-input').value.trim();
  if (!val) { alert('Escribe tu respuesta'); return; }
  fjMyAnswerSubmitted = true;
  const room = await getRoomData(state.roomCode);
  if (!room.gameState.finalJeopardy.answers) room.gameState.finalJeopardy.answers = {};
  room.gameState.finalJeopardy.answers[state.playerName] = val;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  document.getElementById('fjg-question-phase').style.display = 'none';
  document.getElementById('fjg-answer-locked').style.display = 'block';
}

function updateFJGuestUI(room) {
  const fj = room.gameState.finalJeopardy;
  if (!fj) return;
  const currentScreen = document.querySelector('.screen.active').id;
  if (currentScreen !== 'screen-fj-guest') {
    fjMyWagerSubmitted = false; fjMyAnswerSubmitted = false;
    showScreen('screen-fj-guest');
  }
  const scores = room.gameState.scores || {};
  const myScore = scores[state.playerName] || 0;

  if (fj.phase === 'wager') {
    document.getElementById('fjg-question-phase').style.display = 'none';
    document.getElementById('fjg-answer-locked').style.display = 'none';
    document.getElementById('fjg-results-phase').style.display = 'none';
    if (fjMyWagerSubmitted || (fj.wagers && fj.wagers[state.playerName] !== undefined)) {
      document.getElementById('fjg-wager-phase').style.display = 'none';
      document.getElementById('fjg-wager-locked').style.display = 'block';
    } else {
      document.getElementById('fjg-wager-phase').style.display = 'block';
      document.getElementById('fjg-wager-locked').style.display = 'none';
      document.getElementById('fjg-category').textContent = fj.category;
      document.getElementById('fjg-max-wager').textContent = myScore;
    }
  } else if (fj.phase === 'question') {
    document.getElementById('fjg-wager-phase').style.display = 'none';
    document.getElementById('fjg-wager-locked').style.display = 'none';
    document.getElementById('fjg-results-phase').style.display = 'none';
    if (fjMyAnswerSubmitted || (fj.answers && fj.answers[state.playerName] !== undefined)) {
      document.getElementById('fjg-question-phase').style.display = 'none';
      document.getElementById('fjg-answer-locked').style.display = 'block';
    } else {
      document.getElementById('fjg-question-phase').style.display = 'block';
      document.getElementById('fjg-answer-locked').style.display = 'none';
      document.getElementById('fjg-question-text').textContent = fj.question;
    }
  } else if (fj.phase === 'reveal' || fj.phase === 'done') {
    document.getElementById('fjg-wager-phase').style.display = 'none';
    document.getElementById('fjg-wager-locked').style.display = 'none';
    document.getElementById('fjg-question-phase').style.display = 'none';
    document.getElementById('fjg-answer-locked').style.display = 'none';
    document.getElementById('fjg-results-phase').style.display = 'block';
    const sorted = room.players.map(p => ({ name: p.name, score: scores[p.id] || 0 })).sort((a,b) => b.score - a.score);
    document.getElementById('fjg-final-scores').innerHTML = '<tr><th>Jugador</th><th>Puntos</th></tr>' +
      sorted.map((p,i) => `<tr><td class="${i===0?'rank-1':''}">${i===0?'🥇 ':''}${p.name}</td><td>$${p.score}</td></tr>`).join('');
  }
}


