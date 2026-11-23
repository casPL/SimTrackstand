// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Maciej Kasprzyk
//
// The bike data table, the start and result cards, and the tip after each attempt.

function bikeInfo() {
  const c = prep(cfg.p);
  const lock = BIKE.lock * RAD;
  const s0 = support(c, 0),
    s1 = support(c, lock);
  const cm = (m) => fmt(m * 100, 1);
  $('dblTxt').textContent =
    i18n`Na motocyklu ${bike()} przechył poza krawędzią śladu opon rośnie dwukrotnie mniej więcej co ${fmt(doubling(cfg.p), 2)} s, jeśli nic nie zrobisz.`;
  $('specTitle').textContent = i18n`Dane: ${bike()}, ${bar(cfg.p)}`;
  const rows = [
    [i18n`Masa motocykla / kierowcy`, `${BIKE.m} / ${BIKE.mr} kg`],
    [i18n`Środek ciężkości z kierowcą na podnóżkach: wysokość`, `${Math.round(c.h * 100)} cm`],
    [i18n`Rozstaw osi / środek ciężkości przed tylną osią`, `${fmt(BIKE.L, 2)} / ${fmt(BIKE.b, 2)} m`],
    [i18n`Wyprzedzenie (trail) / skręt kierownicy`, `${Math.round(BIKE.trail * 100)} cm / ±${BIKE.lock}°`],
    [i18n`Ślad tylnej opony: szerokość × długość`, `${cm(c.wr)} × ${cm(c.lr)} cm`],
    [i18n`Ślad przedniej opony: szerokość × długość`, `${cm(c.wf)} × ${cm(c.lf)} cm`],
    [i18n`Pas podparcia: kierownica prosto / do oporu`, `±${cm(s0.half)} / ±${cm(s1.half)} cm`],
    [i18n`Opona dochodzi do krawędzi śladu przy przechyle`, `${fmt(c.edge / RAD, 1)}°`],
    [i18n`Kierownica do oporu przesuwa środek ciężkości w stronę skrętu o`, `${cm(cogShift(c, lock))} cm`],
    [i18n`Przesunięcie bioder nad podnóżkami`, `±${Math.round(BIKE.du * 100)} cm`],
    [i18n`Przesunięcie ciała przód–tył`, `±${Math.round(FORE * 100)} cm`],
    [i18n`Opór toczenia opon`, `${fmt(c.crr, 3)}`],
  ];
  $('spec').innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  drawSupportDemo();
}

const bike = () => BIKE.name;

function clearRun(next) {
  S = newState();
  step(S, cfg.p, {});
  trace = [];
  traceT = 0;
  fall = null;
  footK = 1;
  standLoad = 0;
  phase = next;
  paused = false;
  syncAct();
  invalidate();
}

function reset() {
  clearRun('ready');
  showReady();
}

/** A new attempt: the bike rests on the left foot until the rider stands up. */
function start() {
  clearRun('setup');
  $('overlay').hidden = true;
  if (LANDPADS.matches) $('play').scrollIntoView({ block: 'end', behavior: 'smooth' });
}

/** Both feet on the pegs: from now on the clock runs and the rider balances. */
function standUpNow() {
  if (phase !== 'setup') return;
  standLoad = S.footLoad / G;
  standUp(S);
  phase = 'ride';
  paused = false;
  syncAct();
  invalidate();
}

function showReady() {
  const rec = best[bestKey()];
  $('overlay').hidden = false;
  $('overlay').innerHTML = `<div class="card">
    <h2>${bike()}</h2>
    <p class="meta">${bar(cfg.p)} · ${i18n`tempo ${pct(cfg.tempo)}`}${rec ? ' · ' + i18n`rekord ${fmt(rec)} s` : ''}</p>
    <p>${i18n`Zaczynasz ze <b>stopą na ziemi</b>. Ustaw kierownicę i biodra tak, żeby nacisk na lewą stopę spadł prawie do zera, i dopiero wtedy wstań na podnóżki.`}</p>
    <p>${i18n`Potem stoisz w kwadracie jak najdłużej. Balansujesz <b>biodrami</b>, <b>kierownicą</b> i <b>ciałem przód–tył</b>. Z kierownicą skręconą w stronę przechyłu przetocz motocykl kilka centymetrów do przodu, a koła wjadą pod środek ciężkości.`}</p>
    <p>${i18n`Próba kończy się podpórką, gdy środek ciężkości ucieknie o ${DAB_DEG}° od podparcia, albo gdy opona dotknie linii kwadratu.`}</p>
    <p class="keys">${i18n`<kbd>A</kbd> <kbd>D</kbd> biodra · <kbd>←</kbd> <kbd>→</kbd> kierownica · <kbd>W</kbd> <kbd>S</kbd> przód i tył · <kbd>Spacja</kbd> wstań`}</p>
    <p>${cfg.tempo < 1 ? i18n`Tempo ${pct(cfg.tempo)}: czas płynie wolniej, fizyka zostaje ta sama.` + ' ' : ''}${i18n`100% to czas rzeczywisty.`}</p>
    <button class="btn go" id="goBtn">${i18n`Start (Spacja)`}</button>
  </div>`;
  $('goBtn').addEventListener('click', start);
}

