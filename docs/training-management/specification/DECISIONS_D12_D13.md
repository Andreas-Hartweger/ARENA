# Verbindliches Entscheidungsregister v0.10

96 bestätigte Entscheidungen (D12 49, D13 47; insgesamt 507). Rekonstruktion aus den bestätigten Chat-Runden, keine wortgetreuen Transkripte. Alle Anmerkungen und nachfolgenden technischen Präzisierungen bleiben Bestandteil des Vertrags.

| ID | Wahl | Thema | Vertrag |
| --- | --- | --- | --- |
| D12.1.1 | C | Zentrales Training Laboratory | Ein zentraler Konfigurator mit Einstieg aus Library, Fahrzeug, Strecke und Modell; nur expliziter Start. |
| D12.1.2 | D | Standard und Advanced | Gemeinsame versionierte Vorlagen, immutable Snapshot bei Start; Standard sinnvolle Defaults, Advanced freigegebene Parameter. |
| D12.1.3 | C | Modell, Run und Session getrennt | Modellversion immutable, Run eigener Evolutionszustand, Session je Ausführung; Resume gleicher Run, Clone neuer Run. |
| D12.1.4 | D | Live, Accelerated, Headless | Gemeinsame Engine; Live 1x, beschleunigt und headless ohne Regeländerung; optionale Beobachtung separat. |
| D12.1.5 | C | Sichere Moduswechsel | Darstellung unabhängig; Ausführungsänderung an sicheren Grenzen, Workerwechsel nach Episode; kein Wechsel der Fitness. |
| D12.1.6 | C | Pause, Resume, Finish, Cancel | Kooperative Tickgrenzen, ACK; Finish vollständige Generation, Cancel keine unvollständige Selektion. |
| D12.1.7 | C | Anwendungsweites Training | Ein aktiver Run einschließlich Pause; Navigation unabhängig; Browser-Suspend/Close nicht garantiert. |
| D12.1.8 | C | Warteschlange | Geordnete freigegebene Aufträge, optional explizites Autostart; keine selbst erfundenen Versuche. |
| D12.2.1 | D | Coordinator und Worker Pool | Coordinator eigener Worker, isolierte Simulationsworker, reiner 02B-Referenzkern, UI nur kontrollierte Snapshots. |
| D12.2.2 | D | Leistungsprofile | h=gemeldete logische CPU; Eco floor25%, Balanced50%, Performance75%; min1, max min(16,max(1,h-2)); Custom gleicher Bereich. |
| D12.2.3 | D | Deterministischer Scheduler | Ein Episodejob je Worker; Seeds und Slots vorab; dynamische Zuteilung; kanonische Reduktion. |
| D12.2.4 | D | Geschwindigkeiten und Durchsatz | Live 1x; Accelerated 1/2/5/10/25/50/Max, Custom; Headless capped/Max; pro Episode Rate getrennt vom aggregierten Tickdurchsatz. |
| D12.2.5 | D | Resource Management | Eco256/Balanced512/Performance1024 MiB verwaltete Laufzeitdaten; Custom begrenzt; Preflight, Backpressure, bounded queues. |
| D12.2.6 | D | Profiling-basierte Optimierung | Float64-Referenz; TypedArrays, Bufferreuse, Transfer nur Kopien; WASM/SIMD/SAB nur nach Evidenz/Freigabe. |
| D12.2.7 | D | CPU-Referenz und GPU-Roadmap | CPU v1; Compute-Schnittstelle klein; WebGPU/native später, Präzisionswechsel neue Version. |
| D12.2.8 | D | Responsive Scheduling | Abschnitt max64 Ticks oder ca.8ms soft, echte Eventloop-Yields; Stats5Hz, Inspector<=10Hz; Coordinator ebenfalls kooperativ. |
| D12.2.9 | D | Deterministische Abnahme | Gleiche Runtime: Genome, Fitness, Ranking, Lineage, Adaption exakt; einmaliger transient Retry; Wallclock nicht Fitness. |
| D12.3.1 | D | Atomarer Preflight | Konfig, Modell, Ressourcen, Speicher, Ziel, Lease prüfen; Start snapshot; vorbereitete Ressourcen bei Fehler freigeben. |
| D12.3.2 | D | Kooperative Pause und Drain | Pause alle Worker und Coordinator bestätigen; Drain beendet aktive Episoden ohne neue zu starten; kein Zeitnachholen. |
| D12.3.3 | D | Exakte Wiederaufnahme | Live-Zustand inklusive Cache, RNG, Ledger erhalten; Session/Config validieren; Crash via D13. |
| D12.3.4 | D | Stop und Cancel | Finish aktuelle vollständige Generation ohne unnötige Nachkommen; Cancel verwirft Staging; separate Löschung. |
| D12.3.5 | D | Goal und Budget Engine | Generationen, Episoden, aktive Zeit, Fitness, Runden, Rundenzeit, Erfolgsquote, Beständigkeit, Plateau; AND/OR; vollständige Grenzen; harte Zeit optional Cancel. |
| D12.3.6 | D | Sichere Queue | 32 wartend plus ein Run; immutable Auftrag, edit = neuer Stand; Preflight erneut; Autostart explizit. |
| D12.3.7 | D | Serienexperimente | Explizite Seeds/Parameterlisten, Vorschau, Serien-ID, gemeinsames Budget, maximal Queuegrenze; keine autonome Forschung v1. |
| D12.3.8 | D | Versionierte Live-Eingriffe | Runtime-Knobs sicher; Lernoperatoren ab Generationsgrenze; neuer Bewertungsabschnitt mit Neubewertung bei Fitness/Task; inkompatible Architektur neuer Run. |
| D12.3.9 | D | Fault Management | Transient einmal gleicher Job; invalid/fatal block; Ressource pausiert; Fehler sichtbar; Session fencing. |
| D12.4.1 | D | Modulares Dashboard | Standard/Advanced/kompakte Analytics; vorbereitete Layouts, Module toggeln, responsive. |
| D12.4.2 | D | Ghost-Darstellung | Standard max8/Advanced16 Fahrzeuge; ein selektierter Fahrer, isolierte Ghosts, Zeiten sichtbar; gleiche Geometrie. |
| D12.4.3 | D | Beobachtung und Replay | Aktive Auswahl pinnen, vorläufiger Leader getrennt vom Champion, separate Replay/Analyse-Budgets. |
| D12.4.4 | D | Kameras und Analyse | Bestehende Kamera, Follow, Übersicht, frei, Zoom, Minimap optional, echte Trajektorien/Gates. |
| D12.4.5 | D | Mehrstufiges HUD | Fahrdaten, Runstatus, Fitness, Durchsatz; Advanced Worker/Fehler/Diversity/Adaption; vorläufig/confirmed; Null bei fehlenden Werten. |
| D12.4.6 | D | Lernkurven und Fahranalyse | Best/mean/median/quartile, Erfolg, Rundenzeit, Diversity, Durchsatz, Fehler; ausgewählte echte Pfade, Speed/Ereignisse. |
| D12.4.7 | D | Population und Evolution UI | Raster, virtuelle Liste, Sortierung, echte Eltern/Operatoren und Links zu Inspectors. |
| D12.4.8 | D | Performante UI | Bounded Snapshots, virtuelle Listen, nur sichtbare Module, Headless ohne Fahrzeugrendering, Accessibility. |
| D12.5.1 | D | Brain Inspector | 02A weiterverwenden; Schichten, Gewicht, Bias, Summe, Aktivierung, ausgewählte Zeitverläufe, <=10Hz. |
| D12.5.2 | D | Sensor Inspector | 248 Roh-/normierte Werte, Masken, Einheiten, echte Rays, Zuordnung Inputneuronen, ausgewählte Zeitverläufe. |
| D12.5.3 | D | Fitness Inspector | Tatsächliche Formelteile, Ereignisse; hypothetische Neugewichtung nur bei vollständigen Rohdaten und unverändertem Task. |
| D12.5.4 | D | Population Laboratory | Filter nach Leistung, Fehler, Herkunft, Genom, Zustand; Diversity und Historie; Details nur wenn vorhanden. |
| D12.5.5 | D | Evolution Inspector | Echte Eltern, Eliten, Crossover, Immigrants, Mutation, aktueller Übergang und optionale Details. |
| D12.5.6 | D | Genome Comparison | Zwei Modelle, kompatible Parameterzuordnung, Schichtdifferenz/Heatmap, gemeinsame kontrollierte Fahrten. |
| D12.5.7 | D | Performance Monitor | Worker/Throughput/Time/RAM estimates; optional Komponentenprofiling; echte OS-Werte nur falls verfügbar. |
| D12.5.8 | D | Advanced Control Center | Alle freigegebenen Parameter gruppiert mit Einheiten, Defaults, Bereichen, Dependencies und Änderungsklasse. |
| D12.6.1 | D | Versionierte Runtime | Typisierte Kern-/Command-/Snapshot-/Storage-Adapter; Referenzpfad erhalten; Coordinator alleiniger Commit. |
| D12.6.2 | D | Worker Protokoll | Version, Run/Session/Segment/G/Slot/Scenario/Attempt/WorkerLease, Contract, Seed; validierte Nachrichten, Idempotenz. |
| D12.6.3 | D | Transaktionale Steuerung | State Machine, serialisierte Befehle, ACK und Priorität, terminale Zustände; Fault isoliert. |
| D12.6.4 | D | UI Datenarchitektur | Immutable Snapshots, timestamps, bounded subscription; 1 Live Detailtrace, 2 Vergleichsmodelle, 600 Anzeigeproben. |
| D12.6.5 | D | Benchmarks und Langzeittests | 1/2/4/weitere Worker, n8..1024, >=3 Messläufe; Browser20min, Headless2h; Regressionen untersuchen. |
| D12.6.6 | D | Sicherheitsvertrag | Schema und semantische Prüfung, Größen vor Allokation, finite Werte, sichere Texte, Fault Injection, Traceability. |
| D12.6.7 | D | D12 Release Gate | Alle 49 D12 plus D13 und frühere Regressionen, unabhängige Prüfung, TR-Regeln, ausdrückliche Mergefreigabe. |
| D13.1.1 | D | Identitätssystem | ModelID, VersionID, GenomeID, RunID, CheckpointID getrennt; Hash keine Autoridentität. |
| D13.1.2 | D | Personalisierte Profile | Name64, Beschreibung2000, 20 Tags je32 Zeichen; Farbe/Symbol/Favorit; technische Metadaten geschützt. |
| D13.1.3 | D | Klassifikation | Herkunft, Verwaltung, Training, Spezialisierung, Validierung, Typ/Rolle separat; offizieller Status trusted release. |
| D13.1.4 | D | Versionierte Modellhistorie | Immutable Versionen, aktive/bevorzugte Version explizit, archivieren, Elternbezug. |
| D13.1.5 | D | Model Manifest | Architektur, Layout, dtype, Sensor/Controller/Kompatibilität, Init, Training/Validierung referenziert. |
| D13.1.6 | D | Performance Records | Version, Szenario, Fahrzeug, Aufgabe, Profil, Seed, Runtime, Stichproben, Herkunft; train/val/test getrennt. |
| D13.1.7 | D | Champion System | GenBest, RunChampion, validierter Champion, Rekorde je Kontext, geschützte Meilensteine; gezielt archivieren. |
| D13.1.8 | D | Provenance | D11 Lineage referenzieren, Quellen/Versionen/Events, imported claims getrennt; fehlende Eltern markieren. |
| D13.1.9 | D | Model Library | Suche, Filter, Sortierung, Favoriten/Sammlungen/Archiv, Metadaten lazy; Referenzschutz. |
| D13.2.1 | D | Creation Wizard | From Scratch, Starter, Clone, Import; Standard/Advanced; Create Model getrennt von Start Run. |
| D13.2.2 | D | From Scratch | D09 MLP/Glorot/He, reproduzierbarer Seed; D11 unabhängige Population, kein verborgenes Wissen. |
| D13.2.3 | D | Starter Library | Unveränderliche offizielle Versionen, echte Fähigkeiten und Grenzen; D14 validiert; eigene Entwicklungslinie. |
| D13.2.4 | D | Clone | Neue ModelID, konkrete Version als Quelle, gleiche kanonische Genome, eigene Historie; keine Population kopieren. |
| D13.2.5 | D | Import Wizard | Staging, Vorschau, Kompatibilität/Herkunft; explizite Übernahme, keine automatische Ausführung. |
| D13.2.6 | D | Architekturkonfigurator | 1..4 Hidden,4..128 Breite, cap100k (aktuell max81795), tanh/relu/leaky, Parameterzahl vorab; neuer Vertrag bei Architekturwechsel. |
| D13.2.7 | D | Weitertraining | Neuer Run mit D11 seeded population: 1 exact,25% random,Rest mutiert; Resume nur vollständiger Checkpoint. |
| D13.2.8 | D | Entwicklungszweige | Beliebige erhaltene kompatible Ausgangsversion; eigene Resultate; Promotion explizit, kein Genom-Merge. |
| D13.2.9 | D | Super-KI Programm | Später größere/netzübergreifende Systeme, Transfer, Hybrid, unabhängige Benchmarks und Freigabe; keine dauerhafte Parametergrenze. |
| D13.3.1 | D | Storage Engine | IndexedDB, modulare Backends, Transaktionen; eine schreibende Session, konkurrierende Tabs geschützt. |
| D13.3.2 | D | Checkpoint Vertrag | Generationsgrenzen, Population, Phase, Identitäten, Config/History/Adaptive/RNG/Budget/Champion, Versionen; Mid-Episode später. |
| D13.3.3 | D | Autosave | Initial, jede G default,1/5/10/25 oder Zeitrequest an Grenze, Abschluss/Meilenstein; ein Writer; Pflichtcommit vor nächster G. |
| D13.3.4 | D | Manual Save Center | Save Model/Champion/Checkpoint/Backup getrennt; letzter Grenzstand oder nächste Grenze vormerken; manuelle Saves geschützt. |
| D13.3.5 | D | Transaktionale Sicherung | Neue Daten vollständig validieren, Commit vor Bereinigung, vorherige gültige Punkte, SHA256; strict durability soweit verfügbar. |
| D13.3.6 | D | Recovery | Neuer SessionID, letzter gültiger Stand, ältere Fallbacks, Verlustrisiko sichtbar, keine ungefragte Queue. |
| D13.3.7 | D | Storage Budgets | 1GiB konfigurierbar quotenabhängig, letzte3 AutoCP je relevantem Run, manuelle/Champion geschützt, Historie kompakt, Tracebudgets, Schreibreserve. |
| D13.3.8 | D | Backup Restore | Portable Model/Checkpoint/Library Backup, transitive Abhängigkeiten, Integrität; manueller externer Export Browser, native später. |
| D13.3.9 | D | Archiv und Löschung | Archiv != Löschen, Papierkorb30Tage, Impact Preview, Referenzen schützen, unreferenzierte Bytes GC. |
| D13.3.10 | D | Future Storage | Austauschbare Backends, später native/OPFS, verlustfrei/inkrementell/streaming, Migration schützt Original. |
| D13.4.1 | D | Containerformat | ZIP-basiert, manifest, Typ/Version, binäre Daten und Prüfsummen; .arena-model/.arena-checkpoint/.arena-backup. |
| D13.4.2 | D | Tensor Genomvertrag | Foundation Float64 LE, D09 Layout, finite Grenzen, count/bytes, künftige dtype versioniert; Digest vs Byteintegrität getrennt. |
| D13.4.3 | D | Import Sicherheit | Allowlist, bounded compressed/decompressed sizes/count, kein traversal, duplicate, symlink, nested/executable; Staging atomar. |
| D13.4.4 | D | Kompatibilitätsmatrix | Ausführen, Trainieren, Resume, Parametervergleich, Leistungsvergleich getrennt mit Gründen. |
| D13.4.5 | D | Identitätsabgleich | Hash+echte Gleichheit, ID Konflikt kontrolliert neue Variante/Mapping, kein Überschreiben, Referenzen konsistent. |
| D13.4.6 | D | Migration | Schema/Paket/Modellverhalten getrennt; unterstützte lossless Migration, Original geschützt; unbekannt reject. |
| D13.4.7 | D | Faire Benchmarks | Gemeinsame Szenarien/Verträge, Erfolg/Runden/Fehler/Compute, unabhängige Stichproben, Train/Val/Test getrennt. |
| D13.4.8 | D | Trust Modell | Integrität, Herkunft, Kompatibilität, Validierung getrennt; offizielle trusted release, spätere Signaturen. |
| D13.4.9 | D | Transfer | Portable Abhängigkeiten, Kompatibilitätsbericht, explizite Resume/Branch, Queue aus, cross-runtime nicht ungeprüft exakt. |
| D13.4.10 | D | ZIP Release | First Release lokaler Browserbuild mit Launcher, fester Origin, Offline, getrennte Daten/Backups; Desktop/Portable später; finale Verpackung 03E. |
| D13.5.1 | D | Storage Architektur | Zentrale validierte Storage API, Coordinator logischer Owner, fenced Schreiblease; native Adapter später. |
| D13.5.2 | D | Data Contract | Kanonische Kodierung, IDs, Referenzen, Schema-/Semantikprüfung, getrennte raw byte integrity/Fingerprint; Größen begrenzen. |
| D13.5.3 | D | Checkpoint und Recovery | Fortsetzungsphase, Pflichtsave barrier, Rollback/Branch, Budgets, keine dauerhafte Mid-Episode. |
| D13.5.4 | D | Storage Manager | App-Budget vs Quota vs RAM; physisch dedup, reclaimable, Schreibreserve, Schutz, Archiv/Trash/Backup/Integrity. |
| D13.5.5 | D | Paketpipeline | Isoliert, bounded streaming/staging, konsistenter Export, Abbruch, Konflikte, Restore; keine willkürliche Dateiausführung. |
| D13.5.6 | D | Update und Migration | App/DB/Format/Runtime getrennt, Recovery, stabile Origin, ZIP Vorbedingungen, Native später. |
| D13.5.7 | D | Storage Performance | >=3 Wiederholungen, gleiche Arbeit, Autosave overhead, RAM/UI, GC, Import/Export, >15% Regression untersuchen. |
| D13.5.8 | D | Testvertrag | Unit/Integration/real browser, Fault Injection, Referenzvektoren, Roundtrip, konkurrierende Tabs, deterministische Resume. |
| D13.5.9 | D | 02C Release Gate | 02B Freigabe vor Code; 96 Entscheidungen, frühere Verträge, TR01-08, volle Referenz, Parallelvergleich, 20min/2h, CI, Review, Mergefreigabe. |
