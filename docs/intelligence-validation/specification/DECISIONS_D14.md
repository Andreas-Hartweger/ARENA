# D14 · 70 bestätigte Entscheidungen
Alle D; konsolidierte Vertragsfassung, keine wörtliche Abschrift. Konkrete technische Startwerte in den Modulverträgen sind reversible Ausführungspräzisierungen, keine zusätzlichen Abstimmungen.

## D14.1.1 – Referenzarchiv
G0-Best, G31-Ersterfolg, finaler Champion, schnellster Fahrer und Meilensteine mit Genom, Vertrag, Seed und Evidenz schützen; Rekonstruktion kennzeichnen.

## D14.1.2 – Baselines
Untrainiert, Zufallssuche, bisherige Evolution, menschliche/programmierte Referenz getrennt; Zusatzwissen kennzeichnen.

## D14.1.3 – Leistungsziel
Zuverlässigkeit, Geschwindigkeit, Kontrolle; Foundation-Verträge geschützt, unabhängige Freigabe; später adaptive Super-KI.

## D14.1.4 – Kennzahlen
Fitness, Zeit, Erfolg, Fehler, Fortschritt, Lern- und Compute-Kosten, Stichprobenumfang; keine universelle Intelligenzpunktzahl.

## D14.1.5 – Fairness
Gleiche Episodenbudgets, Tick- und Zeitbudgets getrennt; gepaarte Seeds, Hardware/Runtime dokumentieren.

## D14.1.6 – Szenarien
Academy fix; kontrollierte Startvarianten, getrennte Train/Dev/Test; weitere Strecken erst wenn verfügbar.

## D14.1.7 – Meilensteine
Lernnachweis, Wiederholbarkeit, robuster Fahrer, Performance; 50/75/90% Populationsziele, 50/45/40s Forschungsziele keine Freigabegarantie.

## D14.1.8 – Research Program
Versionierte Hypothesen, Budgets, Ergebnisse, negative Resultate und Freigabe; TR-01–08.

## D14.2.1 – Population
32/64/128/256/512/1024, gleiche Episodenbudgets, Kosten und Vielfalt; größere erst bei Budget.

## D14.2.2 – Selektion
Turnier 2/3/5/8; Elternpool 100/50/25%; vorhandene Tie-RNG-Regeln.

## D14.2.3 – Eliten
1/2/5/10/20%; unterschiedliche Genome bevorzugen, vollständige Neuauswertung, Champion unabhängig geschützt.

## D14.2.4 – Mutation p
1/2/5/10/20%, architekturabhängige Kalibrierung, tatsächliche Änderungen/Clipping erfassen; null bleibt null.

## D14.2.5 – Mutation Stärke
Alpha .05/.1/.2/.4/.8; große Schritte 0/5/10/20%, Faktor 2/5/10; erst einzeln, dann kombiniert.

## D14.2.6 – Crossover
0/10/25/50%, uniform/neuronweise; kompatible verschiedene Genome, Mutation danach; spätere Ausrichtung getrennt.

## D14.2.7 – Adaption
p/alpha separat und kombiniert; W10/15/25, epsilon1, Faktor1.5; bestehende Caps und Reset.

## D14.2.8 – Immigrants
0/5/10%, Rescue 15% bei 45 stagnierenden Generationen; Eliten schützen.

## D14.2.9 – Diversität
Normalisierte Genomdistanz, einzigartige Genome, Fortschritt/Zeiten/Fehler und ausgewählte Trajektorien; zunächst Diagnose.

## D14.2.10 – Alternative Evolution
Foundation GA erhalten; ES, DE, separierbare CMA-ES, NEAT, Quality Diversity, Coevolution/hybrid später.

## D14.3.1 – Größen
4147/8547/9123/18115/81795 Parameter, schrittweise Ressourcenvergleich; keine dauerhafte Maximalgröße.

## D14.3.2 – Tiefe/Breite
1–4 Hidden; 34, 32-16, 32-8-8, 32-8-8-8 ähnlich groß vergleichen.

## D14.3.3 – Aktivierung
Tanh/ReLU/Leaky .01, passende Initialisierung; Aktivierung/Sättigung/Nullen/Tempo diagnostizieren.

## D14.3.4 – Initialisierung
Glorot Uniform, He Uniform entsprechend D09, Bias null, mehrere Seeds; alternative Initialisierung separat.

