// ============================================================
// CARGA DE ARCHIVOS (CSV / XLSX / JSON) — utilidades genéricas
// ============================================================
// Parses a file and returns either:
//  - onSuccess(rows) directly, if single sheet (or CSV/JSON, which have no sheet concept)
//  - onMultiSheet(sheetNames, getRowsForSheet) if the workbook has 2+ sheets, so caller can let user choose
function parseUploadedFile(file, onSuccess, onError, onMultiSheet) {
  const reader = new FileReader();
  const ext = file.name.split('.').pop().toLowerCase();

  function normalizeRows(rows) {
    return rows.map(r => {
      const norm = {};
      Object.entries(r).forEach(([k,v]) => {
        const key = k.toString().toLowerCase().trim()
          .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u');
        norm[key] = typeof v === 'string' ? v.trim() : v;
      });
      return norm;
    });
  }

  reader.onload = (e) => {
    try {
      if (ext === 'json') {
        const data = JSON.parse(e.target.result);
        let rows = Array.isArray(data) ? data : (data.rows || data.preguntas || []);
        rows = rows.map(r => typeof r === 'string' ? { pregunta: r } : r);
        onSuccess(normalizeRows(rows));
        return;
      }
      // csv or xlsx via SheetJS
      const wb = ext === 'csv'
        ? XLSX.read(e.target.result, { type: 'string' })
        : XLSX.read(e.target.result, { type: 'array' });

      if (wb.SheetNames.length > 1 && onMultiSheet) {
        onMultiSheet(wb.SheetNames, (sheetName) => {
          const sheet = wb.Sheets[sheetName];
          return normalizeRows(XLSX.utils.sheet_to_json(sheet, { defval: '' }));
        });
        return;
      }
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      onSuccess(normalizeRows(rows));
    } catch (err) {
      console.error('Error parsing file:', err);
      onError(err);
    }
  };
  reader.onerror = () => onError(new Error('No se pudo leer el archivo'));
  if (ext === 'csv') reader.readAsText(file);
  else if (ext === 'json') reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}

// Renders a sheet-picker UI inside the given container, calling onPick(sheetName) when chosen
function renderSheetPicker(containerId, sheetNames, onPickFnName) {
  const el = document.getElementById(containerId);
  el.style.display = 'block';
  window.__sheetPickerNames = sheetNames;
  el.innerHTML = `<div class="text-sm mb1">Este archivo tiene varias hojas. ¿Cuál corresponde a este juego?</div>` +
    `<div class="pill-select">${sheetNames.map((name, i) => `<div class="pill-option" onclick="${onPickFnName}(window.__sheetPickerNames[${i}])">${name}</div>`).join('')}</div>`;
}

function genericFileTab(prefix, tabName, total) {
  // Toggles tabs for any *-setup screen with ai/manual/file tabs
  document.querySelectorAll(`#screen-${prefix} .tab`).forEach((el, i) => {
    const names = ['ai','manual','file'].slice(0, total);
    el.classList.toggle('active', names[i] === tabName);
  });
}

