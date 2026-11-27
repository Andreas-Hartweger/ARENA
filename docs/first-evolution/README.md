# First Evolution · Arbeiten mit Batch 02B

Der Headless-Runner wertet jeden Kandidaten in einer eigenen GT-01-Fahrt auf dem Academy Training Circuit aus. Ein kompletter Standardlauf umfasst 12.800 Episoden. Die [Originalspezifikationen](specification/README.md) definieren Produktregeln und Abnahmepunkte. Die [Teamentscheidungen](../team/DECISION_REQUESTS.md) enthalten die nachgelagerte Präzisierung der maximalen Rundenzahl.

## In WebStorm oder im Terminal ausführen

Im Projektverzeichnis Node 24 verwenden. Die Zielverzeichnisse für Läufe müssen neu sein. Der Runner legt sie an und schreibt nach jeder bestätigten Generation die Kandidaten- und Generationsdaten.

```sh
npm ci
npm run check
npm run calibrate
node scripts/run-evolution.mjs .npm-cache/reference-01 reference
node scripts/verify-evolution-run.mjs .npm-cache/reference-01
```

Die vorhandene Referenz unter `docs/first-evolution/evidence/reference-release` kann direkt mit `node scripts/verify-evolution-run.mjs docs/first-evolution/evidence/reference-release docs/first-evolution/evidence/interrupted-prefix.json` nachgerechnet werden. Neben Fitness, Statistik, Mutationszählern und Abstammung prüft der Befehl die ersten 77 Generationen gegen den vor der Unterbrechung gesicherten Datenstand. Für 35 Generationen liegt zusätzlich ein separat gefahrener [Vergleich](evidence/repeat-comparison.json) vor. Für einen laufenden Lauf prüft `--partial` die bereits vollständig gespeicherten Generationen. Der Prüfer liest unkomprimierte oder gzip-komprimierte Einzelzeilen.

Mit `node scripts/replay-evolution-audit.mjs docs/first-evolution/evidence/reference-release --records-only` prüft der aktuelle Koordinator die gespeicherten Einzelergebnisse. Er rekonstruiert Genom und Abstammung jedes Slots und vergleicht sämtliche Kandidaten- und Generationsdaten. Wer zusätzlich je Generation zwei Modelle erneut fahren lassen will, kann `--records-only` weglassen. Für den veröffentlichten Endabgleich genügt die Rekonstruktion.

```sh
node scripts/run-evolution.mjs .npm-cache/evolution-8x4 short 8 4
node scripts/run-evolution.mjs .npm-cache/random-8x4 random 8 4
```

Beide Kurzläufe verwenden dieselbe G0 und dasselbe Auswertungsbudget. Im Modus `random` initialisiert jede weitere Generation alle Modelle neu. Die Ausgabe enthält den tatsächlich gemessenen Champion und die Abschlussgründe. Zeit und Speicher stehen außerhalb der Fitness.

## Auswertung eines Ticks

1. `DriveWorld.step` fragt den vorhandenen Fahrer ab und führt Steuerung, Physik und Kontaktlösung aus. Der optionale fünfte Konstruktorparameter aktiviert Evaluatorfakten. Im normalen Spiel ist er aus.
2. `solveContacts` hält für jedes Fahrzeug die innerhalb eines akzeptierten Substeps beobachteten Kontaktpartner, dessen Zeitintervall und die größte Annäherung fest. Verwirft der Solver den Substep, verwirft er auch dessen Daten. Der HUD-Filter für Impulsereignisse behält seine bisherige Bedeutung.
3. `recordTravel` gibt zu seinem regulären Rundenstatus auf Wunsch datierte Fakten aus. Projektion, Torbreite, Richtung, Öffnung, Invalidierung und Ziel beruhen auf der bestehenden Prüfung. Gutschrift verwendet Start und Ende derselben physischen Bewegung. Eine rückwärtige Positionskorrektur kann ein bereits befahrenes Stück erneut freilegen. Der Ledger zieht diese Überlappung vor dem nächsten Zuwachs ab. Bei einem vom Rundenprüfer insgesamt verworfenen Travel erfasst er nur den physischen Rohweg.
4. Die Welt friert Fakten und Fahrzeugzustand gemeinsam ein. Erst danach liest der Evaluator den veröffentlichten Frame. Die Tangente wird am lokal projizierten Endstand des Fahrzeugs ausgewertet. Die Körpergeschwindigkeit stammt aus dem veröffentlichten Physikzustand. Die beiden Grasanteile stammen aus den Achsenmaterialien des gerade berechneten Physikticks.
5. `ProgressLedger` hält rechtmäßig erreichte Höchststände und einmalige Torbits je Aufgabenrunde über Invalidierungen hinweg. `Penalties` integriert diskrete Zeiten und führt Kontaktcluster zusammen. Der Episodenauswerter entscheidet am Tickende über Ziel, Zeitlimit und Fortschrittsfrist. Bei einem Ziel im Tick endet die Bewertung am interpolierten Torzeitpunkt. Körperwerte des letzten Frames sind dabei diskrete Endwertnäherungen. Ein detaillierter Trace enthält den vollständigen beobachteten Substep und die zugehörige Bewertungsgrenze `terminalTime`.

