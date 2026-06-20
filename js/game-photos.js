// ============================================================
// GALERÍA DE RECUERDOS (fotos con preguntas)
// ============================================================
const PHOTO_MAX_COUNT = 20;
const PHOTO_MAX_WIDTH = 800;
const PHOTO_JPEG_QUALITY = 0.7;
let photoQueue = []; // [{ dataUrl, lugar, anio, evento, fileName }]
let photoFactsMap = {}; // { normalized_filename: { lugar, anio, evento } }

function goToPhotoSetup() {
  photoQueue = [];
  photoFactsMap = {};
  startGame('photos');
  showScreen('screen-photo-setup');
  document.getElementById('photo-thumb-grid').innerHTML = '';
  document.getElementById('photo-question-forms').innerHTML = '';
  document.getElementById('photo-counter-badge').style.display = 'none';
  document.getElementById('photo-start-btn').style.display = 'none';
  document.getElementById('photo-facts-status').style.display = 'none';
  renderPhotoQueueSection();
}

function normalizeFileName(name) {
  return (name || '').toString().toLowerCase().trim();
}

function processPhotoFactsRows(rows) {
  photoFactsMap = {};
  let count = 0;
  rows.forEach(r => {
    const key = normalizeFileName(r.nombre_archivo);
    if (!key) return;
    photoFactsMap[key] = { lugar: r.lugar || '', anio: (r.anio || '').toString(), evento: r.evento || '' };
    count++;
  });
  document.getElementById('photo-facts-sheet-picker').style.display = 'none';
  const statusEl = document.getElementById('photo-facts-status');
  statusEl.style.display = 'block';
  statusEl.textContent = count
    ? `✅ Ficha cargada con ${count} fotos. Súbelas a continuación y se completarán automáticamente por nombre de archivo.`
    : '⚠️ No se encontraron filas válidas. Verifica la columna "nombre_archivo".';
  // Re-apply to any already-uploaded photos waiting in the queue
  photoQueue.forEach(p => {
    const fact = photoFactsMap[normalizeFileName(p.fileName)];
    if (fact && !p.lugar && !p.anio && !p.evento) {
      p.lugar = fact.lugar; p.anio = fact.anio; p.evento = fact.evento;
    }
  });
  renderPhotoSetupUI();
}

function pickPhotoFactsSheet(sheetName) {
  const rows = window.__photoFactsGetRowsForSheet(sheetName);
  processPhotoFactsRows(rows);
}

function handlePhotoFactsFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  parseUploadedFile(file, processPhotoFactsRows, () => alert('No se pudo leer el archivo. Verifica el formato.'),
    (sheetNames, getRowsForSheet) => {
      window.__photoFactsGetRowsForSheet = getRowsForSheet;
      renderSheetPicker('photo-facts-sheet-picker', sheetNames, 'pickPhotoFactsSheet');
    });
}

function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.onload = () => {
      let { width, height } = img;
      if (width > PHOTO_MAX_WIDTH) {
        height = Math.round(height * (PHOTO_MAX_WIDTH / width));
        width = PHOTO_MAX_WIDTH;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', PHOTO_JPEG_QUALITY));
    };
    img.onerror = () => reject(new Error('No se pudo procesar la imagen'));
    reader.readAsDataURL(file);
  });
}

async function handlePhotoFilesSelected(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  const remaining = PHOTO_MAX_COUNT - photoQueue.length;
  if (remaining <= 0) {
    alert(`Ya tienes el máximo de ${PHOTO_MAX_COUNT} fotos.`);
    event.target.value = '';
    return;
  }
  const toProcess = files.slice(0, remaining);
  if (files.length > remaining) {
    alert(`Solo se agregarán ${remaining} fotos para no pasar del máximo de ${PHOTO_MAX_COUNT}.`);
  }

  document.getElementById('photo-compress-status').style.display = 'block';
  for (const file of toProcess) {
    try {
      const dataUrl = await compressImageFile(file);
      const fact = photoFactsMap[normalizeFileName(file.name)] || {};
      photoQueue.push({
        dataUrl,
        fileName: file.name,
        lugar: fact.lugar || '',
        anio: fact.anio || '',
        evento: fact.evento || ''
      });
    } catch (e) {
      console.error('Error compressing photo:', e);
    }
  }
  document.getElementById('photo-compress-status').style.display = 'none';
  event.target.value = '';
  renderPhotoSetupUI();
}

