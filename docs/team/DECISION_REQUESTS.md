## Entscheidungen

### DR-02B-001 · FIT-001 / EV-003 · entschieden am 27.11.2026

Reproduktion auf `0da4604`: Bei N = 9.007.199.254.740.991, S = 0, L = N−3 bzw. N−2, A = 1, P = K = L/N und fehlerfreier Balanced-Fahrt liefert JavaScript für beide Stufen denselben Float64-Gesamtwert. Die Schrittweite der Darstellung übersteigt dort den rechnerischen Abstand einiger benachbarter Stufen.

A wurde die Wahl zwischen einer begrenzten Rundenzahl, einer erweiterten Vergleichsdarstellung und einer offenen Einschränkung vorgelegt. Der Auftraggeber delegierte die Entscheidung ausdrücklich. B setzt den vorgeschlagenen Bereich 1–1.000.000 für Aufgabenvertrag, Ledger und Fitness-API ein. Beim größten Erfolg bleibt F unter 2,21 Milliarden. Die Float64-Schrittweite beträgt dort weniger als 0,000001 gegenüber dem garantierten Stufenabstand von mindestens 100. Größere Aufgaben werden vor der Auswertung abgewiesen. Referenzlauf, Gewichte und Formel bleiben identisch. Die Entscheidung präzisiert D10.4.1 und D10.6.1 gegenüber den unveränderten Paketoriginalen.

25.11.2026 · PRE-01 · Entschieden durch A und B. Gemeinsame D00/G07-Abnahme und Freigabe von Batch 02A laut Rückmeldung im Übergabelog.

### FI-003 · Anschluss unter der Fahrzeugnase · entschieden am 25.11.2026

Auf der Mittellinie liegt der lokale Anker 2,20 m hinter dem Frontsensor. Eine strikte Front-Halbraumprüfung schon am Anker würde auch auf der freien Geraden sämtliche Vorschaupunkte verwerfen. Der Auftraggeber delegierte die Entscheidung zur lokalen Verbindung ausdrücklich an die Umsetzung. Der Anschluss darf innerhalb der eigenen nachgewiesenen Fahrzeugkontur liegen und muss sowohl vom lokalen Ursprung als auch von der Frontmitte frei von Verdeckung sein. Jeder ausgegebene Punkt muss separat die frontale Sicht- und Reichweitenprüfung bestehen. Die Sichtbeweise für den übrigen Verlauf bleiben erforderlich. Umsetzung und Messbasis: `b1995a3`.