Die 248 Wahrnehmungskanäle, die Sensor- und Entscheidungstakte und die Inferenz gehören weiter dem 02A-Fahrer. Die Fitness liest die veröffentlichte Entscheidung über dieselbe Welt wie der menschliche Fahrmodus. Die Steuerung kann weder den Fortschrittsledger lesen noch eine Episode selbst anhalten oder zurücksetzen.

## Genetik und Transaktion

- `model` leitet das Layout aus dem bestehenden Brain ab. Die Gewichte eines Neurons liegen zusammen, sein Bias im separaten Biasblock der Schicht. `Genome` besitzt seine Float64-Kopie. Die Modellkompatibilität umfasst Signatur, Dimensionen, Aktivierung und Layout.
- Der Node-Adapter bildet SHA-256 über zwei vorangestellte Little-Endian-uint32-Felder (Anzahl UTF-8-Headerbytes, Anzahl Parameter), den kanonischen UTF-8-Modellvertrag und die Little-Endian-Float64-Werte. Beide Nullvorzeichen ergeben dieselben Genombytes. Der Kern bekommt den Digest als Funktion. Bei gleichem Hash vergleicht er Modellvertrag und tatsächliche Werte.
- Aus Masterseed, Domäne, Generation, Zielslot und Szenario entstehen die Zufallsströme. `scenarioSet` leitet Szenarioseeds aus Masterseed, Segment und Szenarioindex ab. Trainingsepisoden eines Segments verwenden einen gemeinsamen geordneten Szenariensatz. Das Erzeugen einer neuen `Evolution` beginnt einen neuen Vergleichsabschnitt. Getrennte Validation-/Test-Szenarien lassen sich mit `evaluate` fahren.
- `initialPopulation` verwendet die vorhandene Brain-Initialisierung. `reproduce` nimmt zuerst Eliten, dann reguläre Kinder und am Ende die vorgesehenen Immigrants auf. Die Mutation zieht zunächst sämtliche Bernoulli-Auswahlen, dann gegebenenfalls die Mindestauswahl und schließlich je gewähltem Index den Mischungs-Draw und zwei Box-Muller-Draws.
- `Evolution.collect` liefert Identität und Ergebnis pro Slot und Szenario. Ein ausdrücklich als temporär klassifizierter Infrastrukturfehler erhält höchstens einen frischen Versuch. `commit` ordnet alle Ergebnisse kanonisch, validiert ihre Vollständigkeit, berechnet Statistiken und erzeugt die gesamte nächste Population vor der Veröffentlichung. Der letzte Budgetschritt veröffentlicht das Ergebnis mit leerer Folgepopulation. Ein Fehler lässt den letzten bestätigten Snapshot zugreifbar.
- `snapshot` enthält Historienindex, Generationsergebnis, GenerationBest, Champion und Folgepopulation. `history` behält kompakte Ergebnis- und Abstammungsdaten bis zum Laufende. Ein ausgewählter Trace begrenzt Fahrproben, Mutationsdetails und Einträge zur Herkunft einzelner Parameter. Bei aktivierter Vererbungsspur entspricht Index i in `parentByIndex` dem Parameter i. Die Genome früherer Generationen werden nur als aktuelles Mitglied oder als aktuell gehaltenes Bestmodell weitergeführt.

## Benchmarks wiederholen

Die Suiten `components`, `world`, `scale` und `endurance` schreiben jeweils eine neue JSON-Datei. Für den gepaarten Vergleich benötigt `world` einen Checkout der unveränderten Basis `61cd54a`. Ein bereits vorhandener Ausgabepfad führt zu einem Fehler.

```sh
node scripts/benchmark-evolution.mjs world .npm-cache/world-01.json /path/to/arena-02a-checkout
node scripts/benchmark-evolution.mjs parity .npm-cache/parity-01.json /path/to/arena-02a-checkout
node scripts/benchmark-evolution.mjs components .npm-cache/components-01.json
node scripts/benchmark-evolution.mjs scale .npm-cache/scale-01.json
node --expose-gc scripts/benchmark-evolution.mjs endurance .npm-cache/endurance-01.json
```

Die Größenmatrix verwendet für vollständige große Populationen offen ausgewiesene Sechs-Tick-Aufgaben. Der normale Episodentest und der vollständige Referenzlauf verwenden die regulären Zeitgrenzen. Der Dauerlauf prüft drei Wiederholungen mit jeweils 200 Generationen. Seine Stichproben zählen vom veröffentlichten Zustand erreichbare Genome und Welten. Heap, RSS und das lebenslange Prozessmaximum haben jeweils eine eigene Bedeutung.

Für den zusätzlichen Laufzeitvergleich erzeugt `node scripts/verify-evolution-runtimes.mjs` eine lokale Prüffassung im ignorierten npm-Cache. Bei laufendem Vite-Server zeigt `/.npm-cache/evolution-runtime/compare.html` die Abweichungen gegenüber Node für dieselbe echte 600-Tick-Episode, ihre Mutationen, Beobachtungen und Aktivierungen. Die Webanwendung importiert die Prüffassung und den Trainingsrunner nicht.
