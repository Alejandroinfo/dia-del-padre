// ============================================================
// EL HERMANO MÁS PROBABLE (HMP)
// ============================================================
let myHMPRole = null; // 'hijo' | 'guess'
let hmpUploadedQueue = [];
let hmpMyVoteSubmitted = false;
let hmpMyGuessSubmitted = false;

function goToHMPRoleSelect() {
  myHMPRole = null;
  document.getElementById('hmp-role-card-hijo').classList.remove('selected');
  document.getElementById('hmp-role-card-guess').classList.remove('selected');
  startGame('hmp');
  showScreen('screen-hmp-role');
}

async function selectHMPRole(role) {
  myHMPRole = role;
  document.getElementById('hmp-role-card-hijo').classList.toggle('selected', role==='hijo');
  document.getElementById('hmp-role-card-guess').classList.toggle('selected', role==='guess');
  const room = await getRoomData(state.roomCode);
  if (!room.gameState.hmpRoles) room.gameState.hmpRoles = {};
  room.gameState.hmpRoles[state.playerName] = role;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  soundClick();
  renderHMPRoleList(room, true);
}

function renderHMPRoleList(room, refetchNeeded) {
  if (refetchNeeded) { getRoomData(state.roomCode).then(r => renderHMPRoleListInner(r)); return; }
  renderHMPRoleListInner(room);
}

function renderHMPRoleListInner(room) {
  const roles = room.gameState.hmpRoles || {};
  document.getElementById('hmp-role-count').textContent = Object.keys(roles).length;
  const icons = { hijo: '🙋', guess: '🤔' };
  document.getElementById('hmp-role-list').innerHTML = room.players.map(p => {
    const r = roles[p.id];
    return `<div class="player-item"><div class="player-avatar ${p.color}">${p.name.charAt(0).toUpperCase()}</div><span>${p.name}</span><span class="text-sm" style="margin-left:auto;">${r ? icons[r] + ' ' + (r==='hijo'?'Hijo/a':'Adivina') : 'Eligiendo...'}</span></div>`;
  }).join('');
  if (state.isHost) {
    const hijoCount = Object.values(roles).filter(r => r === 'hijo').length;
    document.getElementById('hmp-host-start-area').style.display = hijoCount >= 2 ? 'block' : 'none';
    if (hijoCount < 2) {
      document.getElementById('hmp-host-start-area').insertAdjacentHTML('afterend', '');
    }
  } else {
    document.getElementById('hmp-guest-wait-roles').style.display = 'block';
  }
}

function goToHMPSetup() {
  showScreen('screen-hmp-setup');
}

function hmpSetupTab(t) { genericFileTab('hmp-setup', t, 3); 
  document.getElementById('hmp-setup-ai-tab').style.display = t==='ai' ? 'block':'none';
  document.getElementById('hmp-setup-manual-tab').style.display = t==='manual' ? 'block':'none';
  document.getElementById('hmp-setup-file-tab').style.display = t==='file' ? 'block':'none';
}

async function generateHMPQuestion() {
  const btn = document.getElementById('hmp-gen-btn');
  btn.textContent = 'Generando...'; btn.disabled = true;
  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        max_tokens: 150,
        messages: [{ role: 'user', content: 'Genera UNA pregunta divertida tipo "¿Quién de los hermanos es más probable que...?" para usar entre hermanos en una reunión familiar (ej: quejarse de no dormir bien, tardar más en arreglarse, llegar tarde, comer más rápido, perder las llaves). Responde SOLO con JSON: {"question":"¿Quién es más probable que...?"}' }]
      })
    });
    const data = await res.json();
    let text = data.content[0].text.replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(text);
    await sendHMPQuestion(parsed.question);
  } catch(e) {
    const qs = ["¿Quién es más probable que se queje de no dormir bien?", "¿Quién es más probable que llegue tarde a todo?", "¿Quién es más probable que coma más rápido?", "¿Quién es más probable que pierda las llaves?", "¿Quién es más probable que se ría primero en una broma?"];
    await sendHMPQuestion(qs[Math.floor(Math.random()*qs.length)]);
  }
  btn.textContent = '✨ Generar pregunta'; btn.disabled = false;
}

