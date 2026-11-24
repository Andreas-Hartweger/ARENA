# Technische Entscheidungen

- Bestätigt sind TypeScript im Strict Mode, React mit Bordmitteln, normales CSS, Three.js, Vite, Node.js 24 LTS und npm.
- Vitest, ESLint, Prettier, Git und GitHub Actions bilden die Prüfwerkzeuge. WebStorm ist die gemeinsame Entwicklungsumgebung. Das Lockfile hält die aufgelösten Versionen fest.
- Die Browserversion kommt zuerst. Die grafische Darstellung ist orthografisch und dient im aktuellen Meilenstein als technischer Startbildschirm.
- Simulation, Grafik, KI und UI haben eigene Verantwortlichkeiten. Die Simulation beginnt zweidimensional. Die Renn-KI braucht keine externen KI-Dienste.
- Der Offline-Kern, die Bedienungsebenen Standard und Advanced sowie das modulare Einzelprojekt sind bestätigt.
- Versionsnummern werden mit benannten Meilensteinen kombiniert. Beide Entwickler prüfen Änderungen gegenseitig und geben die Foundation ausdrücklich frei.

Offen bleiben Spielerprofile, konkrete Simulationsschnittstellen und die Umsetzung einer optionalen Desktop-Version.

## FD-002 · Lokale Ausnahme und technische Festlegungen

- Der Auftraggeber hat nach dem gemeldeten erfolgreichen CI-Lauf von FD-001 (PR #1) ausschließlich die vorläufige lokale Entwicklung von FD-002 auf `feature/fd-002-vehicle-controls` freigegeben. Die G-07-Abnahme und das gegenseitige Review bleiben offen. Ein Merge in main und der Beginn von FD-003 bedürfen eigener Freigabe.
- Tastatur-Lenkempfindlichkeit verwendet den vorgeschlagenen Bereich 0,5× bis 1,5× mit Standard 1×. Gegensätzliche Lenkbefehle setzen das Ziel auf null mit der bestätigten Rückstellrate. Der Wechsel zur Gegenseite verwendet die Aufbaurate auf beiden Seiten von null. Beim Bremsen wird der angewandte Gaswert sofort gelöscht. Ein freigegebener Richtungswechsel beginnt seine Gasrampe bei null.
- Die Haltezeit ist im Fahrzeugzustand als Zahl aufeinanderfolgender 60-Hz-Ticks gespeichert. Direkte Analogbefehle und Tastatureingabe nutzen dasselbe Richtungsgate. Leistungsziele und physikalische Grenzen sind als Daten hinterlegt. Wirkungsnachweis und Kalibrierung gehören zu späteren Aufträgen.
