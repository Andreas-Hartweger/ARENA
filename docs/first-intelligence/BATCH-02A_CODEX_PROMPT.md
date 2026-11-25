# CODEX-AUFTRAG – ARENA Batch 02A · First Intelligence: AI Perception & Brain

Du arbeitest für Entwickler B im Repository `Andreas-Hartweger/ARENA`. Entwickler A führt die Produkt-/Detailplanung; B und du setzen diese um, testen, dokumentieren und verwalten GitHub. A hat die vollständige Ausführung des gemeinsamen Auftrags **unter der Bedingung erfolgreicher offener Prüfungen und gemeinsamer Abnahme** freigegeben. Arbeite PRE-01–03 und FI-001–012 als EINEN Auftrag ab. Keine Rückfrage nach jedem kleinen Schritt. Dies ist keine Merge-Freigabe.

## 1. Dateien zuerst lesen

Erhalte das vollständige entpackte Übergabepaket `ARENA_Batch_02A` v0.8. Lies README, DECISIONS_D08_D09, BATCH-02A_SPECIFICATION, SENSOR_SYSTEM_SPEC, OBSERVATION_SCHEMA + observation_channels.csv, NEURAL_NETWORK_SPEC, AI_CONTROLLER_SPEC, AI_INSPECTOR_SPEC, BATCH-02A_TASKS, BATCH-02A_TESTS und ARENA_HANDOVER_002 vollständig. Lies vorhandene `AGENTS.md`, Architektur/First-Drive-Spezifikation und lokale Anweisungen. Fehlende Dateien: nicht aus diesem Kurzauftrag erraten; konkret anfordern. Ordne die freigegebenen Spezifikationen unter `docs/first-intelligence/` ein, ohne bestehende Historie zu überschreiben. Der Masterplan ist Planung, kein Nachweis ausgeführter Tests. Neuere explizite Freigaben gehen alten Entwürfen vor; bei echtem Konflikt Grundsatzentscheidung anfordern.

## 2. PRE-01: Git und noch offene First-Drive-Abnahme zuerst

- `git status`, `git fetch origin`, `git rev-parse origin/main`, PR #4 und CI prüfen. Erwartete Basis `68e8d1051a5ea01d544cc1496917568c25b59b92`. Bei abweichendem main Änderung und CI prüfen, keine fremden Änderungen löschen. Sauberer Checkout/Worktree, kein destruktives Git. Laufzeit Node24/npm, `npm ci` falls nötig, `npm run check`, `npm run calibrate`. Dokumentiere echten Output.
- Referenz: First Drive 0.2.0-rc.1, 134 Tests/18 Dateien bestanden, 3.816667 s 0–100, 248.341174 km/h, 31.174882 m Bremsweg, 2.283333 s, 29.675641 km/h rückwärts. B's Bericht vom 25.11.2026: persönliche Fahrprobe PASS, subjektiv „war nicht schön“, zwei Rundenzeiten aus Browser-Replay; Windows-Alt+Tab offen. Nicht als neue Prüfung ausgeben.
- Nativen Alt+Tab nachholen: im echten Chrome W halten, OS-Anwendung wechseln, zurück, F3/Ticks prüfen; keine Bewegung während Pause, nach Resume neutral bis neue Taste. Falls Computer Use blockiert, B einmal manuell durchführen lassen und Evidenz dokumentieren, keine Sicherheitsbeschränkung umgehen. Review von A und B sowie D00/G07 gemeinsam bestätigen lassen (ein zusammengefasster kurzer Freigabeschritt, kein separater Prompt). Codex kann menschliche Zustimmung nicht erteilen. Falls offene Prüfung FAIL, gezielt fixen/retesten; bei notwendiger Grundsatzänderung melden. **KI-Code erst nach dokumentiertem gemeinsamen PASS/Freigabe oder expliziter begrenzter Ausnahme durch beide**. Doku und unabhängige Prüfung dürfen vorbereitet werden. Kein künstliches PASS.

## 3. PRE-02 / PRE-03: Teamworkflow und kleine First-Drive-Korrekturen