async function sendManualHMP() {
  const q = document.getElementById('hmp-manual-q').value.trim();
  if (!q) { alert('Escribe una pregunta'); return; }
  await sendHMPQuestion(q);
}

function processHMPRows(rows) {
  hmpUploadedQueue = rows.map(r => r.pregunta).filter(Boolean);
  document.getElementById('hmp-sheet-picker').style.display = 'none';
  const previewEl = document.getElementById('hmp-file-preview');
  if (!hmpUploadedQueue.length) {
    previewEl.innerHTML = '<div class="text-sm">No se encontraron preguntas válidas. Verifica que el archivo tenga una columna "pregunta".</div>';
    previewEl.style.display = 'block';
    document.getElementById('hmp-file-use-btn').style.display = 'none';
    return;
  }
  previewEl.innerHTML = hmpUploadedQueue.map((q,i) => `<div class="upload-preview-row">${i+1}. ${q}</div>`).join('');
  previewEl.style.display = 'block';
  document.getElementById('hmp-file-use-btn').style.display = 'block';
  document.getElementById('hmp-file-use-btn').textContent = `Usar estas ${hmpUploadedQueue.length} preguntas`;
}

function pickHMPSheet(sheetName) {
  const rows = window.__hmpGetRowsForSheet(sheetName);
  processHMPRows(rows);
}

function handleHMPFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('hmp-file-preview').style.display = 'none';
  document.getElementById('hmp-file-use-btn').style.display = 'none';
  document.getElementById('hmp-sheet-picker').style.display = 'none';
  parseUploadedFile(file, processHMPRows, () => {
    alert('No se pudo leer el archivo. Verifica el formato.');
  }, (sheetNames, getRowsForSheet) => {
    window.__hmpGetRowsForSheet = getRowsForSheet;
    renderSheetPicker('hmp-sheet-picker', sheetNames, 'pickHMPSheet');
  });
}

async function useUploadedHMPQueue() {
  if (!hmpUploadedQueue.length) return;
  const room = await getRoomData(state.roomCode);
  room.gameState.hmpFileQueue = hmpUploadedQueue;
  room.gameState.hmpFileQueueIndex = 0;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  await sendHMPQuestion(hmpUploadedQueue[0]);
}

async function sendHMPQuestion(question) {
  hmpMyVoteSubmitted = false; hmpMyGuessSubmitted = false;
  const room = await getRoomData(state.roomCode);
  const roles = room.gameState.hmpRoles || {};
  const hijos = room.players.filter(p => roles[p.id] === 'hijo');
  room.gameState.hmp = {
    phase: 'voting', // voting -> guessing -> result
    question,
    hijoIds: hijos.map(p => p.id),
    votes: {}, guesses: {}
  };
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  showHMPHostVoting(room);
}

function showHMPHostVoting(room) {
  showScreen('screen-hmp-host-voting');
  document.getElementById('hmp-host-question').textContent = room.gameState.hmp.question;
  renderHostOwnHMPVote(room);
  renderHMPHostVotingList(room);
}

function renderHostOwnHMPVote(room) {
  const hmp = room.gameState.hmp;
  const amHijo = hmp.hijoIds.includes(state.playerName);
  const area = document.getElementById('hmp-host-own-vote-area');
  if (!amHijo) { area.style.display = 'none'; return; }
  area.style.display = 'block';
  const alreadyVoted = hmp.votes && hmp.votes[state.playerName] !== undefined;
  const optionsEl = document.getElementById('hmp-host-own-vote-options');
  if (alreadyVoted) {
    optionsEl.innerHTML = `<div class="text-sm text-center p1">✅ Ya votaste</div>`;
  } else {
    renderHMPVoteOptions('hmp-host-own-vote-options', room, 'castHMPVote');
  }
}

