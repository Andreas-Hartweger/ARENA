# ARENA — First Drive: Implementierungsplan (Revision 0.7.1)

**Plan bestätigt. FD-001 und FD-002 wurden mit getrennten lokalen Ausnahmen freigegeben.** Grundlage: FIRST_DRIVE_SPEC.md, FIRST_DRIVE_TESTS.md und Masterplan v0.7. D00-Gate gemäß Abschnitt 10 der Spezifikation. Das gegenseitige Review steht aus. Schätzungen sind aktive Teamstunden, nicht Codex-Laufzeit. A/B = Rollen, konkrete Zuordnung frei. Je Auftrag eigener Feature-Branch und PR, gegenseitiges Review, CI; keine automatischen Pushes oder Merges. Keine neuen Abhängigkeiten ohne Genehmigung. Bei parallelen Aufgaben Schnittstellen vorab fixieren, keine gleichzeitige Bearbeitung gemeinsamer Dateien.

| Auftrag                      | Abhängigkeit                                          | Rolle |   min–max h | Ergebnis                                                        |
| ---------------------------- | ----------------------------------------------------- | ----- | ----------: | --------------------------------------------------------------- |
| FD-001 Simulation Core       | D00-Gate bzw. ausdrücklich genehmigte FD-001-Ausnahme | A     |       1–2,5 | 60 Hz, Zeit, Koordinaten, Seed, Headless                        |
| FD-002 Fahrzeugdaten & Input | 001                                                   | A     |         3–6 | Definition, State, Tastatur, gemeinsamer Input                  |
| FD-003 Fahrzeugphysik        | 002                                                   | A     |        6–15 | Erst Längsmodell, dann Lenkung/Seitendynamik, Grip, Übergang    |
| FD-004 Academy               | 001/002                                               | B     |         4–9 | TrackDefinition, kanonische Geometrie, Oberflächen, Fortschritt |
| FD-005 Kollisionen           | 003/004                                               | A     |        6–15 | Broad/narrow phase, Impulse, Schutz gegen Tunneling             |
| FD-006 Rendering / HUD       | 003/004; Integration 005                              | B     |        5–12 | Fahrbare Ansicht, Kamera, Debug, HUD                            |
| FD-007 Integration / Abnahme | 001–006                                               | Beide |         2–5 | Kalibrierung, Regression, Demo, Review                          |
| **Gesamt**                   |                                                       |       | **27–64,5** | Ohne Foundation und spätere Release-Funktionen                  |

## Ablauf pro Auftrag

1. `git status`, aktuellen main abrufen (nur sauberer Working Tree); neuen Feature-Branch anlegen. Agent bekommt ausschließlich freigegebenen Auftrag und freigegebene Spezifikation. Andere Änderungen nicht anfassen.
2. Bestandsaufnahme und Kurzplan; relevante Dateien, Schnittstellen und Tests nennen. Bei Konflikt stoppen. Funktion in kleinen überprüfbaren Schritten umsetzen, Tests mitentwickeln. Keine globale Installation; keine Ausgabe vertraulicher Daten.
3. `npm run check` vollständig; gegebenenfalls browserbasierte Tests zusätzlich durchführen, fehlende Ausführungen dokumentieren. Abschlussbericht (Dateien, Entscheidungen, Messwerte, Probleme, relevante Formeln/Code für Eigenleistung), `git diff --stat`, Status. DEVELOPMENT_LOG und TASKS aktualisieren, tatsächliche Zeiten nur wenn bekannt.
4. Mensch prüft Code, startet Anwendung falls relevant, führt Checks aus. Commit/Push selbst, PR erstellen, gegenseitiges Review, CI, Merge durch Menschen. Nicht automatisch Folgeaufträge starten. Bei Blocker reproduzierbaren Test, Ursache und Optionen dokumentieren.

## FD-001 — Simulation Core

Nur mathematische 2D-Welt, klarer Winkelstandard, numerische Validierung, Seed-Generator, FixedStepClock/Accumulator, Pause/Resume/Step, headless Tickrunner und reine Unit-Tests. Keine Fahrzeuge/Track/Renderingänderungen außer minimaler notwendiger Integration ohne Gameplay. Tests: Tickcount bei variablen Frames, Overload-Cap, Pause/Resume, Einzelschritt, keine Zeitsprünge, reproduzierbarer PRNG, Winkelnormalisierung, keine DOM/Three.js-Abhängigkeit. Vertrag für Tick/State/Snapshot dokumentieren. Erster Pilot: aktive Zeit beider Personen, Codex-Laufzeit, Anzahl Rückfragen und Fehler erfassen.

## FD-002 — Fahrzeugdefinition und Input

GT-01 Nennwerte, Appearance, immutable Definition, State, Validierung, ControlInput, KeyboardAdapter inklusive gegensätzlicher Tasten, Glättung, Fokusverlust und Richtungswechsel-Gate. Gleiche Input-Grenzen für jede Quelle. Kein autonomer Fahrer, keine separate Physik. Tests für NaN, Range, beide Tastenschemata, Pause, Alt+Tab, Gas/Bremse, Reverse-Gate. Schnittstellen für FD-003 und FD-004 einfrieren.

## FD-003 — Physik

Interner Zwischenstand 003a geradeaus, b Lenkung/kinematische Langsamfahrt, c dynamische Seitendynamik und Grip, d Übergang/Oberflächen/Stabilität. Verwende Testfixtures ohne Track, dann gemeinsame SurfaceQuery. Messungen 0–100, Vmax, Bremsweg, Reverse, Kurvenkraft, Energie, keine NaN. Kein Kollisionssolver und keine KI. Dokumentiere alle Kalibrierungsänderungen und numerischen Grenzen. Erst wenn 003a Tests grün, b–d hinzufügen. Abnahme zusammen mit FD-007.

