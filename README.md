# Universal Video Controller - Estensione Chrome

Un'estensione Chrome universale per controllare qualsiasi video player su qualsiasi piattaforma.

## Caratteristiche

- ✅ Funziona con qualsiasi video HTML5
- ✅ Supporta YouTube, Vimeo, Netflix, Twitch, Prime Video e molte altre piattaforme
- ✅ Skip preciso al minutaggio desiderato (es: 2:33)
- ✅ Avanzamento personalizzato (es: 1m 30s)
- ✅ Salvataggio automatico dei valori inseriti
- ✅ Interfaccia minimale e intuitiva
- ✅ Rilevamento intelligente dei video anche caricati dinamicamente

## Installazione

### Opzione 1: Da Developer Mode (Consigliata)

1. Scarica tutti i file dell'estensione
2. Apri Chrome e vai su `chrome://extensions/`
3. Attiva la "Modalità sviluppatore" (Developer mode) in alto a destra
4. Clicca "Carica estensione non pacchettizzata" (Load unpacked)
5. Seleziona la cartella contenente i file dell'estensione
6. L'estensione apparirà nella barra degli strumenti

### Opzione 2: File .crx (Se disponibile)

1. Scarica il file .crx dell'estensione
2. Trascinalo nella pagina `chrome://extensions/`
3. Conferma l'installazione

## Come Usare

1. **Apri una pagina con un video** (YouTube, Netflix, Vimeo, etc.)
2. **Clicca sull'icona dell'estensione** nella barra degli strumenti
3. **Inserisci il minutaggio** nel primo campo (formati supportati):
   - `2:33` (2 minuti e 33 secondi)
   - `1:23:45` (1 ora, 23 minuti e 45 secondi)
   - `125` (125 secondi)
4. **Inserisci la durata** per l'avanzamento (formati supportati):
   - `1m 30s` (1 minuto e 30 secondi)
   - `45s` (45 secondi)
   - `2m` (2 minuti)
   - `90` (90 secondi)
5. **Usa i pulsanti**:
   - `Skip to` porta il video al minutaggio specificato
   - `Go forward` avanza il video della durata specificata

## Formati di Input Supportati

### Minutaggio (Skip to)
- `2:33` → 2 minuti e 33 secondi
- `1:23:45` → 1 ora, 23 minuti e 45 secondi
- `125` → 125 secondi

### Durata (Go forward)
- `1m 30s` → 1 minuto e 30 secondi
- `2m` → 2 minuti
- `45s` → 45 secondi
- `90` → 90 secondi

## Piattaforme Supportate

L'estensione è stata testata e funziona su:

- ✅ YouTube
- ✅ Vimeo
- ✅ Netflix
- ✅ Amazon Prime Video
- ✅ Twitch
- ✅ Dailymotion
- ✅ **Altadefinizione** (e varianti come altadefinizione01)
- ✅ **StreamingCommunity**
- ✅ Video HTML5 standard
- ✅ Player JW Player
- ✅ Player Video.js
- ✅ Player Plyr
- ✅ FlowPlayer
- ✅ MediaElement.js
- ✅ E molti altri siti di streaming...

## Struttura dei File

```
├── manifest.json          # Configurazione dell'estensione
├── popup.html             # Interfaccia utente
├── popup.js               # Logica dell'interfaccia
├── content.js             # Script per rilevare e controllare video
└── README.md             # Questo file
```

## Troubleshooting

### Il video non viene rilevato
- Assicurati che il video sia già caricato e visibile
- Ricarica la pagina e riprova
- L'estensione funziona solo con video HTML5

### I controlli non funzionano
- Verifica che la pagina non stia bloccando l'estensione
- Alcuni siti potrebbero avere protezioni contro le estensioni
- Prova a disattivare altre estensioni che potrebbero interferire

### Formati di input non riconosciuti
- Usa i formati esatti mostrati negli esempi
- Evita spazi extra o caratteri speciali
- Ricontrolla la sintassi (es: `2:33` non `2.33`)

## Sviluppo

Per modificare l'estensione:

1. Modifica i file sorgente
2. Vai su `chrome://extensions/`
3. Clicca l'icona di ricaricamento sull'estensione
4. Testa le modifiche

## Sicurezza e Privacy

- L'estensione funziona solo sulle pagine che stai visitando
- Non raccoglie o invia dati personali
- I valori inseriti sono salvati localmente nel browser
- Non accede a contenuti di altri siti o schede

## Licenza

Questo progetto è rilasciato sotto licenza MIT.