function renderHMPHostVotingList(room) {
  const hmp = room.gameState.hmp;
  if (!hmp) return;
  const votes = hmp.votes || {};
  const hijos = room.players.filter(p => hmp.hijoIds.includes(p.id));
  document.getElementById('hmp-votes-count').textContent = Object.keys(votes).length;
  document.getElementById('hmp-votes-total').textContent = hijos.length;
  document.getElementById('hmp-host-voting-list').innerHTML = hijos.map(p => {
    const voted = votes[p.id] !== undefined;
    return `<div class="player-item"><div class="player-avatar ${p.color}">${p.name.charAt(0).toUpperCase()}</div><span>${p.name}</span><span class="text-sm" style="margin-left:auto;">${voted ? '✅ Votó' : '🤔 Pensando...'}</span></div>`;
  }).join('');
}

async function revealHMPVotes() {
  const room = await getRoomData(state.roomCode);
  room.gameState.hmp.phase = 'guessing';
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  showHMPHostGuessing(room);
}

function showHMPHostGuessing(room) {
  showScreen('screen-hmp-host-guessing');
  document.getElementById('hmp-host-guess-question').textContent = room.gameState.hmp.question;
  renderHostOwnHMPGuess(room);
  renderHMPGuessProgress(room);
}

function renderHostOwnHMPGuess(room) {
  const hmp = room.gameState.hmp;
  const amHijo = hmp.hijoIds.includes(state.playerName);
  const area = document.getElementById('hmp-host-own-guess-area');
  if (amHijo) { area.style.display = 'none'; return; } // hijos don't guess
  area.style.display = 'block';
  const alreadyGuessed = hmp.guesses && hmp.guesses[state.playerName] !== undefined;
  const optionsEl = document.getElementById('hmp-host-own-guess-options');
  if (alreadyGuessed) {
    optionsEl.innerHTML = `<div class="text-sm text-center p1">✅ Ya enviaste tu adivinanza</div>`;
  } else {
    renderHMPVoteOptions('hmp-host-own-guess-options', room, 'castHMPGuess');
  }
}

function renderHMPGuessProgress(room) {
  const hmp = room.gameState.hmp;
  const guessers = room.players.filter(p => !hmp.hijoIds.includes(p.id));
  const guesses = hmp.guesses || {};
  const count = Object.keys(guesses).length;
  document.getElementById('hmp-guess-count').textContent = count;
  document.getElementById('hmp-guess-total').textContent = guessers.length;
  document.getElementById('hmp-guess-progress').style.width = (guessers.length>0?count/guessers.length*100:0)+'%';
}

function computeHMPTally(room) {
  const hmp = room.gameState.hmp;
  const votes = hmp.votes || {};
  const tally = {};
  Object.values(votes).forEach(v => { tally[v] = (tally[v]||0) + 1; });
  const maxVotes = Math.max(...Object.values(tally), 0);
  const winners = Object.entries(tally).filter(([,v]) => v === maxVotes).map(([id]) => id);
  // Tie among all hijos (each got exactly 1 vote, more than 1 hijo) => no winner
  const isFullTie = hmp.hijoIds.length > 1 && maxVotes <= 1 && winners.length === hmp.hijoIds.length;
  return { tally, maxVotes, winners: isFullTie ? [] : winners, isFullTie };
}

async function revealHMPFinal() {
  const room = await getRoomData(state.roomCode);
  const hmp = room.gameState.hmp;
  const { winners } = computeHMPTally(room);
  const guesses = hmp.guesses || {};
  const guessers = room.players.filter(p => !hmp.hijoIds.includes(p.id));
  room.gameState.scores = room.gameState.scores || {};
  let allCorrect = guessers.length > 0;
  guessers.forEach(p => {
    const g = guesses[p.id];
    const correct = winners.length > 0 && g && winners.includes(g);
    if (correct) { room.gameState.scores[p.id] = (room.gameState.scores[p.id]||0) + 1; }
    else { allCorrect = false; }
  });
  hmp.phase = 'result';
  hmp.perfect = allCorrect;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  soundWin();
  if (allCorrect) launchConfetti();
  showHMPHostResult(room);
}

