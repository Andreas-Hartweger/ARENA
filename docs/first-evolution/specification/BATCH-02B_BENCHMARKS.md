# Benchmarkvertrag

Historische Vergleichsbasis 02A (Intel Core Ultra7 255H, Node24 Windows, CPU): 167237 MLP-Auswertungen/s; 8653 Ticks/s Einzel-KI 30/30; 6305 aggregierte Fahrzeugticks/s 100 unabhängig 30/30; 1684 bei 60/60. Original 02A-Messmatrix, kein aktuell neu gemessener Durchsatz. Nicht als Sollwert auf anderer Hardware verwenden.

Dokumentiere CPU, RAM, OS, Node, Browser/GPU falls relevant, SHA, Config, Seeds, Power/Last, Warmup (>=1000 Komponentenoperationen / >=600 Fahrzeugticks), >=3 Messwiederholungen (5 bevorzugt), >=5 s Messfenster wo praktikabel, andernfalls tatsächliche Dauer begründen. Median/min/max/p95 mit klarer Definition, Rohmesswerte als JSON. Gleiche Modell-/Szenariodaten für gepaarte 02A vs 02B Auswertung; 30/30 und 60/60 getrennt. Trace off/on, passiver Bewertungsfeed off/on. CPU- und Walltime, VehicleTicks/s (nicht Worldticks als Fahrzeugticks), Episoden/s, simulierte Zeit pro Echtzeit, Generation walltime, Genomoperationen/s, Heap/RSS und gehaltene Daten. Kein Rendering für Headless-Benchmarks; Browserregression separat.

| Matrix | Größen | Metrik |
|---|---|---|
| Fitness/Progress/Penalty | echte aufgezeichnete oder deterministisch erzeugte akzeptierte Tick-Fakten | ns/tick, Wertegleichheit |
| RNG/Mutation/Crossover/Hash | 4147/8547/18115/81795 Parameter | Genome/s, Speicher, Trace overhead |
| Selection/Diversity | 8/32/128/512/1024 Kandidaten | Zeit/Generation, Skalierung |
| Episode | Standard GT-01, Academy, identische Seeds; 30/30 und 60/60 | ticks/s, Eval/s, Fitness exakt |
| Gesamt | 8/32/128/512/1024; klein/standard/groß; Maxarch Teilset | Zeit, Auswertungen, Peak Speicher |
| Diagnose | 128, compact vs selected trace | Mehraufwand und unveränderte Ergebnisse |
| Adaptiv | 128, an/aus, identische fixtures | Zeit, Trigger, Speicher |
| Endurance | >=200 kleine Generationen, separate echte 100×128 Referenz | gehaltene Genome/Welten, erwartetes Historywachstum, Heap/RSS |

Große echte Episodenbenchmarks dürfen dokumentiertes Teilset nutzen; funktionale Maximalpopulation trotzdem prüfen. >15% Medianverlust auf gleicher Hardware ist Untersuchungsmarker (technische Konkretisierung), kein universeller harter Grenzwert. Regression in Physik/AI/Determinismus ist blockierend. Begründung und Evidenz, kein Verstecken von Speicherwachstum durch erwartete kompakte Historie. Kein Trainingserfolg oder Zeitversprechen aus synthetischem Benchmark ableiten. Lernqualität/mehrere Seeds/Random-Baseline bei gleichen Evalbudgets und Walltime umfassend 02D.
