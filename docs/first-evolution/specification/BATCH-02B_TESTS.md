# Test- und Abnahmekatalog · 128 Prüfpunkte

Alle offen. IDs sind Abnahmepunkte, nicht zwingend jeweils nur ein Vitest-Test. Referenzwerte unabhängig von Produktionscode berechnen; bestehende Tests nicht abschwächen. Statistik-Stichproben vorab fixieren; keine flaky unseeded Tests.

| ID | Gruppe | Fall | Erwartung | Status |
|---|---|---|---|---|
| FIT-001 | FIT | Hierarchie | N=1,2,10; Randwerte R=0/1000; jede höhere Stufe > niedrigere; S=1 nur L=N. | Offen |
| FIT-002 | FIT | Detailformel | Vergleiche reference_vectors.json für 4 Fälle × 3 Profile, abs 1e-9; R in [0,1000]. | Offen |
| FIT-003 | FIT | Nullfortschritt | P=A=K=0, keine Bewegung, F=0 unabhängig von Fehlerfreiheit. | Offen |
| FIT-004 | FIT | Zeit | t=0,40,120; T=1,2/3,0; unvollständig gleicher P bei verschiedenen Zeiten gleiches T. | Offen |
| FIT-005 | FIT | Profile | Gewichte exakt wie Tabelle, Summe 1; gleicher erfolgreicher Fahrer mit Fehlern und Zeiten unterscheidbar. | Offen |
| FIT-006 | FIT | Custom | Negative, NaN, Inf, Summe0 ablehnen; sehr große endliche Werte stabil normalisieren; Nulloption erlaubt. | Offen |
| FIT-007 | FIT | Protected rules | Custom kann weder ungültige Tore noch externe Reset-/Fehlerauswertung gültig machen. | Offen |
| FIT-008 | FIT | Aggregation | Gleiche Szenarien in anderer Reihenfolge, kanonischer gleicher Score; fehlendes Pflichtresultat blockiert; Validation getrennt. | Offen |
| FIT-009 | FIT | Saturation | Fehlerbelastung >1 clamp, Rohwert bleibt erhalten; bekannte Grenzen reporten. | Offen |
| PRG-001 | PRG | Start | Standardstart 8m hinter Linie; 0/4/8m -> A=0/.5/1; Starttor öffnet, L=0. | Offen |
| PRG-002 | PRG | Highwater | 100→60→100→120m akzeptiert: H=100,100,100,120; nur 20 neu. | Offen |
| PRG-003 | PRG | Checkpoint | Mehrfaches Tor, falsche Reihenfolge, rückwärts, außerhalb Torbreite: kein Mehrfachbonus, Invalidierung gemäß progress.ts. | Offen |
| PRG-004 | PRG | Lap | Alle 7 Zwischentore und gerichtetes Start/Ziel; L=1, p=0; erster Start nicht als Runde. | Offen |
| PRG-005 | PRG | Multi-lap | N=3, L=1, p=l/2 ergibt P=.5; Promotion zählt p nicht doppelt. | Offen |
| PRG-006 | PRG | Invalidation | Rechtmäßig erworbener p/K bleibt, ungültige Fortsetzung bringt nichts; neu eröffneter Ordinal kein erneuter Bonus. | Offen |
| PRG-007 | PRG | Correction | Kollisionsteleport/Korrektur ohne Travel 0 Kredit, nächster Travel zählt nur eigenes Delta. | Offen |
| PRG-008 | PRG | Shortcuts | Infield, runoff, skipped gates, seam wrap, Grenztoleranz; nur vorhandene Validierungsregeln, keine Ideal-Linie. | Offen |
| PRG-009 | PRG | Accepted movement | Verworfener Solver-Substep kein Tor/Kredit; akkumulierter H bleibt monoton. | Offen |
| PRG-010 | PRG | Recovery | Rangieren und erneutes Überfahren alten Fortschritts kein Bonus; nach H-Zuwachs Diagnose. | Offen |
| PRG-011 | PRG | Reverse | Rückwärtsgang in Rennrichtung nicht gleich falsche Richtung; keine heimliche neue Rennregel. | Offen |
| PRG-012 | PRG | Terminal order | Mehrere Ereignisse im Tick chronologisch; Zielabschluss nur mit gültigem Tor, restliche Bewegung nicht werten. | Offen |
| PEN-001 | PEN | Normal speed | vn 0/1/5/10/15/30: .05/.052/.10/.25/.5/.5 je bestätigtem Kontakt. | Offen |
| PEN-002 | PEN | Contact grouping | Lücke <.25s gleicher Cluster, =.25s neu; mehrere Segmente/Iterationskontakte kein doppelter Zeitanteil. | Offen |
| PEN-003 | PEN | Contact duration | 2 s akzeptierter Kontakt + max 5m/s => .12; HUD event filter nicht als Quelle für leichte Kontakte. | Offen |
| PEN-004 | PEN | Rollback | Verworfene Substeps liefern weder Kontakt noch Zeit; bestehendes CollisionEvent unverändert. | Offen |
| PEN-005 | PEN | Grass | Eine Achse 2s .05, beide 2s .1, beide 20s 1; Material aus Physiktick. | Offen |
| PEN-006 | PEN | Idle | 179/180/181 Ticks unter .5m/s => 0/0/1 Tick Strafe; Bewegung setzt zusammenhängende Dauer zurück. | Offen |
| PEN-007 | PEN | Wrong way | 119/120/121 Ticks v_t<-1 => 0/0/1; genau -1 keine Strafe; Reverse-Flag nicht Ersatz. | Offen |
| PEN-008 | PEN | Slip | 30/31 Ticks mit |v|>=5, slip>35°, Anteil<.25; nur 1 Tick jenseits Toleranz; schnelle kontrollierte Kurve negativ getestet. | Offen |
| PEN-009 | PEN | Steering | Fenster >4,>4,>4 zählt 3; allein >4 zählt 0; =4 zählt 0; Teilfenster keine volle Strafe. | Offen |
| PEN-010 | PEN | Time clipping | Interpolierter Zielzeitpunkt: Kontaktzeit und Zeitstrafen danach nicht zählen; end-of-tick Näherung dokumentiert. | Offen |
| PEN-011 | PEN | No double credit | Recovery/Grip/hohe Querbeschleunigung nicht automatisch Bonus oder Fehler. | Offen |
| PEN-012 | PEN | Raw metrics | Sättigungen und getrennte Fehler-/Zeitwerte auch über clamp hinaus sichtbar. | Offen |
| EPS-001 | EPS | Start state | Frische Welt je Episode; StartGrid 1, leerer AI-State, neutral, 30/30 Hz; andere Kandidaten unsichtbar. | Offen |
| EPS-002 | EPS | Grace | 300 Ticks; H-Anker danach; Stillstand endet Tick1200. | Offen |
| EPS-003 | EPS | Renewal | 1.999m erneuert nicht, 2m erneuert; kumulierte kleine Schritte; kein Reset durch Kollision. | Offen |
| EPS-004 | EPS | Limit | 7200 Ticks max; Erfolg am Grenztick vor Limit, Timeout vor noProgress wenn beide ohne Erfolg. | Offen |
| EPS-005 | EPS | Success | Eine Runde sofort Ende, keine extra Runde; korrekte interpolierte Zeit. | Offen |
| EPS-006 | EPS | Collision | Kontakt/Fallback nicht automatisch technischer Fehler; schlechte Fahrt gültig bewertet. | Offen |
| EPS-007 | EPS | Cancel | Externes Stop/Reset kein selektionsfähiger Score. | Offen |
| EPS-008 | EPS | Fault | NaN/Modellfehler/Weltfehler ohne Score, Ursache, Seed, Tick; andere Kandidaten isoliert. | Offen |
| EPS-009 | EPS | Retry | Nur nachweislich temporärer Infrastrukturfehler 1 Retry aus frischem Start; kein Retry bei schlechter Fahrt. | Offen |
| EPS-010 | EPS | Multi-scenario | Gleicher Vertrag und Szenarioreihenfolge; Pflichtfehler blockiert; unterschiedliche Profile nicht ungeprüft aggregieren. | Offen |
| RNG-001 | RNG | Mulberry | Seeds 0,1,42,2^32−1 exakt 8 U-Werte und Zustand aus Referenz. | Offen |
| RNG-002 | RNG | FNV | Alle 5 Ableitungsvektoren exakt; ungültige Master/Positionen ablehnen. | Offen |
| RNG-003 | RNG | Box-Muller | 8 Draws -> 4 Z, abs 1e-12; U1=0 sichere Behandlung; keine versteckte Cache-Reihenfolge. | Offen |
| RNG-004 | RNG | Integer draw | Stub erzwingt rejection am Limit; k=1 kein Draw; uniform ohne Modulo-Bias. | Offen |
| RNG-005 | RNG | Separate streams | Extra Diagnose-, Crossover- oder Init-Draw verändert keinen anderen Domain-Seed. | Offen |
| RNG-006 | RNG | Canonical order | Gleicher Run mit umgekehrter Resultatreihenfolge -> gleiche nächste Genome und Ranking. | Offen |
| RNG-007 | RNG | Retry reproducibility | Fehler nach Teilstaging, erneute Transaktion reproduziert gleiche Population; kein RNG-Drift. | Offen |
| RNG-008 | RNG | Cross runtime | Node/Browser auf verfügbarem Referenzlauf Vergleich numerischer Diffs, keine falsche Bitgleichheitsbehauptung. | Offen |
| GEN-001 | GEN | Layout | 8547, 68376 Bytes; Indexgrenzen je Layer, Biasblock; andere erlaubte hidden sizes. | Offen |
| GEN-002 | GEN | Immutable | Parent/Brain.parameters()/exported copy verändern ohne Effekt auf Original. | Offen |
| GEN-003 | GEN | Compatibility | Falsche signature, dimensions, activation, layout, length, NaN/Inf ablehnen. | Offen |
| GEN-004 | GEN | Hash | Kanonisches little-endian Float64, -0/+0 gleich; Hashkollision simulieren und Bytes vergleichen. | Offen |
| GEN-005 | GEN | Identity | Elite gleiche Ursprungs-ID, neue Mitgliedschaft/Ergebnis; Kind neue ID mit Eltern; Immigrant ohne Eltern. | Offen |
| GEN-006 | GEN | Import limits | Gewicht >8/Bias >4 im Standard ablehnen, nicht clippen; enge Initgrenzen ablehnen. | Offen |
| POP-001 | POP | Population size | 8,128,1024 gültig; 7,1025,Bruch ungültig; niemals Wachstum. | Offen |
| POP-002 | POP | Independent init | G0 Seed42 wiederholt bytegleich; Seed0 gültig; D09-init inklusive Nullbias. | Offen |
| POP-003 | POP | Seeded | 128=1 exakt+32 random+95 mutation; andere Größen/Rundung und Randquoten; Original unverändert. | Offen |
| POP-004 | POP | Budget | 100 bewertete Generationen G0..99, exakt 12800 reguläre Einzelresultate; keine G100-Produktion. | Offen |
| POP-005 | POP | Budget remainder | Budget < nächste vollständige Gruppe -> vorher stoppen; keine Teilgeneration commit. | Offen |
| POP-006 | POP | Champion | Gleichstand behält Champion, bessere Fitness aktualisiert; anderer Vertrag getrennt. | Offen |
| POP-007 | POP | Retention | Historische kompakte Daten, nicht alle Genomarrays halten; Trace selected only. | Offen |
| SEL-001 | SEL | Elite count | n128=.05 ->6, n8=.01->1; Rundung half up; mindestens Platz für neues Kind. | Offen |
| SEL-002 | SEL | Dedupe | Bestes zuerst, unterschiedliche Elitegenome bevorzugen, fehlende Plätze mit Duplikaten. | Offen |
| SEL-003 | SEL | Pool | Top 25/100 %, effektives k<=pool; 1 direkt; keine ungültige Fitness. | Offen |
| SEL-004 | SEL | Tournament | Stubs Ziehung ohne Zurücklegen; Sieger exakte Fitness; bei k=pool immer bestes. | Offen |
| SEL-005 | SEL | Distribution | 8 eindeutige Ränge,k3, 100000 Turniere: theoretisch P(rank r)=C(8-r,2)/C(8,3), Toleranz .01 absolut; unmögliche Ränge exakt 0. | Offen |
| SEL-006 | SEL | Tie | Gleiche Fitness, deterministische Fisher-Yates-Reihenfolge; Resultatordnung egal. | Offen |
| CRX-001 | CRX | Uniform | Stub 0/.9 abwechselnd: jeder Wert von erwartetem Elternteil, Eltern unverändert. | Offen |
| CRX-002 | CRX | Neuronwise | Alle eingehenden Gewichte + separater Biasindex gemeinsam kopiert; Ausgabe ebenfalls. | Offen |
| CRX-003 | CRX | Second parent | Identische Genominhalte ausgeschlossen trotz unterschiedlicher IDs; sonst Fallback markiert. | Offen |
| CRX-004 | CRX | Contract | Inkompatible Eltern ablehnen; Cross p0/1; reguläre Nachkommen anschließend Mutation, keine Elite. | Offen |
| CRX-005 | CRX | Protection | Voller Schichtschutz kopiert A, global fixierte Bytes in Population; inkompatible Immigration ablehnen. | Offen |
| MUT-001 | MUT | Zero / full | p=0 keine Änderungen/Draws; p=1 alle eligible ausgewählt, nicht zwingend verändert. | Offen |
| MUT-002 | MUT | Minimum | Stub alle Bernoulli miss, positive p -> genau eine eligible; alle gesperrt -> keine. | Offen |
| MUT-003 | MUT | Layer scale | 3 Referenz-Sigmas, ReLU/Leaky und linear output; absolute Mode exakt. | Offen |
| MUT-004 | MUT | Bias | Nullbias kann mutieren, Faktor0 nie geändert; Faktoren kombiniert und clamp p<=1. | Offen |
| MUT-005 | MUT | Large mix | Stub normal/large, 5x sigma; q=0/1 Grenztest intern, öffentliche q>0.3 ablehnen. | Offen |
| MUT-006 | MUT | Clip | ±8/±4, clipped count, nichtendliches Zwischenresultat abgelehnt; Parent unverändert. | Offen |
| MUT-007 | MUT | Stats | Selected != changed bei Clipping/Delta0; Layer und Typ Summen stimmen. | Offen |
| MUT-008 | MUT | Distribution | 200000 unabhängige U/Z aus fixierten Seeds: Z mean abs<=.015, variance .97..1.03, |Z|<=1 Anteil .67.. .70. | Offen |
| MUT-009 | MUT | Bernoulli | 200000 eligible draws p=.05 Anteil .047.. .053; q=.05 separate 200000 Large-Draws analog. | Offen |
| MUT-010 | MUT | Frozen | p/stärke Faktor0 auch bei Mindestauswahl unangetastet; Crossover-Schutz separat. | Offen |
| DIV-001 | DIV | Exact duplicates | Hash + Bytes; n−unique, identische Genome D²=0. | Offen |
| DIV-002 | DIV | Reference | Normierte Genome [0,0],[2,4] D²=10; Welford vs alle Paarwerte für kleine deterministische Population, abs1e-10. | Offen |
| DIV-003 | DIV | Layerwise | Verschiedene Layer-Skalen, Bias gleich; D² vs D getrennt; keine Prozentanzeige für Distanz. | Offen |
| DIV-004 | DIV | Complexity | 1024 Standard/Teilset max Architektur, kein O(n²*d) Pairloop; Diagnose ohne Selektionseffekt. | Offen |
| ADP-001 | ADP | Reference | G0 count0; 14 kein Trigger, 15 einmal, 16 keiner. | Offen |
| ADP-002 | ADP | Cumulative | 0.4+0.4+0.2 Fitnesszuwachs >=1 (mit exakt darstellbaren Fixturewerten .25+.25+.5 testen) -> Reset; Champion jede Verbesserung. | Offen |
| ADP-003 | ADP | Alternation | 15 p=.075,30 alpha=.30,45 p=.1125; bis 120 p=.2 alpha=.8, danach stabil. | Offen |
| ADP-004 | ADP | Single mode | Nur p oder alpha aktiviert, anderes unverändert; absolute Mode adaptive alpha abgelehnt. | Offen |
| ADP-005 | ADP | Limits | p=0 bleibt aus; Startwert über adaptivem Cap ablehnen; frozen nicht umgehen. | Offen |
| ADP-006 | ADP | Immigrants | n128 E6 r=.05 I6; r=.25 I32; n8 rounding; mindestens ein Nachkomme. | Offen |
| ADP-007 | ADP | Rescue | count44/45/46/90 -> normal/19/normal/19 bei r=.05; Verbesserung Reset; Eliten geschützt. | Offen |
| ADP-008 | ADP | Disabled | Referenz p=.05 alpha=.2 I0 auch bei 1000 stagnierenden Generationen; Diagnose aktiv. | Offen |
| ADP-009 | ADP | Contracts | Profil/Szenariowechsel neuer Abschnitt, kein alter Stagnationswert/Championvergleich. | Offen |
| EVO-001 | EVO | Complete generation | Kleine deterministische Population, G0→G1, exakt n, gültige Fitness aller; künstliche Landscape/Fixture. | Offen |
| EVO-002 | EVO | Invalid results | Missing/duplicate/unknown candidate, stale generation, wrong contract/genome -> blockiert. | Offen |
| EVO-003 | EVO | Atomic failure | Fehler bei Slot127, bisherige Population/Champion/History/adaptive State unverändert. | Offen |
| EVO-004 | EVO | Reorder | Forward/reverse/shuffled completion order -> identische Genomhashes und Selektion. | Offen |
| EVO-005 | EVO | Retry | Temporärer Fehler max einmal; bleibender Fehler blockiert; kein stiller Pooldrop. | Offen |
| EVO-006 | EVO | Elite invariant | Unter identischem deterministischem Vertrag bester Elitewert nicht sinkend. | Offen |
| EVO-007 | EVO | Full reference | G0..G99 mit 128 echten From-Scratch Academy/GT-01 Episoden, 12800 gültige Resultate, Bericht inkl. tatsächlichem Lernverlauf, keine Runde als Pflicht. | Offen |
| EVO-008 | EVO | Baseline fixture | Unselektierte Zufallssuche gleicher Auswertungsanzahl als reproduzierbarer Vergleichsrunner; volle wissenschaftliche Lernvergleiche 02D. | Offen |
| EVO-009 | EVO | No leakage | Privilegierte Daten/Trace nicht in Beobachtung; 248 Kanäle unverändert. | Offen |
| DIA-001 | DIA | Quantiles | Fitness [1,2,3,4] -> mean2.5 median2.5 Q1=1.75 Q3=3.25. | Offen |
| DIA-002 | DIA | Missing laps | Keine gültige Runde -> null/leer, keine Nullzeit; Abschlussgründe korrekt. | Offen |
| DIA-003 | DIA | Snapshots | Mutationsversuch an veröffentlichter Diagnose beeinflusst keinen Kern. | Offen |
| DIA-004 | DIA | Trace invariance | Trace off/on/toggle identische Genome, Fitness und Generationen. | Offen |
| DIA-005 | DIA | Budgeted trace | Nur gewählte Kandidaten detailliert; Speicherbudget und eventuelle Kürzung kenntlich. | Offen |
| DIA-006 | DIA | Provenance | Eltern/Operator/Mutationstyp/Clip/Adaptionsgrund, echte Daten; keine vorgetäuschte UI. | Offen |
| DIA-007 | DIA | Timing separate | Wallclock/RAM ändern nie Fitness oder Ranking. | Offen |
| REG-001 | REG | Baseline | npm ci, npm run check (typecheck lint format test build), npm run calibrate; 160 bestehende Tests mindestens erhalten. | Offen |
| REG-002 | REG | Physics | Kalibrierwerte unverändert; deterministische menschliche Frames gegen Basis, Feed aus/an; keine HUD-Änderung. | Offen |
| REG-003 | REG | AI | Bestehende 02A Sichtschutz/Registry/Driver/Inspector Tests, trace aus/an; keine neue Eingabe. | Offen |
| REG-004 | REG | World atomicity | Welt-Tick Fehler, kein Teilframe oder passiver Bewertungsfeed publiziert. | Offen |
| REG-005 | REG | Browser | Mensch/KI Testmodus, Pause/Step/Kamera/Inspector, keine JS-Fehler; keine neue Trainings-UI. | Offen |
| REG-006 | REG | Isolation | Unabhängige Kandidaten getrennte Welten/Brainzustände, Reihenfolge egal. | Offen |
| PERF-001 | PERF | Components | Messmatrix Fitness, RNG, Mutation, Cross, Selektion, Hash, Diversity, Generation; Warmup und >=3 Wiederholungen. | Offen |
| PERF-002 | PERF | Episode | Gleiche Seeds/Modelle/30Hz; 02A Feed off/on gepaart, Trace off/on; Fahrzeugticks/s, Eval/s. | Offen |
| PERF-003 | PERF | Scale | n8,32,128,512,1024; klein/standard/groß, Maxarch repräsentativ; funktionaler Maximaltest. | Offen |
| PERF-004 | PERF | Memory | Mindestens 200 kleine vollständige Generationen, kompakte History erwartet; heap/RSS, Live-Genomzahl, keine ungewollte Trace-/World-Retention. | Offen |
| PERF-005 | PERF | Regression | Gepaarte Durchsatz-/Speicherwerte mit Hardware/Runtime/Commit; >15% Medianverlust untersuchen, kein hardwareübergreifender starrer CI-Gate. | Offen |
| REL-001 | REL | Traceability | Alle 103 IDs in Matrix; jede Scope-Anforderung/Test/Ergebnis mit SHA; spätere Ziele als deferred. | Offen |
| REL-002 | REL | Workflow | Queue/Handover/Decision Requests, scoped Branch/PR/CI, keine fremden Änderungen, keine neue Dependency. | Offen |
| REL-003 | REL | Independent gate | Bericht, reproduzierbare Evidenz, unabhängiger A/B Review, ausdrückliche Merge-Freigabe; 02C nicht starten. | Offen |
