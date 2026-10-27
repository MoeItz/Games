# Games

Browser-Spiele, veröffentlicht mit GitHub Pages: https://moeitz.github.io/Games/

## Ärgerbrett (`aergerbrett/`)

Mensch ärgere dich nicht für 2 bis 4 Spieler: https://moeitz.github.io/Games/aergerbrett/

- **Online mit Freunden:** „Neues Spiel erstellen“ klicken und den Einladungslink verschicken. Wer ihn öffnet, setzt sich auf einen freien Platz.
- **An einem Gerät:** Namen eintragen und das Gerät weiterreichen.
- Wer jemanden rauswirft, kann ihm eine Nachricht auf den Bildschirm schicken.

## Mau-Mau (`maumau/`)

Das Kartenspiel für 2 bis 4 Spieler: https://moeitz.github.io/Games/maumau/

- 32 Karten, jeder bekommt 5. Gleiche Farbe oder gleicher Wert passt.
- **7:** Der Nächste zieht 2 (mit einer 7 weitergeben). **8:** Der Nächste setzt aus. **Bube:** Farbe wünschen.
- Bei 2 Karten „Mau!“ drücken, sonst gibt es 2 Strafkarten.
- Online sieht jeder nur seine eigenen Karten. An einem Gerät werden die Karten vor jedem Zug verdeckt.

## Farbenfieber (`farbenfieber/`)

Eigenes Kartenspiel mit Farben und Symbolen: https://moeitz.github.io/Games/farbenfieber/

- 76 Karten: 4 Farben (Orange, Lila, Türkis, Pink) × 6 Symbole (Stern, Mond, Blitz, Herz, Tropfen, Blume), dazu Aktionskarten. Jeder startet mit 7.
- Gleiche Farbe oder gleiches Symbol passt.
- **Lawine:** Nächster zieht 2 (stapelbar). **Bumerang:** Strafkarten zurückschicken. **Bombe:** Alle anderen ziehen 1. **Doppelt:** noch eine Karte legen. **Kehrtwende:** Richtung dreht sich. **Tausch:** Karten mit einem Mitspieler tauschen. **Regenbogen:** passt auf alles, Farbe wählen.
- Bei 2 Karten „Fieber!“ drücken, sonst 2 Strafkarten.

## Online-Spiel

Beide Spiele funktionieren gleich (`shared/net.js`). Der Browser des Gastgebers hält das Spiel. Die Nachrichten zwischen Gastgeber und Freunden laufen über öffentliche MQTT-Server (HiveMQ und EMQX, gleichzeitig) per verschlüsselter WebSocket-Verbindung, deshalb klappt es auch zwischen verschiedenen Netzwerken. Der Gastgeber muss den Tab offen lassen; lädt er neu, geht das Spiel an derselben Stelle weiter.

Die öffentlichen Server sind für alle offen: Wer den Spielcode kennt, könnte mitlesen. Für Spiele unter Freunden ist das in Ordnung, für Geheimes nicht.