- Integriere B's vorhandene Entwürfe `HANDOVER_CURRENT.md`, `HANDOVER_LOG.md` und AGENTS-Dokuauftrag mit `ARENA_HANDOVER_002.md`; DEVELOPMENT_QUEUE, DEVELOPMENT_PROGRESS und DECISION_REQUESTS ergänzen. Keine doppelte/überschriebene Historie. Scope PRE/FI klar dokumentieren. AGENTS gezielt um diese Batch-Ausnahme ergänzen.
- Nach Gate auf `feature/batch-02a-ai-perception-brain` arbeiten. Recovery-Hinweis 3 simulierte Sekunden (180 ticks), Pause friert, F3 „Grip-Auslastung“ + N je Achse. Fahrgefühl dokumentieren, nicht willkürlich Physik/Kamera/Lenkung ändern. Bestehende Funktionalität erhalten.

## 4. Implementiere FI-001 bis FI-012 ohne weitere Zwischenfreigaben

1. FI-001/002: versioniertes GT-01-Sensorprofil, 16 Rays mit exakt spezifizierten Origins/Angles/Ranges, Referenz und optimierte Geometrie, getrennte Edge/Barrier/Vehicle-Kanäle, sichtbare Materialien, echte Occlusion. Unabhängige Kandidaten unsichtbar. Keine Kamera/Radar/LiDAR-Implementierung.
2. FI-003: lokale sichtbare Orientierung, 7 Vorschaupunkte (5,10,20,40,60,100,150 m), adaptive konservative Sichtprüfung mit Nachweis. Kein verstecktes Weltwissen, keine Fortschritts-/Checkpoint-Hints, keine Vorschau durch Wände. Unsichtbare Werte null + Maske; separate Position/Heading/Krümmung. Bei Mehrdeutigkeit konservativ invalid.
3. FI-004: 248 Kanäle exakt gemäß Register; Normalisierung, 4 Gegner-Slots, Gültigkeit, Schema-/Profil-/Modellkompatibilität. Grip μ aktuell, keine F3-Auslastung. Kein unbenutzter Reservekanal.
4. FI-005/006: eigenes Feedforward-MLP, Standard 248→32→16→3, 8547 Float64 Parameter; 1–4 hidden layers, 4–128 Neuronen, max. 100000. Dense, Tanh/ReLU/Leaky ReLU, linearer Output; deterministic SeededRandom, Glorot/He, Bias 0, defensive Ownership, stabile Layoutversion. Keine neue Dependency.
5. FI-007: Tanh-Adapter, Pedal/Lenkung/Richtung, keine Deadzone, Hysterese ±0.5, bestehende Richtungswechselregeln (positive Antriebsanforderung, 0.05 m/s, 18 Ticks). Gemeinsame Zielaufbereitung mit Tastatur; bestehende analoge Kalibrierung nicht verändern; keine doppelten Filter. Kein Auto-Recovery oder Fahrhilfe.
6. FI-008: KI-Integration 60-Hz-Welt, Standard Sensor/Inference 30/30; erster Tick frisch, Caches/Zustände pro Fahrer, gemeinsam unveränderliche Gewichte, atomare Veröffentlichung einschließlich KI-Caches. Fehler kontrolliert sperren, keine partiellen Frames. Headless und sichtbarer interner Testmodus mit klar als untrainiert/Fixture markiertem Gehirn. Mensch-Modus unverändert.
7. FI-009/010: Sensor Inspector + interaktiver Brain Inspector, echte Messdaten/Aktivierungen/Gewichte/Summen/Bias, Tickzuordnung, Pause/Einzeltick; live max 10 Hz, geschlossen kein unnötiger Trace; keine Gehirnänderungen, keine erfundenen Anzeigen.
8. FI-011: alle IDs aus TESTS abarbeiten, Regression 134 bestehende Tests, calibrate, npm run check, Browserprüfung, Benchmarks. Rohmessdaten, SHA/Hardware/Seeds, keine fiktive Performance. Optimierung gegen Referenz. Kein Lernnachweis in 02A behaupten.
9. FI-012: vollständiger Abschlussbericht, Doku, Queue/Progress/Handover, PR/CI. Keine automatische 02B-Freigabe.

