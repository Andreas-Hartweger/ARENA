# Beobachtungsschema – D09.2 / TF-08–09

`arena.observation.standard.v1` (ID-Vorschlag). Ein Float64-Eingabevektor mit exakt 248 Werten. Index beginnt bei 0. CSV und Tabelle sind dieselbe geordnete Liste. Rohwerte SI; positive norm = clamp(raw/max,0,1); signed norm = clamp(raw/max,-1,1) für symmetrische Grenzen; bool exakt 0/1; direction exakt -1/+1; sin/cos bereits normiert, finite prüfen. Vor Skalierung/Maskierung mathematisch fehlerhafte Werte zurückweisen (kein NaN/Inf im Vektor). Fehlende Messung durch explizit fehlendes Rohfeld/valid=0 darstellen; normalisierter abhängiger Wert exakt +0, auch sin/cos. Valid=1 am tatsächlichen Nullabstand. Bit und One-Hot strikt validieren. Endliche Sättigung diagnostizierbar; keine Veränderung physikalischer Zustände.

Lokale x/y +vorne/+links, relative heading = heading_target−heading_ego; geometrischer Lenkwinkel positiv links (Output dagegen rechts positiv). Gültige Material-One-Hot exakt ein Bit. Ego direction tatsächliche eingelegte Richtung, nicht Adapter-Anforderung. Für Vorschau sind Position/heading/curvature getrennt gültig; wenn Position invalid, beide anderen ebenfalls invalid. Für nicht belegte Slots alle 8 Null. Keine beliebigen Reserveplätze.

Kompatibilität: kanonische, deterministisch serialisierte Beschreibung aller geordneten Kanal-IDs, Typen, Einheiten, Skalierungen, Masken, Profilgeometrie, Frequenzen, Vorschau-/Objektsemantik und Steuer-/Architekturversion. Keine Abhängigkeit von zufälliger Objekt-Key-Reihenfolge. Signatur (z.B. SHA-256 über kanonisches UTF-8; browser/headless identische Berechnung, keine neue Dependency) plus vollständige Strukturprüfung; nicht Hash allein als Validierung. Änderung relevant → neue Version/Signatur; bestehendes Modell ablehnen, nicht stillschweigend umsortieren. Modell enthält kompatible Vehicle-/Setup-Kennung oder kanonische Signatur; First Launch GT-01. Dauerhafte Speicherung folgt D13. Keine ungeprüfte Übertragung auf andere Fahrzeuge.