function showHMPHostResult(room) {
  showScreen('screen-hmp-host-result');
  renderHMPResultCommon(room, 'hmp-result-question', 'hmp-result-tally', 'hmp-result-guesses', 'hmp-perfect-banner', 'hmp-host-scores');
}

function renderHMPResultCommon(room, qId, tallyId, guessesId, bannerId, scoresId) {
  const hmp = room.gameState.hmp;
  if (!hmp) return;
  document.getElementById(qId).textContent = hmp.question;
  const { tally, maxVotes, winners } = computeHMPTally(room);
  const hijos = room.players.filter(p => hmp.hijoIds.includes(p.id));

  document.getElementById(tallyId).innerHTML = hijos.map(p => {
    const v = tally[p.id] || 0;
    const pct = maxVotes > 0 ? (v/Math.max(...Object.values(tally),1)*100) : 0;
    const isWinner = winners.includes(p.id);
    return `<div class="hmp-tally-bar-wrap">
      <div class="hmp-tally-label"><span>${isWinner?'🏆 ':''}${p.name}</span><span>${v} voto${v===1?'':'s'}</span></div>
      <div class="hmp-tally-bar-bg"><div class="hmp-tally-bar-fill ${isWinner?'winner':''}" style="width:${pct}%"></div></div>
    </div>`;
  }).join('') + (winners.length === 0 ? '<div class="text-sm text-center mt1">🤷 Empate total entre hermanos — ronda sin ganador claro</div>' : '');

  const guessers = room.players.filter(p => !hmp.hijoIds.includes(p.id));
  const guesses = hmp.guesses || {};
  document.getElementById(guessesId).innerHTML = guessers.map(p => {
    const g = guesses[p.id];
    const gName = g ? (room.players.find(pp=>pp.id===g)?.name || g) : '(sin respuesta)';
    const correct = winners.length > 0 && g && winners.includes(g);
    return `<div class="hmp-guess-row ${g ? (correct?'correct':'wrong') : ''}"><span>${p.name} dijo: <b>${gName}</b></span><span>${correct?'✅ +1':(g?'❌':'—')}</span></div>`;
  }).join('') || '<div class="text-sm text-center">Nadie tuvo que adivinar esta vez</div>';

  document.getElementById(bannerId).style.display = hmp.perfect ? 'block' : 'none';

  const scores = room.gameState.scores || {};
  const sorted = room.players.map(p => ({ name: p.name, score: scores[p.id] || 0 })).sort((a,b) => b.score - a.score);
  const tbl = document.getElementById(scoresId);
  if (tbl) tbl.innerHTML = '<tr><th>Jugador</th><th>Pts</th></tr>' +
    sorted.map((p,i) => `<tr><td class="${i===0?'rank-1':''}">${i===0?'🥇 ':''}${p.name}</td><td>${p.score}</td></tr>`).join('');
}

async function nextHMPRound() {
  const room = await getRoomData(state.roomCode);
  // If there's an uploaded file queue, auto-advance to next question in it
  if (room.gameState.hmpFileQueue && room.gameState.hmpFileQueueIndex < room.gameState.hmpFileQueue.length - 1) {
    room.gameState.hmpFileQueueIndex++;
    const nextQ = room.gameState.hmpFileQueue[room.gameState.hmpFileQueueIndex];
    await updateRoomData(state.roomCode, { gameState: room.gameState });
    await sendHMPQuestion(nextQ);
  } else {
    room.gameState.hmp = null;
    await updateRoomData(state.roomCode, { gameState: room.gameState });
    showScreen('screen-hmp-setup');
  }
}

// ---- Guest side ----
async function castHMPVote(targetId) {
  if (hmpMyVoteSubmitted) return;
  hmpMyVoteSubmitted = true;
  soundClick();
  const room = await getRoomData(state.roomCode);
  if (!room.gameState.hmp.votes) room.gameState.hmp.votes = {};
  room.gameState.hmp.votes[state.playerName] = targetId;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  if (state.isHost) {
    renderHostOwnHMPVote(room);
    renderHMPHostVotingList(room);
  } else {
    showScreen('screen-hmp-guest-voted');
  }
}

