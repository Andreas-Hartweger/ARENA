# Aufgaben und Abhängigkeiten

| ID | Paket | Voraussetzung | Lieferergebnis | Testgruppen |
|---|---|---|---|---|
| PRE-B01 | Basis und 02A Review | — | Read-only Review der relevanten Verträge, main SHA, npm ci/check/calibrate; 02A 160 Tests baseline; gemeinsames A/B Review bzw. explizite Ausnahme vor 02B-Code. | REG, REL |
| EV-001 | Teamworkflow | PRE-B01 | Scoped AGENTS-Ausnahme, Queue, Fortschritt, Decision Requests, Handover; nur bestätigter Scope. | REL |
| EV-002 | Bewertungsfeed | EV-001 | Akzeptierte Travel-/Tor-/Kontaktfakten atomar; Physik/AI unverändert. | PRG, PEN, REG |
| EV-003 | Fitness & Ledger | EV-002 | Formeln, Profile, Fortschritt, Zeit/Fehlerkomponenten, Rohdaten. | FIT, PRG, PEN |
| EV-004 | Episode Evaluator | EV-003 | Unabhängige Welten, Abbruch, Szenariokontrakt, Ergebnisunion. | EPS, REG |
| EV-005 | Seed & Genome | EV-001 | FNV/Mulberry/Box-Muller; immutable kompatible Genome/IDs. | RNG, GEN |
| EV-006 | Selektion & Kreuzung | EV-005 | Tournament, Eliten, tie, Elternpool, zwei Crossover-Operatoren. | SEL, CRX |
| EV-007 | Mutation | EV-005 | Gauß, Faktoren, Grenzen, Mindestauswahl, Diagnose. | MUT |
| EV-008 | Population | EV-006, EV-007 | Initialisierung, Seeded Start, Budget, Champion, History. | POP, GEN |
| EV-009 | Diversity & Adaption | EV-008 | Varianz, Stagnation, adaptive Regeln, Immigrants/Rescue. | DIV, ADP |
| EV-010 | Koordinator | EV-004, EV-009 | Vollständige atomare Generationen, Fehler/Retry, interner Runner. | EVO, EPS, RNG |
| EV-011 | Diagnose | EV-010 | Snapshot, Statistiken, selektive Traces; kein UI-Ausbau. | DIA |
| EV-012 | Systemtests & Benchmarks | EV-011 | Alle Tests, Referenzlauf, Regression, Kalibrierung, Messmatrix. | alle, PERF |
| EV-013 | Abschluss / Übergabe | EV-012 | Bericht, Evidence, Matrix, PR/CI, unabhängiger Review, kein Auto-Merge. | REL |

B implementiert; A prüft. Unabhängige Aufgaben nach Gate parallel logisch möglich, ein Git-Writer. Keine 02C-Codefreigabe. Status und SHA in Queue/Progress pflegen. Technische Abweichungen dokumentieren. Jede Aufgabe hat vollständige zugehörige Tests, keine Tests als bestanden ohne Ausführung.
