# Batch 02A – Implementierungsauftrag und Abhängigkeiten

A = zentrale Planung/Freigabe; B = Umsetzung mit Codex, technische Tests/GitHub. Reihenfolge PRE-01/02, PRE-03, FI-001..012; PRE-02 vorbereitbar ohne KI-Code. Keine neue Freigabe nach jedem FI-Paket. PRE-01 Gate muss abgeschlossen oder ausdrücklich gemeinsam ausgenommen sein. Jede Stufe wird mit gezielten Tests, Dokumentation, Commit/Push auf freigegebenen Branch und SHA gesichert. Keine künstliche Parallelisierung auf derselben Branch.

| ID     | Paket                | Verantwortlich | Voraussetzung                | Ergebnis                                                                              | Startstatus         |
| ------ | -------------------- | -------------- | ---------------------------- | ------------------------------------------------------------------------------------- | ------------------- |
| PRE-01 | First Drive / G07    | B + A/B        | Vor FI-001                   | Native Alt+Tab, gemeinsames Review, Freigaben dokumentieren; sonst explizite Ausnahme | Bedingt freigegeben |
| PRE-02 | Teamworkflow         | B              | PRE-01 parallel vorbereitbar | Vorhandene Entwürfe zusammenführen; AGENTS-Ausnahme, Queue und Handover               | Bedingt freigegeben |
| PRE-03 | HUD-Korrekturen      | B              | Gate                         | Recovery 3 Simulationssekunden, Grip-Auslastung + N; keine Physikänderung             | Bedingt freigegeben |
| FI-001 | Sensorprofile        | B              | Gate                         | Profilvalidierung, IDs, Geometrie, Frequenz, immutable Konfiguration                  | Bedingt freigegeben |
| FI-002 | Raycasting & Objekte | B              | FI-001                       | Referenz und optimierte Suche, Grenzen, OBB, Verdeckung, isolierte Kandidaten         | Bedingt freigegeben |
| FI-003 | Sichtbare Strecke    | B              | FI-002                       | Lokale Orientierung, zusammenhängende Vorschau, keine Informationslecks               | Bedingt freigegeben |
| FI-004 | Kanalregister        | B              | FI-001–003                   | 248 Werte, Skalierung, Masken, Signaturen, Rohdaten                                   | Bedingt freigegeben |
| FI-005 | MLP-Kern             | B              | FI-004                       | Dense Float64, Aktivierungen, mathematische Fixtures                                  | Bedingt freigegeben |
| FI-006 | Modelle              | B              | FI-005                       | Seed, Parameterlayout, Ownership, Kompatibilitätsprüfung                              | Bedingt freigegeben |
| FI-007 | Steueradapter        | B              | FI-005–006                   | 3 Ausgaben, 60-Hz-Steuerzustand, gemeinsame Regeln                                    | Bedingt freigegeben |
| FI-008 | Integration          | B              | FI-004–007                   | Atomare Weltticks, isolierte Instanzen, headless und sichtbarer Testmodus             | Bedingt freigegeben |
| FI-009 | Sensor Inspector     | B              | FI-008                       | Messpunkte, Kanäle, Masken, Alter, Profil                                             | Bedingt freigegeben |
| FI-010 | Brain Inspector      | B              | FI-008–009                   | Live-Aktivierungen, Summen, Bias, Gewichte, Auswahl, Einzeltick                       | Bedingt freigegeben |
| FI-011 | Tests und Benchmarks | B              | FI-001–010                   | Vollständiger Katalog; Messungen, Regression, Browser und Ressourcen                  | Bedingt freigegeben |
| FI-012 | Abschluss / PR       | B              | PRE + FI-011                 | Bericht, saubere Branch, remote SHA, CI, menschliches Review ausstehend               | Bedingt freigegeben |

## Definition of done je Aufgabe

- PRE-01: aktueller SHA, CI und vollständiger B-Bericht; native Alt+Tab und menschliche G07/Review-Entscheidung, oder ausdrücklich dokumentierte Ausnahme. Bei FAIL Ursachen bearbeiten, nicht durch KI-Code überdecken. Bei fehlender Person Doku und unabhängige Tests möglich, Gate bleibt blockiert.
- PRE-02: vorhandene Handover-Entwürfe integrieren, Queue/Progress/Decision Requests, AGENTS eng begrenzt ergänzen. Keine doppelte Wahrheit. Prüfe Stand der Entwürfe bei B, A besitzt sie nicht.
- PRE-03: UI-only; PRE-004/005 PASS. Fahrgefühl als offene Aufgabe ohne Retuning.
- FI-001/002/003: SENSOR_SYSTEM_SPEC; SEN-001–019. Dokumentiere Geometrie, Sichtbeweis, tolerierte Grenzfälle, Indexwahl und Vergleich. Keine neuen Strecken/Physikregeln.
- FI-004: OBSERVATION_SCHEMA + CSV; SEN-020–022, OBS-001–005. Vollständiges Kanalregister, eindeutige Semantik, sichere Gültigkeit und Kompatibilität.
- FI-005/006: NEURAL_NETWORK_SPEC; NN-001–007. Eigener Kern, Initialisierung, Modell-Ownership, kein Lernen/Dateiimport.
- FI-007/008: AI_CONTROLLER_SPEC; CTL-001–005, INT-001–006. Gemeinsame Befehlsaufbereitung, Welttransaktion, Headless und sichtbarer Modus.
- FI-009/010: AI_INSPECTOR_SPEC; INS-001–004. Mess-/Entscheidungstick, echte Daten, auswählbare Neuronen, Pause/Step; keine Time Machine.
- FI-011: REG/BEN vollständig, zusätzlich alle bisherigen Test-IDs wiederholen. Benchmark-Rohdaten und Browser-Evidence.
- FI-012: `BATCH-02A_COMPLETION_REPORT.md`, Progress, Queue, Handover, CI und PR mit Beschreibung. Status technisch geprüft, menschliche Review/Merge ausstehend. Bei Blocker betroffenen Teil stoppen, autorisierte unabhängige Aufgaben weiterführen. 02B erst nach expliziter Freigabe und erfüllten Abhängigkeiten.