function removePhotoFromQueue(idx) {
  photoQueue.splice(idx, 1);
  renderPhotoSetupUI();
}

function updatePhotoFact(idx, field, value) {
  photoQueue[idx][field] = value;
}

function renderPhotoSetupUI() {
  const badge = document.getElementById('photo-counter-badge');
  badge.style.display = photoQueue.length ? 'block' : 'none';
  badge.textContent = `${photoQueue.length}/${PHOTO_MAX_COUNT} fotos`;

  document.getElementById('photo-thumb-grid').innerHTML = photoQueue.map((p, i) => `
    <div class="photo-thumb-wrap">
      <img src="${p.dataUrl}" alt="Foto ${i+1}">
      <button class="photo-thumb-remove" onclick="removePhotoFromQueue(${i})">✕</button>
    </div>
  `).join('');

  document.getElementById('photo-question-forms').innerHTML = photoQueue.map((p, i) => `
    <div class="photo-fact-card">
      <div class="section-label">FICHA DE LA FOTO ${i+1}${p.fileName ? ' — '+p.fileName : ''}</div>
      <div class="photo-fact-row"><label>📍 Lugar</label><input type="text" placeholder="Ej: Playa del Carmen" value="${p.lugar}" oninput="updatePhotoFact(${i}, 'lugar', this.value)"></div>
      <div class="photo-fact-row"><label>📅 Año</label><input type="text" placeholder="Ej: 2015" inputmode="numeric" value="${p.anio}" oninput="updatePhotoFact(${i}, 'anio', this.value)"></div>
      <div class="photo-fact-row"><label>🎉 Evento</label><input type="text" placeholder="Ej: Cumpleaños de papá" value="${p.evento}" oninput="updatePhotoFact(${i}, 'evento', this.value)"></div>
    </div>
  `).join('');

  const btn = document.getElementById('photo-start-btn');
  btn.style.display = photoQueue.length ? 'block' : 'none';
}

// ---- Cola compartida: cualquier jugador puede proponer una foto para la galería ----
function goToProposePhoto() {
  document.getElementById('propose-photo-preview').style.display = 'none';
  document.getElementById('propose-photo-file-input').value = '';
  showScreen('screen-propose-photo');
}

let proposedPhotoDataUrl = null;
let proposedPhotoFileName = '';
async function handleProposePhotoSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    proposedPhotoDataUrl = await compressImageFile(file);
    proposedPhotoFileName = file.name;
    document.getElementById('propose-photo-img').src = proposedPhotoDataUrl;
    document.getElementById('propose-photo-preview').style.display = 'block';
  } catch (e) {
    alert('No se pudo procesar la foto. Intenta con otra.');
  }
}

async function submitProposedPhoto() {
  if (!proposedPhotoDataUrl) { alert('Selecciona una foto primero'); return; }
  const lugar = document.getElementById('propose-photo-lugar').value.trim();
  const anio = document.getElementById('propose-photo-anio').value.trim();
  const evento = document.getElementById('propose-photo-evento').value.trim();
  const room = await getRoomData(state.roomCode);
  const queue = room.photoSubmissionQueue || {};
  const id = 'photo' + Date.now();
  queue[id] = { dataUrl: proposedPhotoDataUrl, fileName: proposedPhotoFileName, lugar, anio, evento, author: state.playerName };
  await updateRoomData(state.roomCode, { photoSubmissionQueue: queue });
  proposedPhotoDataUrl = null;
  alert('¡Foto enviada! El host la incluirá en la Galería de Recuerdos.');
  enterLobby();
}

function renderPhotoQueueCountFromRoom(room) {
  const listEl = document.getElementById('photo-queue-list');
  if (!listEl) return;
  const queue = room.photoSubmissionQueue || {};
  const entries = Object.entries(queue);
  document.getElementById('photo-queue-count').textContent = entries.length;
  if (!entries.length) { listEl.innerHTML = '<div class="text-sm text-center" style="padding:8px 0">Nadie ha propuesto fotos todavía</div>'; return; }
  listEl.innerHTML = entries.map(([id, item]) => `
    <div class="queue-item">
      <span>📸 de ${item.author}${item.lugar || item.anio || item.evento ? ' — '+[item.lugar,item.anio,item.evento].filter(Boolean).join(', ') : ''}</span>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-sm btn-primary" onclick="useQueuedPhoto('${id}')">Usar</button>
        <button class="btn btn-sm" onclick="dismissQueuedPhoto('${id}')">✕</button>
      </div>
    </div>
  `).join('');
}