## D14.3.5 – Frequenz
10/15/20/30/60 Hz synchron, Physik 60 Hz, Befehle halten; kompatibler Vertrag und eigenes Training.

## D14.3.6 – Sensorforschung
248 Kanäle Referenz; aktuelle Inspector-Analyse, Ablation nur eigener Vertrag/Maskierung; kein Hidden Info.

## D14.3.7 – Architekturvergleich
Gleiche Regeln zuerst, dann kalibrierte Mutation; gemeinsame Tests, Episoden/Ticks/Zeit getrennt.

## D14.3.8 – Compute
Float64 CPU geschützt, Profiling, Puffer und parity; GPU/WASM/SIMD/Mixed Precision später separat.

## D14.3.9 – Gedächtnis
Foundation MLP zustandslos, Controllerzustand kein neuronales Gedächtnis; Historie/GRU/LSTM/Attention später.

## D14.3.10 – Super-KI Architektur
MLP/RNN/Transformer/GNN/CNN/World Models/MoE/MPC/hybrid; keine dauerhafte Parametergrenze; Ressourcen/Qualität je Version.

## D14.4.1 – Fitnessprofile
Balanced/Speed/Safety und ausgewählte Custom; gemeinsame unabhängige Fahrtests; Hierarchie geschützt.

## D14.4.2 – Rewards
D10 Referenz, lawful progress, Tor/Ziel; experimentelle neue Formeln separat; Aggregation getrennt.

## D14.4.3 – Penalties
Gewichte zuerst, Rohdaten und Sättigung; neue Kurven/Fristen nur neue Version.

## D14.4.4 – Speed
From Scratch Speed und Weitertraining Balanced getrennt; gültige Zeit und Zuverlässigkeit; Aufgabenzeit inkl Anfahrt.

## D14.4.5 – Fahrdynamik
Kurvenphasen, Gas/Bremse/Lenkung/Schlupf/Reifenkräfte soweit verfügbar; reine Diagnose.

## D14.4.6 – Recovery
Eigenständige gültige Starts und Tasks, selbstständige Rückkehr; Standard-NoProgress unverändert.

## D14.4.7 – Curriculum
Konstante Aufgabe vs versionierte Phasen; geschützte Zwischenstände, re-eval ganzer Population beim Wechsel, gleicher Gesamtaufwand.

## D14.4.8 – Reward Hacking
Adversarielle Negativtests, Rohdaten, Trajektorien; betroffene Resultate sperren und korrigiert wiederholen.

## D14.4.9 – Adaptive Rennintelligenz
02D Solo; Gegner/Haftung/Wetter/Strategie später; situationsabhängig statt heimliches Profilumschalten.

## D14.4.10 – Multiobjective
Skalare Referenz erhalten; Pareto, NSGA-II, MAP-Elites, constrained RL/hierarchisch später.

## D14.5.1 – Matrix
47 Screening-Varianten, 32 Evolution+15 Architektur/Frequenz/Fitness; gestufte Matrix und priorisierte Zusatzversuche.

## D14.5.2 – Seeds
Screen 42/43, Baseline 42–44, Bestätigung 101–103, Langzeit 201/202; Holdout getrennt.

## D14.5.3 – Budgets
8192/25600/51200 Episoden; vollständige Generationen, Ticks/Inferenz/Zeit/RAM separat.

## D14.5.4 – Screening
Mindestbudget, mehrere Kennzahlen, Schutz langsamer Varianten; Referenz+bis fünf Alternativen vertiefen.

## D14.5.5 – Hyperparameter
Einzelstudien, Interaktionen, begrenzte reproduzierbare Suche; Hypothese und Grenzen dokumentieren.

## D14.5.6 – Coordinator
02C wiederverwenden, eindeutige IDs/Status/Queue, persistente Wiederaufnahme, kontrollierte Folgeversuche.

## D14.5.7 – Gesamtbudget
48 aktive Maschinenstunden summiert, 1.6 Mio reguläre Episoden, 5 Mrd Ticks; 15% Zeit/Tickreserve; Zwischenberichte 12/24h.

## D14.5.8 – Langzeit
Bis zwei Konfigs x zwei neue Seeds x51200; Weitertraining getrennt, alte Champions schützen.