| Index | Gruppe  | Kanal                      | Einheit |                 Min |                Max | Regel    | Maske                      |
| ----: | ------- | -------------------------- | ------- | ------------------: | -----------------: | -------- | -------------------------- |
|     0 | ego     | ego.speed                  | m/s     |                   0 |                 75 | positive |                            |
|     1 | ego     | ego.longitudinal           | m/s     |                 -75 |                 75 | signed   |                            |
|     2 | ego     | ego.lateral                | m/s     |                 -30 |                 30 | signed   |                            |
|     3 | ego     | ego.yaw_rate               | rad/s   |                  -3 |                  3 | signed   |                            |
|     4 | ego     | ego.steer_angle            | rad     | -0.5235987755982988 | 0.5235987755982988 | signed   |                            |
|     5 | ego     | ego.drive_direction        | enum    |                  -1 |                  1 | enum     |                            |
|     6 | ego     | ego.front.asphalt          | bool    |                   0 |                  1 | bit      |                            |
|     7 | ego     | ego.front.grass            | bool    |                   0 |                  1 | bit      |                            |
|     8 | ego     | ego.front.mu               | 1       |                   0 |                  2 | positive |                            |
|     9 | ego     | ego.rear.asphalt           | bool    |                   0 |                  1 | bit      |                            |
|    10 | ego     | ego.rear.grass             | bool    |                   0 |                  1 | bit      |                            |
|    11 | ego     | ego.rear.mu                | 1       |                   0 |                  2 | positive |                            |
|    12 | ray     | ray00.edge.distance        | m       |                   0 |                 75 | positive | ray00.edge.valid           |
|    13 | ray     | ray00.edge.valid           | bool    |                   0 |                  1 | bit      |                            |
|    14 | ray     | ray00.barrier.distance     | m       |                   0 |                 75 | positive | ray00.barrier.valid        |
|    15 | ray     | ray00.barrier.valid        | bool    |                   0 |                  1 | bit      |                            |
|    16 | ray     | ray00.vehicle.distance     | m       |                   0 |                 75 | positive | ray00.vehicle.valid        |
|    17 | ray     | ray00.vehicle.valid        | bool    |                   0 |                  1 | bit      |                            |
|    18 | ray     | ray00.material.asphalt     | bool    |                   0 |                  1 | bit      | ray00.material.valid       |
|    19 | ray     | ray00.material.grass       | bool    |                   0 |                  1 | bit      | ray00.material.valid       |
|    20 | ray     | ray00.material.valid       | bool    |                   0 |                  1 | bit      |                            |
|    21 | ray     | ray01.edge.distance        | m       |                   0 |                100 | positive | ray01.edge.valid           |
|    22 | ray     | ray01.edge.valid           | bool    |                   0 |                  1 | bit      |                            |
|    23 | ray     | ray01.barrier.distance     | m       |                   0 |                100 | positive | ray01.barrier.valid        |
|    24 | ray     | ray01.barrier.valid        | bool    |                   0 |                  1 | bit      |                            |
|    25 | ray     | ray01.vehicle.distance     | m       |                   0 |                100 | positive | ray01.vehicle.valid        |
|    26 | ray     | ray01.vehicle.valid        | bool    |                   0 |                  1 | bit      |                            |
|    27 | ray     | ray01.material.asphalt     | bool    |                   0 |                  1 | bit      | ray01.material.valid       |
|    28 | ray     | ray01.material.grass       | bool    |                   0 |                  1 | bit      | ray01.material.valid       |
|    29 | ray     | ray01.material.valid       | bool    |                   0 |                  1 | bit      |                            |
|    30 | ray     | ray02.edge.distance        | m       |                   0 |                120 | positive | ray02.edge.valid           |
|    31 | ray     | ray02.edge.valid           | bool    |                   0 |                  1 | bit      |                            |
|    32 | ray     | ray02.barrier.distance     | m       |                   0 |                120 | positive | ray02.barrier.valid        |
|    33 | ray     | ray02.barrier.valid        | bool    |                   0 |                  1 | bit      |                            |
|    34 | ray     | ray02.vehicle.distance     | m       |                   0 |                120 | positive | ray02.vehicle.valid        |
|    35 | ray     | ray02.vehicle.valid        | bool    |                   0 |                  1 | bit      |                            |
|    36 | ray     | ray02.material.asphalt     | bool    |                   0 |                  1 | bit      | ray02.material.valid       |
|    37 | ray     | ray02.material.grass       | bool    |                   0 |                  1 | bit      | ray02.material.valid       |
|    38 | ray     | ray02.material.valid       | bool    |                   0 |                  1 | bit      |                            |
|    39 | ray     | ray03.edge.distance        | m       |                   0 |                120 | positive | ray03.edge.valid           |
|    40 | ray     | ray03.edge.valid           | bool    |                   0 |                  1 | bit      |                            |
|    41 | ray     | ray03.barrier.distance     | m       |                   0 |                120 | positive | ray03.barrier.valid        |
|    42 | ray     | ray03.barrier.valid        | bool    |                   0 |                  1 | bit      |                            |
|    43 | ray     | ray03.vehicle.distance     | m       |                   0 |                120 | positive | ray03.vehicle.valid        |
|    44 | ray     | ray03.vehicle.valid        | bool    |                   0 |                  1 | bit      |                            |
|    45 | ray     | ray03.material.asphalt     | bool    |                   0 |                  1 | bit      | ray03.material.valid       |
|    46 | ray     | ray03.material.grass       | bool    |                   0 |                  1 | bit      | ray03.material.valid       |
|    47 | ray     | ray03.material.valid       | bool    |                   0 |                  1 | bit      |                            |
|    48 | ray     | ray04.edge.distance        | m       |                   0 |                150 | positive | ray04.edge.valid           |
|    49 | ray     | ray04.edge.valid           | bool    |                   0 |                  1 | bit      |                            |
|    50 | ray     | ray04.barrier.distance     | m       |                   0 |                150 | positive | ray04.barrier.valid        |
|    51 | ray     | ray04.barrier.valid        | bool    |                   0 |                  1 | bit      |                            |
|    52 | ray     | ray04.vehicle.distance     | m       |                   0 |                150 | positive | ray04.vehicle.valid        |
|    53 | ray     | ray04.vehicle.valid        | bool    |                   0 |                  1 | bit      |                            |
|    54 | ray     | ray04.material.asphalt     | bool    |                   0 |                  1 | bit      | ray04.material.valid       |
|    55 | ray     | ray04.material.grass       | bool    |                   0 |                  1 | bit      | ray04.material.valid       |
|    56 | ray     | ray04.material.valid       | bool    |                   0 |                  1 | bit      |                            |
|    57 | ray     | ray05.edge.distance        | m       |                   0 |                150 | positive | ray05.edge.valid           |
|    58 | ray     | ray05.edge.valid           | bool    |                   0 |                  1 | bit      |                            |
|    59 | ray     | ray05.barrier.distance     | m       |                   0 |                150 | positive | ray05.barrier.valid        |
|    60 | ray     | ray05.barrier.valid        | bool    |                   0 |                  1 | bit      |                            |
|    61 | ray     | ray05.vehicle.distance     | m       |                   0 |                150 | positive | ray05.vehicle.valid        |
|    62 | ray     | ray05.vehicle.valid        | bool    |                   0 |                  1 | bit      |                            |
|    63 | ray     | ray05.material.asphalt     | bool    |                   0 |                  1 | bit      | ray05.material.valid       |
|    64 | ray     | ray05.material.grass       | bool    |                   0 |                  1 | bit      | ray05.material.valid       |
|    65 | ray     | ray05.material.valid       | bool    |                   0 |                  1 | bit      |                            |
|    66 | ray     | ray06.edge.distance        | m       |                   0 |                150 | positive | ray06.edge.valid           |
|    67 | ray     | ray06.edge.valid           | bool    |                   0 |                  1 | bit      |                            |
|    68 | ray     | ray06.barrier.distance     | m       |                   0 |                150 | positive | ray06.barrier.valid        |
|    69 | ray     | ray06.barrier.valid        | bool    |                   0 |                  1 | bit      |                            |
|    70 | ray     | ray06.vehicle.distance     | m       |                   0 |                150 | positive | ray06.vehicle.valid        |
|    71 | ray     | ray06.vehicle.valid        | bool    |                   0 |                  1 | bit      |                            |
|    72 | ray     | ray06.material.asphalt     | bool    |                   0 |                  1 | bit      | ray06.material.valid       |
|    73 | ray     | ray06.material.grass       | bool    |                   0 |                  1 | bit      | ray06.material.valid       |
|    74 | ray     | ray06.material.valid       | bool    |                   0 |                  1 | bit      |                            |
|    75 | ray     | ray07.edge.distance        | m       |                   0 |                150 | positive | ray07.edge.valid           |
|    76 | ray     | ray07.edge.valid           | bool    |                   0 |                  1 | bit      |                            |
|    77 | ray     | ray07.barrier.distance     | m       |                   0 |                150 | positive | ray07.barrier.valid        |
|    78 | ray     | ray07.barrier.valid        | bool    |                   0 |                  1 | bit      |                            |
|    79 | ray     | ray07.vehicle.distance     | m       |                   0 |                150 | positive | ray07.vehicle.valid        |
|    80 | ray     | ray07.vehicle.valid        | bool    |                   0 |                  1 | bit      |                            |
|    81 | ray     | ray07.material.asphalt     | bool    |                   0 |                  1 | bit      | ray07.material.valid       |
|    82 | ray     | ray07.material.grass       | bool    |                   0 |                  1 | bit      | ray07.material.valid       |
|    83 | ray     | ray07.material.valid       | bool    |                   0 |                  1 | bit      |                            |
|    84 | ray     | ray08.edge.distance        | m       |                   0 |                150 | positive | ray08.edge.valid           |
|    85 | ray     | ray08.edge.valid           | bool    |                   0 |                  1 | bit      |                            |
|    86 | ray     | ray08.barrier.distance     | m       |                   0 |                150 | positive | ray08.barrier.valid        |
|    87 | ray     | ray08.barrier.valid        | bool    |                   0 |                  1 | bit      |                            |
|    88 | ray     | ray08.vehicle.distance     | m       |                   0 |                150 | positive | ray08.vehicle.valid        |
|    89 | ray     | ray08.vehicle.valid        | bool    |                   0 |                  1 | bit      |                            |
|    90 | ray     | ray08.material.asphalt     | bool    |                   0 |                  1 | bit      | ray08.material.valid       |
|    91 | ray     | ray08.material.grass       | bool    |                   0 |                  1 | bit      | ray08.material.valid       |
|    92 | ray     | ray08.material.valid       | bool    |                   0 |                  1 | bit      |                            |
|    93 | ray     | ray09.edge.distance        | m       |                   0 |                120 | positive | ray09.edge.valid           |
|    94 | ray     | ray09.edge.valid           | bool    |                   0 |                  1 | bit      |                            |
|    95 | ray     | ray09.barrier.distance     | m       |                   0 |                120 | positive | ray09.barrier.valid        |
|    96 | ray     | ray09.barrier.valid        | bool    |                   0 |                  1 | bit      |                            |
|    97 | ray     | ray09.vehicle.distance     | m       |                   0 |                120 | positive | ray09.vehicle.valid        |
|    98 | ray     | ray09.vehicle.valid        | bool    |                   0 |                  1 | bit      |                            |
|    99 | ray     | ray09.material.asphalt     | bool    |                   0 |                  1 | bit      | ray09.material.valid       |
|   100 | ray     | ray09.material.grass       | bool    |                   0 |                  1 | bit      | ray09.material.valid       |
|   101 | ray     | ray09.material.valid       | bool    |                   0 |                  1 | bit      |                            |
|   102 | ray     | ray10.edge.distance        | m       |                   0 |                120 | positive | ray10.edge.valid           |
|   103 | ray     | ray10.edge.valid           | bool    |                   0 |                  1 | bit      |                            |
|   104 | ray     | ray10.barrier.distance     | m       |                   0 |                120 | positive | ray10.barrier.valid        |
|   105 | ray     | ray10.barrier.valid        | bool    |                   0 |                  1 | bit      |                            |
|   106 | ray     | ray10.vehicle.distance     | m       |                   0 |                120 | positive | ray10.vehicle.valid        |
|   107 | ray     | ray10.vehicle.valid        | bool    |                   0 |                  1 | bit      |                            |
|   108 | ray     | ray10.material.asphalt     | bool    |                   0 |                  1 | bit      | ray10.material.valid       |
|   109 | ray     | ray10.material.grass       | bool    |                   0 |                  1 | bit      | ray10.material.valid       |
|   110 | ray     | ray10.material.valid       | bool    |                   0 |                  1 | bit      |                            |
|   111 | ray     | ray11.edge.distance        | m       |                   0 |                100 | positive | ray11.edge.valid           |
|   112 | ray     | ray11.edge.valid           | bool    |                   0 |                  1 | bit      |                            |
|   113 | ray     | ray11.barrier.distance     | m       |                   0 |                100 | positive | ray11.barrier.valid        |
|   114 | ray     | ray11.barrier.valid        | bool    |                   0 |                  1 | bit      |                            |
|   115 | ray     | ray11.vehicle.distance     | m       |                   0 |                100 | positive | ray11.vehicle.valid        |
|   116 | ray     | ray11.vehicle.valid        | bool    |                   0 |                  1 | bit      |                            |
|   117 | ray     | ray11.material.asphalt     | bool    |                   0 |                  1 | bit      | ray11.material.valid       |
|   118 | ray     | ray11.material.grass       | bool    |                   0 |                  1 | bit      | ray11.material.valid       |
|   119 | ray     | ray11.material.valid       | bool    |                   0 |                  1 | bit      |                            |
|   120 | ray     | ray12.edge.distance        | m       |                   0 |                 75 | positive | ray12.edge.valid           |
|   121 | ray     | ray12.edge.valid           | bool    |                   0 |                  1 | bit      |                            |
|   122 | ray     | ray12.barrier.distance     | m       |                   0 |                 75 | positive | ray12.barrier.valid        |
|   123 | ray     | ray12.barrier.valid        | bool    |                   0 |                  1 | bit      |                            |
|   124 | ray     | ray12.vehicle.distance     | m       |                   0 |                 75 | positive | ray12.vehicle.valid        |
|   125 | ray     | ray12.vehicle.valid        | bool    |                   0 |                  1 | bit      |                            |
|   126 | ray     | ray12.material.asphalt     | bool    |                   0 |                  1 | bit      | ray12.material.valid       |
|   127 | ray     | ray12.material.grass       | bool    |                   0 |                  1 | bit      | ray12.material.valid       |
|   128 | ray     | ray12.material.valid       | bool    |                   0 |                  1 | bit      |                            |
|   129 | ray     | ray13.edge.distance        | m       |                   0 |                 60 | positive | ray13.edge.valid           |
|   130 | ray     | ray13.edge.valid           | bool    |                   0 |                  1 | bit      |                            |
|   131 | ray     | ray13.barrier.distance     | m       |                   0 |                 60 | positive | ray13.barrier.valid        |
|   132 | ray     | ray13.barrier.valid        | bool    |                   0 |                  1 | bit      |                            |
|   133 | ray     | ray13.vehicle.distance     | m       |                   0 |                 60 | positive | ray13.vehicle.valid        |
|   134 | ray     | ray13.vehicle.valid        | bool    |                   0 |                  1 | bit      |                            |
|   135 | ray     | ray13.material.asphalt     | bool    |                   0 |                  1 | bit      | ray13.material.valid       |
|   136 | ray     | ray13.material.grass       | bool    |                   0 |                  1 | bit      | ray13.material.valid       |
|   137 | ray     | ray13.material.valid       | bool    |                   0 |                  1 | bit      |                            |
|   138 | ray     | ray14.edge.distance        | m       |                   0 |                 60 | positive | ray14.edge.valid           |
|   139 | ray     | ray14.edge.valid           | bool    |                   0 |                  1 | bit      |                            |
|   140 | ray     | ray14.barrier.distance     | m       |                   0 |                 60 | positive | ray14.barrier.valid        |
|   141 | ray     | ray14.barrier.valid        | bool    |                   0 |                  1 | bit      |                            |
|   142 | ray     | ray14.vehicle.distance     | m       |                   0 |                 60 | positive | ray14.vehicle.valid        |
|   143 | ray     | ray14.vehicle.valid        | bool    |                   0 |                  1 | bit      |                            |
|   144 | ray     | ray14.material.asphalt     | bool    |                   0 |                  1 | bit      | ray14.material.valid       |
|   145 | ray     | ray14.material.grass       | bool    |                   0 |                  1 | bit      | ray14.material.valid       |
|   146 | ray     | ray14.material.valid       | bool    |                   0 |                  1 | bit      |                            |
|   147 | ray     | ray15.edge.distance        | m       |                   0 |                 60 | positive | ray15.edge.valid           |
|   148 | ray     | ray15.edge.valid           | bool    |                   0 |                  1 | bit      |                            |
|   149 | ray     | ray15.barrier.distance     | m       |                   0 |                 60 | positive | ray15.barrier.valid        |
|   150 | ray     | ray15.barrier.valid        | bool    |                   0 |                  1 | bit      |                            |
|   151 | ray     | ray15.vehicle.distance     | m       |                   0 |                 60 | positive | ray15.vehicle.valid        |
|   152 | ray     | ray15.vehicle.valid        | bool    |                   0 |                  1 | bit      |                            |
|   153 | ray     | ray15.material.asphalt     | bool    |                   0 |                  1 | bit      | ray15.material.valid       |
|   154 | ray     | ray15.material.grass       | bool    |                   0 |                  1 | bit      | ray15.material.valid       |
|   155 | ray     | ray15.material.valid       | bool    |                   0 |                  1 | bit      |                            |
|   156 | local   | local.offset               | m       |                 -12 |                 12 | signed   | local.valid                |
|   157 | local   | local.sin_heading          | 1       |                  -1 |                  1 | signed   | local.valid                |
|   158 | local   | local.cos_heading          | 1       |                  -1 |                  1 | signed   | local.valid                |
|   159 | local   | local.valid                | bool    |                   0 |                  1 | bit      |                            |
|   160 | preview | preview005.x               | m       |                -150 |                150 | signed   | preview005.position_valid  |
|   161 | preview | preview005.y               | m       |                -150 |                150 | signed   | preview005.position_valid  |
|   162 | preview | preview005.position_valid  | bool    |                   0 |                  1 | bit      |                            |
|   163 | preview | preview005.sin_heading     | 1       |                  -1 |                  1 | signed   | preview005.heading_valid   |
|   164 | preview | preview005.cos_heading     | 1       |                  -1 |                  1 | signed   | preview005.heading_valid   |
|   165 | preview | preview005.heading_valid   | bool    |                   0 |                  1 | bit      |                            |
|   166 | preview | preview005.curvature       | 1/m     |                -0.1 |                0.1 | signed   | preview005.curvature_valid |
|   167 | preview | preview005.curvature_valid | bool    |                   0 |                  1 | bit      |                            |
|   168 | preview | preview010.x               | m       |                -150 |                150 | signed   | preview010.position_valid  |
|   169 | preview | preview010.y               | m       |                -150 |                150 | signed   | preview010.position_valid  |
|   170 | preview | preview010.position_valid  | bool    |                   0 |                  1 | bit      |                            |
|   171 | preview | preview010.sin_heading     | 1       |                  -1 |                  1 | signed   | preview010.heading_valid   |
|   172 | preview | preview010.cos_heading     | 1       |                  -1 |                  1 | signed   | preview010.heading_valid   |
|   173 | preview | preview010.heading_valid   | bool    |                   0 |                  1 | bit      |                            |
|   174 | preview | preview010.curvature       | 1/m     |                -0.1 |                0.1 | signed   | preview010.curvature_valid |
|   175 | preview | preview010.curvature_valid | bool    |                   0 |                  1 | bit      |                            |
|   176 | preview | preview020.x               | m       |                -150 |                150 | signed   | preview020.position_valid  |
|   177 | preview | preview020.y               | m       |                -150 |                150 | signed   | preview020.position_valid  |
|   178 | preview | preview020.position_valid  | bool    |                   0 |                  1 | bit      |                            |
|   179 | preview | preview020.sin_heading     | 1       |                  -1 |                  1 | signed   | preview020.heading_valid   |
|   180 | preview | preview020.cos_heading     | 1       |                  -1 |                  1 | signed   | preview020.heading_valid   |
|   181 | preview | preview020.heading_valid   | bool    |                   0 |                  1 | bit      |                            |
|   182 | preview | preview020.curvature       | 1/m     |                -0.1 |                0.1 | signed   | preview020.curvature_valid |
|   183 | preview | preview020.curvature_valid | bool    |                   0 |                  1 | bit      |                            |
|   184 | preview | preview040.x               | m       |                -150 |                150 | signed   | preview040.position_valid  |
|   185 | preview | preview040.y               | m       |                -150 |                150 | signed   | preview040.position_valid  |
|   186 | preview | preview040.position_valid  | bool    |                   0 |                  1 | bit      |                            |
|   187 | preview | preview040.sin_heading     | 1       |                  -1 |                  1 | signed   | preview040.heading_valid   |
|   188 | preview | preview040.cos_heading     | 1       |                  -1 |                  1 | signed   | preview040.heading_valid   |
|   189 | preview | preview040.heading_valid   | bool    |                   0 |                  1 | bit      |                            |
|   190 | preview | preview040.curvature       | 1/m     |                -0.1 |                0.1 | signed   | preview040.curvature_valid |
|   191 | preview | preview040.curvature_valid | bool    |                   0 |                  1 | bit      |                            |
|   192 | preview | preview060.x               | m       |                -150 |                150 | signed   | preview060.position_valid  |
|   193 | preview | preview060.y               | m       |                -150 |                150 | signed   | preview060.position_valid  |
|   194 | preview | preview060.position_valid  | bool    |                   0 |                  1 | bit      |                            |
|   195 | preview | preview060.sin_heading     | 1       |                  -1 |                  1 | signed   | preview060.heading_valid   |
|   196 | preview | preview060.cos_heading     | 1       |                  -1 |                  1 | signed   | preview060.heading_valid   |
|   197 | preview | preview060.heading_valid   | bool    |                   0 |                  1 | bit      |                            |
|   198 | preview | preview060.curvature       | 1/m     |                -0.1 |                0.1 | signed   | preview060.curvature_valid |
|   199 | preview | preview060.curvature_valid | bool    |                   0 |                  1 | bit      |                            |
|   200 | preview | preview100.x               | m       |                -150 |                150 | signed   | preview100.position_valid  |
|   201 | preview | preview100.y               | m       |                -150 |                150 | signed   | preview100.position_valid  |
|   202 | preview | preview100.position_valid  | bool    |                   0 |                  1 | bit      |                            |
|   203 | preview | preview100.sin_heading     | 1       |                  -1 |                  1 | signed   | preview100.heading_valid   |
|   204 | preview | preview100.cos_heading     | 1       |                  -1 |                  1 | signed   | preview100.heading_valid   |
|   205 | preview | preview100.heading_valid   | bool    |                   0 |                  1 | bit      |                            |
|   206 | preview | preview100.curvature       | 1/m     |                -0.1 |                0.1 | signed   | preview100.curvature_valid |
|   207 | preview | preview100.curvature_valid | bool    |                   0 |                  1 | bit      |                            |
|   208 | preview | preview150.x               | m       |                -150 |                150 | signed   | preview150.position_valid  |
|   209 | preview | preview150.y               | m       |                -150 |                150 | signed   | preview150.position_valid  |
|   210 | preview | preview150.position_valid  | bool    |                   0 |                  1 | bit      |                            |
|   211 | preview | preview150.sin_heading     | 1       |                  -1 |                  1 | signed   | preview150.heading_valid   |
|   212 | preview | preview150.cos_heading     | 1       |                  -1 |                  1 | signed   | preview150.heading_valid   |
|   213 | preview | preview150.heading_valid   | bool    |                   0 |                  1 | bit      |                            |
|   214 | preview | preview150.curvature       | 1/m     |                -0.1 |                0.1 | signed   | preview150.curvature_valid |
|   215 | preview | preview150.curvature_valid | bool    |                   0 |                  1 | bit      |                            |
|   216 | object  | object00.valid             | bool    |                   0 |                  1 | bit      |                            |
|   217 | object  | object00.x                 | m       |                -150 |                150 | signed   | object00.valid             |
|   218 | object  | object00.y                 | m       |                -150 |                150 | signed   | object00.valid             |
|   219 | object  | object00.vx                | m/s     |                -150 |                150 | signed   | object00.valid             |
|   220 | object  | object00.vy                | m/s     |                -150 |                150 | signed   | object00.valid             |
|   221 | object  | object00.sin_heading       | 1       |                  -1 |                  1 | signed   | object00.valid             |
|   222 | object  | object00.cos_heading       | 1       |                  -1 |                  1 | signed   | object00.valid             |
|   223 | object  | object00.distance          | m       |                   0 |                150 | positive | object00.valid             |
|   224 | object  | object01.valid             | bool    |                   0 |                  1 | bit      |                            |
|   225 | object  | object01.x                 | m       |                -150 |                150 | signed   | object01.valid             |
|   226 | object  | object01.y                 | m       |                -150 |                150 | signed   | object01.valid             |
|   227 | object  | object01.vx                | m/s     |                -150 |                150 | signed   | object01.valid             |
|   228 | object  | object01.vy                | m/s     |                -150 |                150 | signed   | object01.valid             |
|   229 | object  | object01.sin_heading       | 1       |                  -1 |                  1 | signed   | object01.valid             |
|   230 | object  | object01.cos_heading       | 1       |                  -1 |                  1 | signed   | object01.valid             |
|   231 | object  | object01.distance          | m       |                   0 |                150 | positive | object01.valid             |
|   232 | object  | object02.valid             | bool    |                   0 |                  1 | bit      |                            |
|   233 | object  | object02.x                 | m       |                -150 |                150 | signed   | object02.valid             |
|   234 | object  | object02.y                 | m       |                -150 |                150 | signed   | object02.valid             |
|   235 | object  | object02.vx                | m/s     |                -150 |                150 | signed   | object02.valid             |
|   236 | object  | object02.vy                | m/s     |                -150 |                150 | signed   | object02.valid             |
|   237 | object  | object02.sin_heading       | 1       |                  -1 |                  1 | signed   | object02.valid             |
|   238 | object  | object02.cos_heading       | 1       |                  -1 |                  1 | signed   | object02.valid             |
|   239 | object  | object02.distance          | m       |                   0 |                150 | positive | object02.valid             |
|   240 | object  | object03.valid             | bool    |                   0 |                  1 | bit      |                            |
|   241 | object  | object03.x                 | m       |                -150 |                150 | signed   | object03.valid             |
|   242 | object  | object03.y                 | m       |                -150 |                150 | signed   | object03.valid             |
|   243 | object  | object03.vx                | m/s     |                -150 |                150 | signed   | object03.valid             |
|   244 | object  | object03.vy                | m/s     |                -150 |                150 | signed   | object03.valid             |
|   245 | object  | object03.sin_heading       | 1       |                  -1 |                  1 | signed   | object03.valid             |
|   246 | object  | object03.cos_heading       | 1       |                  -1 |                  1 | signed   | object03.valid             |
|   247 | object  | object03.distance          | m       |                   0 |                150 | positive | object03.valid             |