function renderPhotoQueueSection() {
  getRoomData(state.roomCode).then(room => { if (room) renderPhotoQueueCountFromRoom(room); });
}

async function useQueuedPhoto(id) {
  const room = await getRoomData(state.roomCode);
  const item = (room.photoSubmissionQueue || {})[id];
  if (!item) return;
  if (photoQueue.length >= PHOTO_MAX_COUNT) { alert(`Ya tienes el máximo de ${PHOTO_MAX_COUNT} fotos.`); return; }
  photoQueue.push({ dataUrl: item.dataUrl, fileName: item.fileName, lugar: item.lugar || '', anio: item.anio || '', evento: item.evento || '' });
  delete room.photoSubmissionQueue[id];
  await updateRoomData(state.roomCode, { photoSubmissionQueue: room.photoSubmissionQueue });
  renderPhotoSetupUI();
  renderPhotoQueueSection();
}

async function dismissQueuedPhoto(id) {
  const room = await getRoomData(state.roomCode);
  if (!room.photoSubmissionQueue) return;
  delete room.photoSubmissionQueue[id];
  await updateRoomData(state.roomCode, { photoSubmissionQueue: room.photoSubmissionQueue });
  renderPhotoQueueSection();
}

async function startPhotoGallery() {
  if (!photoQueue.length) { alert('Sube al menos una foto'); return; }
  const missingAll = photoQueue.some(p => !p.lugar.trim() && !p.anio.trim() && !p.evento.trim());
  if (missingAll && !confirm('Algunas fotos no tienen ningún dato de ficha. ¿Continuar igual?')) return;

  const room = await getRoomData(state.roomCode);
  room.gameState.photoQueue = photoQueue;
  room.gameState.photoIndex = 0;
  room.gameState.photoAnswers = {};
  room.gameState.photoJudged = {};
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  showPhotoHost(room);
}

function showPhotoHost(room) {
  showScreen('screen-photo-host');
  renderPhotoHostCurrent(room);
}

function renderPhotoHostCurrent(room) {
  const queue = room.gameState.photoQueue || [];
  const idx = room.gameState.photoIndex || 0;
  const current = queue[idx];
  if (!current) return;
  document.getElementById('photo-host-counter').textContent = `Foto ${idx+1} de ${queue.length}`;
  document.getElementById('photo-host-img').src = current.dataUrl;
  const facts = [];
  if (current.lugar) facts.push(`📍 ${current.lugar}`);
  if (current.anio) facts.push(`📅 ${current.anio}`);
  if (current.evento) facts.push(`🎉 ${current.evento}`);
  document.getElementById('photo-host-correct-answers').textContent = facts.length ? `Respuesta correcta: ${facts.join(' · ')}` : 'Sin ficha registrada para esta foto';
  renderPhotoAnswersList(room);
}

function normPhotoVal(v) {
  return (v || '').toString().toLowerCase().trim()
    .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u');
}

