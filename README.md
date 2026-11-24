# SimTrackstand

A browser trackstand trainer. Stand on the pegs of a supermoto-class bike that does not move and keep it
upright for as long as you can, with your hips and the handlebar. Tyre pressure changes the contact patches
the bike stands on. The bike data, of the Supermoto 450, comes from [SimGP8](https://github.com/casPL/SimGP8);
[SimWheelie](https://github.com/casPL/SimWheelie) is its wheelie counterpart.

[Opis po polsku](#po-polsku) jest niżej.

## Playing

The game is a single HTML file and needs nothing but a browser. Download one of these and open it:

- [dist/simtrackstand-en.html](dist/simtrackstand-en.html), English
- [dist/simtrackstand-pl.html](dist/simtrackstand-pl.html), Polish

How to play:

- Each attempt starts with the bike resting on your left foot. <kbd>←</kbd> <kbd>→</kbd> turn the bars and
  <kbd>A</kbd> <kbd>D</kbd> move your hips; the number in the corner is the load on the foot. Bring it close
  to zero, then stand up on the pegs with <kbd>Space</kbd>.
- On the pegs: <kbd>A</kbd> <kbd>D</kbd> take your hips 8 cm to one side while held, and they come back when
  you let go; <kbd>←</kbd> <kbd>→</kbd> turn the bars. The wheels stand still: a bike this heavy does not roll
  on the flat from moves of the body, and there is no throttle and no brake. <kbd>P</kbd> pauses.
- The attempt ends with a dab when the centre of gravity gets 10° away from the support of the tyres.
- On a phone the buttons sit under the picture, and on top of it in landscape.
- Game speed 50% or 35% slows the clock down and leaves the physics as it is. Records are kept for each tyre
  pressure and game speed.

The fonts come from Google Fonts; offline, the browser falls back to its own.

## What it models

- The roll of the bike and rider as an inverted pendulum about the line where the tyres touch the asphalt.
- Contact patches as ovals: their area comes from the load on each tyre and its pressure, and a softer tyre
  spreads more along its length than across it. At 2 bar the front patch is about 5 × 10 cm. As the bike
  leans, the point the tyres push from moves across the patches up to their edge and then onto the round
  crown, so softer tyres forgive more.
- The handlebar at a standstill: the front patch cannot slide, so turning the bars turns the frame about the
  rear tyre and carries the centre of gravity towards the turn, about 3 cm at full lock. The turned front
  patch turns its long side across the bike and widens the support band.
- The movement of the bars rolls the bike the other way at once: turning them a little further towards the
  lean straightens the bike slightly, about 0.4° for every 10°, unless they are already at full lock.
- The hips over the pegs: moving them rolls the bike the other way through the pegs, and where they end up
  sets the centre of gravity.
- The start on one foot, with the load on the foot from the bars and the hips.
- A support panel seen from above, the contact patches to scale, and a telemetry chart of the last 12 s:
  lean, centre of gravity over the support, bars and hips.

## Building

Node.js 18 or newer, no dependencies:

```sh
node build.js     # writes dist/simtrackstand-pl.html and dist/simtrackstand-en.html
npm test          # what the physics promises, a key-pressing rider, translation checks
npm run format    # Prettier, the only development dependency
```

## Source layout

```text
src/js/           the game; build.js joins the files in order, and they share one scope
  core … physics    the physics, which also runs without a browser (see test/)
  i18n … main       the interface
src/page.*.html   the markup of each edition
src/style.css     styles
src/shell.html    the document the build fills in
src/en.json       the English dictionary
test/             tests, and a rider that plays with the keys (test/bot.js)
```

## Translations

Polish is the source language. Interface strings stay in the code as templates tagged with
`i18n`, and every other edition has a dictionary that maps each Polish template (with `{}` for each
placeholder) to its translation. To add a language, copy `src/en.json` to `src/<lang>.json` and
translate the values, translate `src/page.en.html` into `src/page.<lang>.html`, and add the edition
to `EDITIONS` in `build.js`. The build stops with a list of missing or unused entries, and the tests
check that every page has the same markup.

## Licence

SimTrackstand is free software: you can redistribute it and/or modify it under the terms of the GNU General
Public License as published by the Free Software Foundation, either version 3 of the License, or (at your
option) any later version. It comes with no warranty. See [LICENSE](LICENSE).

## Author

Maciej Kasprzyk, Instagram [@cas8pl](https://www.instagram.com/cas8pl/)

## Po polsku

SimTrackstand to trening trackstandu, czyli balansu motocyklem w miejscu, w przeglądarce. Stoisz na
podnóżkach motocykla klasy supermoto, który się nie toczy, i utrzymujesz go jak najdłużej biodrami
i kierownicą. Ciśnienie w oponach zmienia ślady, na których stoi motocykl. Dane motocykla (Supermoto 450)
pochodzą z [SimGP8](https://github.com/casPL/SimGP8), a [SimWheelie](https://github.com/casPL/SimWheelie)
to trening jazdy na tylnym kole.

Gra to jeden plik HTML, wystarczy przeglądarka: pobierz [dist/simtrackstand-pl.html](dist/simtrackstand-pl.html)
(albo angielski [dist/simtrackstand-en.html](dist/simtrackstand-en.html)) i otwórz go. Próba zaczyna się
ze stopą na ziemi: <kbd>←</kbd> <kbd>→</kbd> kierownica, <kbd>A</kbd> <kbd>D</kbd> biodra, a gdy nacisk na
stopę jest bliski zera, <kbd>Spacja</kbd> stawia na podnóżki. Na podnóżkach <kbd>A</kbd> <kbd>D</kbd>
przesuwają biodra o 8 cm w swoją stronę, póki trzymasz klawisz, a <kbd>←</kbd> <kbd>→</kbd> skręcają
kierownicę. Koła stoją, nie ma gazu ani hamulca, a <kbd>P</kbd> to pauza. Na telefonie przyciski są
na ekranie.

Model obejmuje przechył motocykla z kierowcą jako odwrócone wahadło na linii opon, owalne ślady opon
zależne od nacisku i ciśnienia (na schemacie w skali), przesuwanie się podparcia po śladzie aż do jego
krawędzi, kierownicę na postoju (rama obraca się wokół tylnej opony, a dokręcenie kierownicy w stronę
przechyłu od razu lekko prostuje motocykl, o ile nie jest na full locku), biodra nad podnóżkami, start
ze stopą na ziemi i telemetrię z ostatnich 12 sekund.

Budowanie: `node build.js` (Node.js 18 lub nowszy, bez zależności), testy: `npm test`. Teksty
interfejsu są w kodzie po polsku jako szablony `i18n`, a słownik `src/en.json` tłumaczy je na
angielski; nowy język dodaje się tak, jak opisano w sekcji Translations.

Licencja: GNU GPL w wersji 3 lub nowszej (plik [LICENSE](LICENSE)). Autor: Maciej Kasprzyk,
Instagram [@cas8pl](https://www.instagram.com/cas8pl/).