## 5. Arbeits- und Git-Regeln

- Nur PRE-01–03 und FI-001–012. Technische reversible Entscheidungen (Dateinamen, Indexstruktur, UI-Layout, effiziente interne Berechnung) selbst treffen, solange Specs und Tests eingehalten werden. Keine neuen Produktentscheidungen/Abhängigkeiten, keine Änderung bestätigter Physik. Bei fachlichem Widerspruch `PLANUNGSENTSCHEIDUNG ERFORDERLICH` mit Task, Problem, Repro, Alternativen, Tradeoffs, Empfehlung, Abhängigkeiten und SHA. Betroffenen Task blockieren, unabhängige freigegebene Tasks fortsetzen. Keine neue Frage, wenn lediglich ein klarer technischer Bug vorliegt.
- Commits eigener geprüfter Änderungen nach zusammenhängenden Teilpaketen erlaubt; gezielte Tests vor Commit, komplette Qualitätsschleife an Integrationspunkten. `git push -u origin HEAD` ausschließlich auf `feature/batch-02a-ai-perception-brain`, danach remote SHA verifizieren. Kein Force-Push, Reset fremder Änderungen, keine Tags, keine direkten main-Pushes. Ein Writer. Kein Merge ohne ausdrückliche getrennte Genehmigung. Falls Branch bereits besteht, verifizieren und fortsetzen statt überschreiben.
- Erstelle einen PR nach main mit Scope, Test-/Kalibrierungsnachweis, Benchmarks, tatsächlichen Einschränkungen, G07-Status, Nachweisen und Review-Anforderung. CI bis tatsächlichem Ergebnis kontrollieren; bei Fehlern selbst korrigieren, falls autorisiert. Keine CI-Erfolge erfinden. Wenn CI noch läuft, Status offen.
- Status pro Task nachvollziehbar: In Planung / Freigegeben / In Arbeit / Automatisch geprüft / Auf GitHub gesichert / Review ausstehend / Abgeschlossen / Blockiert. Automatische Prüfung ersetzt kein menschliches Review. Keine autonome Fortsetzung nach beendeter Session versprechen.

## 6. Nicht Teil dieses Auftrags

Fitness, Mutation, Population, Generation, Trainingsloop/-UI, dauerhafte Modellablage/Import, trainierte Starter-KI, vollständige Rennen, weitere Strecken, Minikarte, Fahrgefühl-Retuning, Kamera/Radar/LiDAR, echte autonome Fahrzeugsoftware, GPU/ML-Dependencies. Diese Themen folgen in 02B–D/Batch03 oder später. **Funktionsfähige untrainierte KI ist das Ziel**, nicht bereits gute Runden. Die KI darf schlechte Entscheidungen treffen; mathematische Fehler dürfen die Welt nicht beschädigen.

## 7. Abschlussbericht

Erstelle `docs/first-intelligence/BATCH-02A_COMPLETION_REPORT.md`: (A) Basis/Branch/Commit/Remote/PR/CI, (B) G07 und native Alt+Tab + menschliche Freigaben, (C) PRE-HUD-Fixes, (D) je FI-Paket Änderungen und Test-IDs, (E) 248-Kanal-/8547-Parameter-Nachweis, (F) Sichtschutz/Referenzvergleich, (G) Reproduzierbarkeit und Atomarität, (H) Browser-/Inspector-Evidence, (I) Benchmarkdaten, (J) npm check/calibrate inkl. alte Referenzwerte, (K) offene Befunde, Abweichungen und Review/Merge-Status. Gib SHA, Link und nächste zulässige Aufgabe aus. Queue leer oder 02B noch nicht freigegeben: `NÄCHSTER PLANUNGSAUFTRAG ERFORDERLICH`. Stoppe dann nach sauberem Checkpoint.

Beginne mit PRE-01. Arbeite nach erfülltem Gate sämtliche freigegebenen Arbeitspakete selbstständig ab. Bitte keine zusätzliche Zwischenfreigabe je Aufgabe; ausschließlich notwendige menschliche Abnahme/echte Planungsblocker eskalieren.