async function castHMPGuess(targetId) {
  if (hmpMyGuessSubmitted) return;
  hmpMyGuessSubmitted = true;
  soundClick();
  const room = await getRoomData(state.roomCode);
  if (!room.gameState.hmp.guesses) room.gameState.hmp.guesses = {};
  room.gameState.hmp.guesses[state.playerName] = targetId;
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  if (state.isHost) {
    renderHostOwnHMPGuess(room);
    renderHMPGuessProgress(room);
  } else {
    showScreen('screen-hmp-guest-waiting-result');
  }
}

function renderHMPVoteOptions(containerId, room, onSelectFn) {
  const hmp = room.gameState.hmp;
  const hijos = room.players.filter(p => hmp.hijoIds.includes(p.id));
  document.getElementById(containerId).innerHTML = hijos.map(p =>
    `<div class="hmp-vote-option" onclick="${onSelectFn}('${p.id}')">${p.name}</div>`
  ).join('');
}

function updateHMPGuestUI(room) {
  const hmp = room.gameState.hmp;
  const roles = room.gameState.hmpRoles || {};
  const myRole = roles[state.playerName];
  const currentScreen = document.querySelector('.screen.active').id;

  // Role selection phase (no hmp question active yet, host hasn't moved past role screen)
  if (!hmp && currentScreen !== 'screen-hmp-setup') {
    if (currentScreen !== 'screen-hmp-role') { showScreen('screen-hmp-role'); }
    renderHMPRoleListInner(room);
    return;
  }
  if (!hmp) return; // host still on setup picking question source

  const amHijo = hmp.hijoIds.includes(state.playerName);

  if (hmp.phase === 'voting') {
    if (amHijo) {
      const alreadyVoted = hmp.votes && hmp.votes[state.playerName] !== undefined;
      if (alreadyVoted) { hmpMyVoteSubmitted = true; if (currentScreen !== 'screen-hmp-guest-voted') showScreen('screen-hmp-guest-voted'); }
      else {
        hmpMyVoteSubmitted = false;
        if (currentScreen !== 'screen-hmp-guest-voting') {
          showScreen('screen-hmp-guest-voting');
          document.getElementById('hmp-guest-vote-question').textContent = hmp.question;
          renderHMPVoteOptions('hmp-guest-vote-options', room, 'castHMPVote');
        }
      }
    } else {
      if (currentScreen !== 'screen-hmp-guest-waiting-result') showScreen('screen-hmp-guest-waiting-result');
    }
  } else if (hmp.phase === 'guessing') {
    if (amHijo) {
      if (currentScreen !== 'screen-hmp-guest-waiting-result') showScreen('screen-hmp-guest-waiting-result');
    } else {
      const alreadyGuessed = hmp.guesses && hmp.guesses[state.playerName] !== undefined;
      if (alreadyGuessed) { hmpMyGuessSubmitted = true; if (currentScreen !== 'screen-hmp-guest-waiting-result') showScreen('screen-hmp-guest-waiting-result'); }
      else {
        hmpMyGuessSubmitted = false;
        if (currentScreen !== 'screen-hmp-guest-guessing') {
          showScreen('screen-hmp-guest-guessing');
          document.getElementById('hmp-guest-guess-question').textContent = hmp.question;
          renderHMPVoteOptions('hmp-guest-guess-options', room, 'castHMPGuess');
        }
      }
    }
  } else if (hmp.phase === 'result') {
    if (currentScreen !== 'screen-hmp-guest-result') {
      showScreen('screen-hmp-guest-result');
    }
    renderHMPResultCommon(room, 'hmp-guest-result-question', 'hmp-guest-result-tally', 'hmp-guest-result-guesses', 'hmp-guest-perfect-banner', 'hmp-guest-scores');
  }
}