## D14.5.9 – Stop Policy
Technische Faults sicher stoppen, Stagnation Diagnose; Mindestbudget, Abbruch transparent, kein Seedersatz.

## D14.5.10 – Performance
Headless Max, gemessene Worker-Skalierung, keine Qualitätsverluste; unabhängige Versuche auf mehreren Rechnern.

## D14.5.11 – Evidence
IDs, Config, Seeds, Runtime, Champion/Speed Record, Meilensteine, Kennzahlen, Ressourcen und Auswahlentscheidung; negative Resultate.

## D14.6.1 – Holdout
40 Dev, 60 separate finale Szenarien; Modellfreeze vor Test; neue Holdouts nach Optimierung; organisatorisch geschützt.

## D14.6.2 – Startbedingungen
20 je leicht/mittel/schwer, lateral bis .5/1.5/2.5m, heading bis 5/15/30°, Anfangsgeschwindigkeit 0..10m/s; gültige Geometrie.

## D14.6.3 – Reliability
54/60 gesamt, je Gruppe >=16/20, Standardfahrt erfolgreich; gleiches eingefrorenes Genom.

## D14.6.4 – Speed Gates
Starter Standard/Median <=75/75s, Performance <=50/60s; gültige Runde ohne Anfahrt.

## D14.6.5 – Quality Gate
Kein Kontakt mit normaler Annäherung >=10m/s in 60 Tests, >=90% erfolgreiche Fahrten ohne Cluster, Grasmedian <=2s/max<=10s.

## D14.6.6 – Multi-Lap
12 Drei-Runden-Szenarien >=10, zusätzlich Standard 3 Runden, 360s, NoProgress, keine schweren Kontakte/Resets.

## D14.6.7 – Recovery
18 Tests, 6 je Heading/Gras/Rand; >=12/18 und >=3/6 je; 20s Rückkehr plus 20m in 5s; optionales Zertifikat.

## D14.6.8 – Statistik
Alle Seeds, Quantile, n, gepaarte Vergleiche, zensierte erste Erfolge, keine falschen unabhängigen Wiederholungen.

## D14.6.9 – Anti-Hacking
Unabhängige Rohdatenprüfung, Trajektorien, adversarielle Tests und Wiederfahrten.

## D14.6.10 – Regression
Historische Modelle schützen; gemeinsame Szenarien, Warnung >5pp Erfolg / >5% Median; >15% Performance untersuchen.

## D14.6.11 – Promotion
Max drei verschiedene eingefrorene Kandidaten vor Holdout, Rollen/Kompatibilität/Evidenz; Starter für First Release zwingend.

## D14.7.1 – Modellfamilie
Mindestens validierter Starter; Performance und max ein Spezialist optional, höchstens drei Kandidaten.

## D14.7.2 – Capabilities
Rolle, Fahrstil, Schwierigkeit, Fähigkeit getrennt; Rennen erst Batch03; keine künstlichen unfairen Vorteile.

## D14.7.3 – Integration
D13 Registry, read-only Original, Clone/Training, kompatible Testfahrten, keine stille Zufallsersetzung.

## D14.7.4 – Intelligence Archive
Historische vier Rollen, Provenance/Hash, negative Resultate, geschützte Backups, Restore.

## D14.7.5 – Promotion/Rollback
Immutable Version, Dev-Auswahl, Freeze, unabhängiger Holdout, Registry-Promotion, kompatibler Rollback.

## D14.7.6 – Research Package
Alle nominalen Versuche mit Status, Rohdaten, Benchmarks, Modelle und Auswahl; Grenzen/negative Resultate.

## D14.7.7 – Runtime Contract
02C wiederverwenden, gemeinsame Engine, versionierte Tasks, Recovery/IDs/Budget/Holdout und Regressionen testen.

## D14.7.8 – Zwei Gates
Technische Abnahme separat von Model Readiness; Budgetende ohne Starter offen; unabhängige 03-Arbeit möglich.

## D14.7.9 – Batch-Übergang
Bedingte Freigabe im nächsten Prompt, unabhängiges Review, Merge/CI vor Folgecode, TR01–08.

## D14.7.10 – Zukunft
Super-KI, prozedurale Seed-Welten, variable Straßenbreite, Hindernisse, Weltgrößen, Höhen, Brücken/Tunnel und echte Kreuzungen; spätere Planung.