## FD-004 — Strecke

Parallel nach gemeinsamem FD-001/002-Schnittstellenmerge möglich. Academy-Daten, Loader/Validator, analytische Linien/Bögen, abgeleitete Render-/Kollisionsgeometrie, SurfaceQuery, gerichtete Tore, Progress und sichere Spawns/Recovery-Kandidaten. Tests TRK-001–014; keine vollständigen Rennregeln, kein Editor, keine anderen Strecken. Ergebnis als stabile Schnittstelle für Kollision/Rendering.

## FD-005 — Kontakte

OBB/SAT, Kontaktpunkte, Impulse und Rotation, Reibung, Korrektur, Filter, Bewegungsschutz, Kontakt-Events. Erst Wand, dann zwei Autos, dann Mehrfachkontakt und Hochgeschwindigkeit. Tests COL-001–016 inklusive dünner Wand, rotierender Fahrzeuge, Energie, bounded solver. Bibliothek nur nach Freigabe. Reset und Positionskorrektur erzeugen keine Fortschrittsgutschrift. Keine Schadenssimulation, keine VFX/Audio-Implementierung.

## FD-006 — Darstellung

Nach 003/004 kann B die Ansicht mit vereinbartem Snapshot-Vertrag beginnen; Kollisionsintegration nach 005. Ersetze technische Testszene durch klar erkennbaren First-Drive-Modus, keine aufwendige finale UI. Drei Kameras, Zoom, Farbe/Nummer, Schatten, lenkende Räder, Bremslicht, HUD, Debug-Overlays. Tests REN-001–015, manuell im Browser; Resize/Disposal, WebGL-Fehler, FPS protokollieren. Früher grafischer Zwischenstand nach 003a+004 möglich, sobald stabile API vorliegt; separate einfache Preview, kein verfrühter Release.

## FD-007 — Integration

Sämtliche Pakete zusammenführen, Zielwerte isoliert messen, Academy mehrere Runden fahren, Reset/Checkpoints/Gras/Barrieren testen, Kollisionstest mit mehreren Autos (Testfixture genügt). Browser breit/schmal, zwei Entwicklergeräte, CI, Offline-Lauf ohne externe Ressourcen. Alle Testprotokolle und bekannte Abweichungen dokumentieren. Release 0.2.0 Vorschlag, erst nach Freigabe taggen. Danach erst First Intelligence (Sensorik) freigeben; Planungsarbeit kann vorher parallel stattfinden.

## Nicht doppelt zählen

FD-001/Teil FD-002/003/005/007 in F-PHY (16–39,5 h), FD-004 in F-TRK (4–9 h), Input in F-CTL (2–4 h); FD-006: F-ART Basis 4–9 h, F-UI HUD 1–3 h. Rest F-ART 3–8 h, Rest F-UI 3,5–8 h erst Complete Foundation. Gesamtrelease neue Schätzung 73,75–181 h; 35 h bestätigtes Startbudget, zusätzliche Freizeit offen. Alte Schätzwerte sind im Excel archiviert. Keine Ist-Zeiten ableiten.

## Stand zum Abschluss von FD-002

FD-FINAL G-01 bis G-06 sind bestätigt. FD-001 (`6651800`, PR #1) ist Teil des FD-002-Basisstands. Laut Auftraggeber war die CI für PR #1 grün. FD-002 wurde unter der gesonderten Ausnahme lokal auf `feature/fd-002-vehicle-controls` umgesetzt. Die vollständige Foundation-Abnahme und das Review durch den zweiten Entwickler sind ausstehend. Die lokale Ausnahme gilt nur für FD-002 und erteilt keine Merge-Freigabe. Zu diesem Zeitpunkt waren ab FD-003 alle Aufgaben gesperrt. Rollen A/B sind keine feste Zuweisung.

## Stand nach der Recovery-Freigabe

FD-002 ist in der Basis `a865f03` enthalten. Die gesonderte Freigabe für `recovery/fd-003-vehicle-physics` erlaubt die lokale funktionale Neuimplementierung von FD-003. Stufe a bestand vor Beginn der Lenkungsarbeit die Geradeausmessungen. Stufe b bestand die Lenktests, Stufe c die Reifen- und Griptests. Stufe d ergänzt die Materialübergänge und Stabilisierung. Kalibrierung, Fehlerpfad und Headless-Prüfung sind abgeschlossen. Beide Entwickler prüfen den lokalen Stand. Ab FD-004 bleibt eine eigene Freigabe erforderlich. Siehe [Abschlussbericht](../DEVELOPMENT_LOG.md#fd-003--recovery-der-fahrzeugphysik).

## Development Batch 01

Die gesonderte Freigabe bündelt FD-004 bis FD-007 auf einem Entwicklungsbranch mit einem PR und geprüften Zwischencommits je Paket. Die Ausnahme vom bisherigen Einzelauftrag gilt bis einschließlich FD-007. G-07 bleibt offen. Siehe [Auftrag](BATCH-01_CODEX_PROMPT.md) und [Fortschritt](BATCH-01_PROGRESS.md).

## Ergebnis des Development Batch 01

Die Pakete FD-004, FD-005, FD-006 und FD-007 bilden den integrierten Kandidaten 0.2.0-rc.1. Paketprüfungen und Sicherungsstand stehen im [Fortschrittsprotokoll](BATCH-01_PROGRESS.md). Für das gegenseitige Review dienen die Prüftabelle und der Einstieg in die Implementierung im [Abschlussbericht](BATCH-01_COMPLETION_REPORT.md).
