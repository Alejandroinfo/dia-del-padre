// ============================================================
// MODAL DE AYUDA: "¿Cómo se juega?" — contenido por juego
// ============================================================
const HELP_CONTENT = {
  jeopardy: {
    title: '📺 Jeopardy — Cómo se juega',
    html: `
      <div class="help-section-label">El objetivo</div>
      <p style="font-size:14px;">Responder correctamente el mayor número de preguntas para acumular puntos. El host controla el tablero; los demás responden en voz alta.</p>

      <div class="help-section-label">Cómo se juega</div>
      <ul class="help-step-list">
        <li class="help-step"><span class="help-step-num">1</span><span>El host elige una casilla del tablero (categoría + valor en puntos).</span></li>
        <li class="help-step"><span class="help-step-num">2</span><span>Se muestra la pregunta a todos. Quien sepa la respuesta, ¡presiona el buzzer 🔔 en su celular!</span></li>
        <li class="help-step"><span class="help-step-num">3</span><span>El primero en presionar puede responder en voz alta. El host marca si fue correcto.</span></li>
        <li class="help-step"><span class="help-step-num">4</span><span>Las casillas con ⭐ son <b>Daily Double</b>: el jugador que la elige apuesta sus propios puntos antes de ver la pregunta.</span></li>
        <li class="help-step"><span class="help-step-num">5</span><span>Al terminar el tablero, el host puede iniciar el <b>Final Jeopardy</b>: una pregunta donde todos apuestan en secreto.</span></li>
      </ul>

      <div class="help-section-label">Cómo se calculan los puntos</div>
      <table class="help-points-table">
        <tr><td>Responder correctamente una pregunta normal</td><td>+ valor de la casilla</td></tr>
        <tr><td>Responder incorrectamente (a criterio del host)</td><td>− valor de la casilla</td></tr>
        <tr><td>Daily Double correcto</td><td>+ lo apostado</td></tr>
        <tr><td>Daily Double incorrecto</td><td>− lo apostado</td></tr>
        <tr><td>Final Jeopardy correcto</td><td>+ lo apostado</td></tr>
        <tr><td>Final Jeopardy incorrecto</td><td>− lo apostado</td></tr>
      </table>
      <div class="help-tip">💡 El host decide manualmente si una respuesta es correcta — no hay revisión automática de texto.</div>
    `
  },
  soundfishy: {
    title: '🐟 Sound Fishy — Cómo se juega',
    html: `
      <div class="help-section-label">El objetivo</div>
      <p style="font-size:14px;">Cada ronda, una persona distinta es el <b>adivinador</b>. Los demás inventan respuestas falsas creíbles (o dicen la verdad, si les toca) y el adivinador trata de descubrir cuál es la real.</p>

      <div class="help-section-label">Cómo se juega</div>
      <ul class="help-step-list">
        <li class="help-step"><span class="help-step-num">1</span><span>La app elige automáticamente quién es el adivinador de esta ronda (va rotando).</span></li>
        <li class="help-step"><span class="help-step-num">2</span><span>Todos <b>excepto</b> el adivinador ven la pregunta y la respuesta real, y escriben su propia versión (una mentira creíble, o la verdad si les tocó).</span></li>
        <li class="help-step"><span class="help-step-num">3</span><span>El adivinador solo ve la pregunta. Cuando todos enviaron su respuesta, empieza a elegir, uno por uno, a quién revelar.</span></li>
        <li class="help-step"><span class="help-step-num">4</span><span>Por cada persona que elige, dice si cree que su respuesta es la VERDAD o una MENTIRA.</span></li>
        <li class="help-step"><span class="help-step-num">5</span><span>Si acierta, sigue con el siguiente. ¡En cuanto se equivoca una vez, la ronda termina ahí!</span></li>
      </ul>

      <div class="help-section-label">Cómo se calculan los puntos</div>
      <table class="help-points-table">
        <tr><td>Adivinador: por cada mentira identificada correctamente</td><td>+1 c/u</td></tr>
        <tr><td>Jugadores que quedaron sin revelar al terminar la ronda</td><td>+N c/u</td></tr>
        <tr><td>El jugador que causó el fallo del adivinador (su mentira coló)</td><td>+N +2 extra</td></tr>
        <tr><td>Jugadores revelados y descartados antes del fallo</td><td>0 pts</td></tr>
      </table>
      <div class="help-tip">💡 "N" es la cantidad de jugadores que quedaron sin ser descubiertos en el momento del fallo (incluyendo al que engañó). Por ejemplo, si quedan 3 sin revelar, cada uno gana 3 puntos — y el que engañó gana 3+2=5.</div>
    `
  },
  herd: {
    title: '🐄 Herd Mentality — Cómo se juega',
    html: `
      <div class="help-section-label">El objetivo</div>
      <p style="font-size:14px;">Escribir la misma respuesta que la mayoría, sin verse entre ustedes. ¡Piensen como el rebaño!</p>

      <div class="help-section-label">Cómo se juega</div>
      <ul class="help-step-list">
        <li class="help-step"><span class="help-step-num">1</span><span>El host (o cualquier jugador, proponiendo de antemano) elige una pregunta con muchas respuestas posibles, pero alguna obvia.</span></li>
        <li class="help-step"><span class="help-step-num">2</span><span>Todos, incluido el host, escriben su respuesta en secreto desde su celular.</span></li>
        <li class="help-step"><span class="help-step-num">3</span><span>Cuando todos respondieron, el host revela los resultados.</span></li>
        <li class="help-step"><span class="help-step-num">4</span><span>Gana un punto quien haya coincidido con la respuesta más repetida (sin importar mayúsculas o espacios extra).</span></li>
      </ul>

      <div class="help-section-label">Cómo se calculan los puntos</div>
      <table class="help-points-table">
        <tr><td>Tu respuesta coincide con la más repetida (y hay al menos 2 iguales)</td><td>+1</td></tr>
        <tr><td>Tu respuesta es única o la minoría</td><td>0 pts</td></tr>
        <tr><td>Todos respondieron distinto (nadie coincide)</td><td>Nadie gana — "la vaca rosada busca dueño" 🐄</td></tr>
      </table>
      <div class="help-tip">💡 Si dos respuestas distintas empatan en la cantidad de votos, ambos grupos ganan el punto.</div>
    `
  },
  hmp: {
    title: '👨‍👩‍👧‍👦 El Hermano Más Probable — Cómo se juega',
    html: `
      <div class="help-section-label">El objetivo</div>
      <p style="font-size:14px;">Los "hijos" votan en secreto quién de ellos es más probable que haga algo. Los demás intentan adivinar quién ganó esa votación.</p>

      <div class="help-section-label">Cómo se juega</div>
      <ul class="help-step-list">
        <li class="help-step"><span class="help-step-num">1</span><span>Al empezar, cada jugador elige su rol para toda la partida: <b>"Soy hijo/a"</b> o <b>"Soy de los que adivina"</b>.</span></li>
        <li class="help-step"><span class="help-step-num">2</span><span>Para cada pregunta (ej: "¿Quién se queja más de no dormir bien?"), los hijos votan en secreto por uno de ellos (puede ser por sí mismos).</span></li>
        <li class="help-step"><span class="help-step-num">3</span><span>El host revela cómo votaron los hijos — gana quien tenga más votos.</span></li>
        <li class="help-step"><span class="help-step-num">4</span><span>Los que adivinan intentan elegir quién creen que ganó esa votación, también en secreto.</span></li>
        <li class="help-step"><span class="help-step-num">5</span><span>Se revela el resultado final y quién adivinó correctamente.</span></li>
      </ul>

      <div class="help-section-label">Cómo se calculan los puntos</div>
      <table class="help-points-table">
        <tr><td>Adivinaste correctamente quién ganó la votación de los hijos</td><td>+1</td></tr>
        <tr><td>Adivinaste incorrectamente</td><td>0 pts</td></tr>
        <tr><td>Empate total entre los hijos (cada uno votó por sí mismo)</td><td>Ronda sin ganador — nadie puede adivinar bien</td></tr>
      </table>
      <div class="help-tip">💡 Si todos adivinan correctamente en una ronda, ¡hay un bonus especial de "acierto perfecto"! 🎯</div>
    `
  },
  photos: {
    title: '📸 Galería de Recuerdos — Cómo se juega',
    html: `
      <div class="help-section-label">El objetivo</div>
      <p style="font-size:14px;">Adivinar los detalles (lugar, año, evento) de fotos familiares que el host u otros jugadores subieron.</p>

      <div class="help-section-label">Cómo se juega</div>
      <ul class="help-step-list">
        <li class="help-step"><span class="help-step-num">1</span><span>El host sube fotos (o cualquiera las propone de antemano) y llena una ficha rápida por foto: 📍 Lugar, 📅 Año, 🎉 Evento.</span></li>
        <li class="help-step"><span class="help-step-num">2</span><span>Se muestra cada foto a todos, sin la ficha visible.</span></li>
        <li class="help-step"><span class="help-step-num">3</span><span>Cada jugador escribe su mejor intento de Lugar, Año y Evento desde su celular.</span></li>
        <li class="help-step"><span class="help-step-num">4</span><span>El host revisa las respuestas de cada jugador y marca cuáles campos acertaron.</span></li>
      </ul>

      <div class="help-section-label">Cómo se calculan los puntos</div>
      <table class="help-points-table">
        <tr><td>Acertar el Lugar de una foto</td><td>+1</td></tr>
        <tr><td>Acertar el Año de una foto</td><td>+1</td></tr>
        <tr><td>Acertar el Evento de una foto</td><td>+1</td></tr>
        <tr><td>Máximo posible por foto</td><td>3 pts</td></tr>
      </table>
      <div class="help-tip">💡 El host decide manualmente qué cuenta como acierto — una respuesta parecida pero no exacta puede marcarse correcta a su criterio. El ícono 💡 le ayuda a ver cuándo el texto coincide exactamente con la ficha.</div>
    `
  }
};

function openHelpModal(topic) {
  const content = HELP_CONTENT[topic];
  if (!content) return;
  document.getElementById('help-modal-title').textContent = content.title;
  document.getElementById('help-modal-body').innerHTML = content.html;
  document.getElementById('help-modal-overlay').classList.add('open');
}

function closeHelpModal() {
  document.getElementById('help-modal-overlay').classList.remove('open');
}
