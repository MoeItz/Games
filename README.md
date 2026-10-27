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

## Online-Spiel

Beide Spiele funktionieren gleich. Es gibt keinen eigenen Server: Der Browser des Gastgebers hält das Spiel, die Freunde verbinden sich direkt mit ihm über WebRTC ([PeerJS](https://peerjs.com)). Der Gastgeber muss den Tab offen lassen; lädt er neu, geht das Spiel an derselben Stelle weiter. In sehr strengen Netzwerken (Schul- oder Firmen-WLAN) kann die direkte Verbindung blockiert sein.