function tipFor(r) {
  if (r.rolledOut)
    return i18n`Motocykl wytoczył się z kwadratu. Przetaczaj go krótko i od razu wracaj ciałem na środek. Długie trzymanie przodu albo tyłu wyprowadza motocykl coraz dalej.`;
  if (r.time < 1.5 && r.load > 3)
    return i18n`Przy wstawaniu lewa stopa niosła ${kg(r.load)} kg, więc motocykl od razu poleciał w lewo. Zanim wstaniesz, przesuń biodra w prawo, aż nacisk na stopę spadnie prawie do zera. Kierownica skręcona w lewo dokłada nacisku, w prawo go zmniejsza.`;
  if (r.time < 1.5 && r.load < -2)
    return i18n`Przy wstawaniu motocykl ciągnął już w prawo, więc od razu poleciał na drugą stronę. Przed wstaniem ustaw biodra bliżej środka albo skręć kierownicę bardziej w lewo, aż nacisk na stopę będzie bliski zera.`;
  if (r.heldInto)
    return i18n`Motocykl przewrócił się w stronę skręconej kierownicy. Dopóki koła stoją, skręcona kierownica trzyma środek ciężkości po stronie skrętu. Gdy motocykl zaczyna się kłaść w stronę skrętu, przetocz go do przodu: koła pojadą łukiem pod środek ciężkości.`;
  if (r.fellAway)
    return i18n`Motocykl przewrócił się na stronę przeciwną do skrętu kierownicy. Wtedy przetocz go do tyłu: koła pojadą łukiem w drugą stronę, pod środek ciężkości. Pomagają też biodra na wyższym podnóżku.`;
  if (r.wrongBody)
    return i18n`Biodra szły w stronę przechyłu. To prostuje motocykl tylko na chwilę, a opona zjeżdża spod środka ciężkości. Gdy motocykl kładzie się w prawo, dociśnij lewy podnóżek i przesuń biodra w lewo. Motocykl pochyli się pod tobą, a opona wróci pod środek ciężkości.`;
  if (r.time < 4)
    return i18n`Korekty muszą być małe i wczesne. Patrz na kropkę środka ciężkości w panelu podparcia i reaguj, zanim wyjdzie z zielonego pasa.`;
  return i18n`Dobrze. Teraz mniejsze i wcześniejsze ruchy bioder, zanim kropka środka ciężkości dojdzie do brzegu zielonego pasa.`;
}

function finish() {
  phase = 'over';
  syncAct();
  invalidate();
  const side = Math.sign(S.cogLean) || 1;
  const r = {
    time: S.t,
    load: standLoad,
    meanCog: S.t > 0 ? deg(S.sumCog / S.t) : 0,
    intoPct: S.t > 0 ? (100 * S.into) / S.t : 0,
    rolledOut: S.done === 'roll',
    heldInto: Math.sign(S.d) === side && Math.abs(S.d) > 15 * RAD,
    fellAway: Math.sign(S.d) === -side && Math.abs(S.d) > 15 * RAD,
    wrongBody: Math.sign(S.u) === side && Math.abs(S.u) > 0.4 * BIKE.du,
  };
  fall = { phi: S.phi, k: 0, side };
  const k = bestKey();
  const isRec = r.time >= 1 && r.time > (best[k] || 0);
  if (isRec) {
    best[k] = Math.round(r.time * 10) / 10;
    store.set('simtrackstand-best', best);
  }
  const record = best[k] ? `${fmt(best[k])} s` : '–';
  $('overlay').hidden = false;
  $('overlay').innerHTML = `<div class="card">
    <h2>${r.rolledOut ? i18n`Wyjazd z kwadratu` : i18n`Podpórka`}</h2>
    <div class="stats">
      <div class="stat"><div class="k">${i18n`Czas`}</div><div class="v${isRec ? ' rec' : ''}">${fmt(r.time)} s</div></div>
      <div class="stat"><div class="k">${i18n`Śr. CoG`}</div><div class="v">${fmt(r.meanCog, 1)}°</div></div>
      <div class="stat"><div class="k">${i18n`Kier. w przechył`}</div><div class="v">${fmt(r.intoPct, 0)}%</div></div>
    </div>
    <p class="meta">${i18n`maks. przechył ${fmt(deg(S.maxLean), 0)}° · maks. toczenie ${Math.round(S.maxRoll * 100)} cm · na stopie przy wstaniu ${kg(r.load)} kg · rekord ${record} · ${bar(cfg.p)} · tempo ${pct(cfg.tempo)}`}</p>
    ${isRec ? `<p><b>${i18n`Nowy rekord.`}</b></p>` : ''}
    <p class="tip">${tipFor(r)}</p>
    <button class="btn go" id="goBtn">${i18n`Jeszcze raz (Spacja)`}</button>
  </div>`;
  $('goBtn').addEventListener('click', start);
}
