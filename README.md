# Games

Browser-Spiele, veröffentlicht mit GitHub Pages: https://moeitz.github.io/Games/

## Ärgerbrett (`aergerbrett/`)

Mensch ärgere dich nicht für 2 bis 4 Spieler: https://moeitz.github.io/Games/aergerbrett/

- **Online mit Freunden:** „Neues Spiel erstellen“ klicken und den Einladungslink verschicken. Wer ihn öffnet, setzt sich auf einen freien Platz.
- **An einem Gerät:** Namen eintragen und das Gerät weiterreichen.
- Wer jemanden rauswirft, kann ihm eine Nachricht auf den Bildschirm schicken.

Es gibt keinen eigenen Server: Der Browser des Gastgebers hält das Spiel, die Freunde verbinden sich direkt mit ihm über WebRTC ([PeerJS](https://peerjs.com)). Der Gastgeber muss den Tab offen lassen; lädt er neu, geht das Spiel an derselben Stelle weiter. In sehr strengen Netzwerken (Schul- oder Firmen-WLAN) kann die direkte Verbindung blockiert sein.
