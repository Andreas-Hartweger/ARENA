# Kontinuität bei Entwicklung und Training

- **TR-01** A entscheidet über Änderungen bestätigter Funktionen, mathematischer Verträge und Abnahmepunkte. Technische Optimierungen brauchen einen Vergleich mit der Referenz.
- **TR-02** Der freigegebene Hauptauftrag und der dokumentierte Arbeitsstand gelten während zusätzlicher Erklärungen, Vorführungen und Testfahrten weiter.
- **TR-03** Nebenaufgaben verwenden lesende Snapshots, kopierte Modelle, eigene Prozesse und getrennte Speicherorte.
- **TR-04** Vor riskanten Eingriffen den letzten verifizierten Stand sichern. Laufende Trainings und fremde Prozesse schützen. Den tatsächlich vorhandenen Speicherstand dokumentieren.
- **TR-05** Der Hauptauftrag hat Vorrang bei CPU und RAM. Nebenaufgaben erhalten ein begrenztes Budget oder warten auf eine sichere Grenze.
- **TR-06** Nach einer Nebenaufgabe am dokumentierten Arbeitspaket fortsetzen. Befehle, Ergebnisse und bestätigte Generation festhalten.
- **TR-07** Fehler beheben oder mit Belegen melden. Abnahmebedingungen erhalten und das unabhängige Review gesondert ausweisen.
- **TR-08** Erfordert ein Konflikt eine Produktentscheidung, ID, Reproduktion, Ursache, Optionen, Empfehlung, Auswirkung und Commit in den Decision Requests dokumentieren. Unabhängige freigegebene Arbeit fortsetzen. Bei ernstem Fehler den betroffenen Vorgang sicher anhalten.

[Bestätigter Originalvertrag](../training-management/specification/DEVELOPMENT_CONTINUITY_CONTRACT.md)

## Teststrategie für Batch 02C

Während der Entwicklung prüfen kurze Funktionsfälle gezielt den geänderten Pfad und seine Grenzen. Für die Endabnahme werden vorhandene Belege anhand von Quellstand, Laufvertrag, Arbeitsmenge, Runtime und Änderungen seit der Messung zugeordnet. Ein reiner Dokumentations- oder Auswertungswechsel erfordert keine neue Simulation. Berühren Änderungen Physik, Seedfolge, Worker-Zuteilung, Persistenz oder Ressourcenverhalten, wird der davon betroffene Beleg erneut geprüft.

Für einen freigegebenen zweistündigen Headless-Abnahmelauf genügt ein vollständiger Lauf am geprüften Stand. Eine Wiederholung braucht eine Änderung, die den bisherigen Nachweis entwertet. Währenddessen können unabhängige Reviews, Dokumentation und ressourcenschonende Prüfungen weiterlaufen. Für 02C hat A den Headless-Prüfpunkt nach Abbruch geschlossen. [Decision Request und Ergebnis](DECISION_REQUESTS.md)