function renderPhotoAnswersList(room) {
  const queue = room.gameState.photoQueue || [];
  const idx = room.gameState.photoIndex || 0;
  const current = queue[idx] || {};
  const answers = room.gameState.photoAnswers || {};
  const judged = room.gameState.photoJudged || {}; // { playerId: { lugar: true/false, anio: true/false, evento: true/false } }
  const guessers = room.players;
  document.getElementById('photo-answer-count').textContent = Object.keys(answers).length;
  document.getElementById('photo-answer-total').textContent = guessers.length;

  document.getElementById('photo-host-answers-list').innerHTML = guessers.map(p => {
    const ans = answers[p.id];
    if (!ans) {
      return `<div class="photo-answer-card"><div class="photo-answer-card-name">${p.name}</div><div class="text-sm">Pensando...</div></div>`;
    }
    const pj = judged[p.id] || {};
    const fields = [
      { key: 'lugar', icon: '📍', label: 'Lugar', val: ans.lugar },
      { key: 'anio', icon: '📅', label: 'Año', val: ans.anio },
      { key: 'evento', icon: '🎉', label: 'Evento', val: ans.evento }
    ].filter(f => current[f.key]); // only show fields the host actually set a fact for

    return `<div class="photo-answer-card">
      <div class="photo-answer-card-name">${p.name}</div>
      ${fields.map(f => {
        const checked = pj[f.key] === true;
        const suggestMatch = normPhotoVal(f.val) === normPhotoVal(current[f.key]) && current[f.key];
        return `<div class="photo-answer-field-row">
          <span>${f.icon} "${f.val || '—'}" ${suggestMatch ? '💡' : ''}</span>
          <span class="check-btn ${checked?'checked':''}" onclick="togglePhotoFieldCorrect('${p.id}','${f.key}')">${checked ? '✓ Correcto' : 'Marcar ✓'}</span>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
  renderPhotoScores(room, 'photo-host-scores');
}

async function togglePhotoFieldCorrect(playerId, field) {
  const room = await getRoomData(state.roomCode);
  if (!room.gameState.photoJudged) room.gameState.photoJudged = {};
  if (!room.gameState.photoJudged[playerId]) room.gameState.photoJudged[playerId] = {};
  const current = !!room.gameState.photoJudged[playerId][field];
  room.gameState.photoJudged[playerId][field] = !current;

  room.gameState.scores = room.gameState.scores || {};
  room.gameState.scores[playerId] = (room.gameState.scores[playerId] || 0) + (!current ? 1 : -1);

  await updateRoomData(state.roomCode, { gameState: room.gameState });
  soundCorrect();
  renderPhotoAnswersList(room);
}

function renderPhotoScores(room, tblId) {
  const scores = room.gameState.scores || {};
  const sorted = room.players.map(p => ({ name: p.name, score: scores[p.id] || 0 })).sort((a,b) => b.score - a.score);
  const tbl = document.getElementById(tblId);
  if (tbl) tbl.innerHTML = '<tr><th>Jugador</th><th>Pts</th></tr>' +
    sorted.map((p,i) => `<tr><td class="${i===0?'rank-1':''}">${i===0?'🥇 ':''}${p.name}</td><td>${p.score}</td></tr>`).join('');
}

async function nextPhotoRound() {
  const room = await getRoomData(state.roomCode);
  const queue = room.gameState.photoQueue || [];
  if (room.gameState.photoIndex < queue.length - 1) {
    room.gameState.photoIndex++;
    room.gameState.photoAnswers = {};
    room.gameState.photoJudged = {};
    await updateRoomData(state.roomCode, { gameState: room.gameState });
    renderPhotoHostCurrent(room);
  } else {
    alert('Esa era la última foto. Puedes terminar la Galería de Recuerdos.');
  }
}

let myPhotoAnswered = -1; // index of photo I already answered, -1 if none
function showPhotoGuest() { showScreen('screen-photo-guest'); }

function updatePhotoGuestUI(room) {
  const queue = room.gameState.photoQueue || [];
  const idx = room.gameState.photoIndex || 0;
  const current = queue[idx];
  if (!current) return;
  const currentScreen = document.querySelector('.screen.active').id;
  if (currentScreen !== 'screen-photo-guest') showScreen('screen-photo-guest');

  document.getElementById('photo-guest-counter').textContent = `Foto ${idx+1} de ${queue.length}`;
  document.getElementById('photo-guest-img').src = current.dataUrl;

  const answers = room.gameState.photoAnswers || {};
  const alreadyAnswered = answers[state.playerName] !== undefined;
  if (alreadyAnswered || myPhotoAnswered === idx) {
    document.getElementById('photo-guest-answer-form').style.display = 'none';
    document.getElementById('photo-guest-answered').style.display = 'block';
  } else {
    document.getElementById('photo-guest-answer-form').style.display = 'block';
    document.getElementById('photo-guest-answered').style.display = 'none';
    document.getElementById('photo-guess-lugar').value = '';
    document.getElementById('photo-guess-anio').value = '';
    document.getElementById('photo-guess-evento').value = '';
  }
  renderPhotoScores(room, 'photo-guest-scores');
}

async function submitPhotoAnswer() {
  const lugar = document.getElementById('photo-guess-lugar').value.trim();
  const anio = document.getElementById('photo-guess-anio').value.trim();
  const evento = document.getElementById('photo-guess-evento').value.trim();
  if (!lugar && !anio && !evento) { alert('Escribe al menos un dato'); return; }
  const room = await getRoomData(state.roomCode);
  const idx = room.gameState.photoIndex || 0;
  myPhotoAnswered = idx;
  if (!room.gameState.photoAnswers) room.gameState.photoAnswers = {};
  room.gameState.photoAnswers[state.playerName] = { lugar, anio, evento };
  await updateRoomData(state.roomCode, { gameState: room.gameState });
  soundClick();
  document.getElementById('photo-guest-answer-form').style.display = 'none';
  document.getElementById('photo-guest-answered').style.display = 'block';
}

