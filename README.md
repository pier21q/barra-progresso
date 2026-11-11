# barra-progresso

Una mod per Claude Code che mostra, sopra la casella del prompt, una barra di avanzamento con la mascotte di Claude mentre Claude lavora. Parte da sola a ogni messaggio, in ogni chat, e sparisce qualche secondo dopo la risposta.

```
 ▐▛███▛█    ╭───────╮
▝▜██████▀  ─┤ · · · │
 ▝▝   ▝▝    ╰───────╯
⠹ ███████████▍░░░░░░░░░░░░░░░░░░  38%  Passo 2/4: Correggo il bug · 34s
```

## Cosa fa

- **Progresso reale**: quando Claude tiene una lista di passi, la barra segue i passi completati sul totale e mostra il passo in corso. Senza lista usa una stima lenta che non si blocca.
- **Mascotte animata**: cammina avanti con la barra, si guarda intorno mentre pensa, guarda la nuvoletta mentre legge, muove un braccio mentre scrive o esegue comandi e festeggia alla fine.
- **Nuvoletta**: mostra cosa sta facendo Claude (pensa, legge, scrive, esegue comandi, usa strumenti).
- **Leggera**: non usa token e non cambia nulla di ciò che Claude legge o scrive; è solo disegno.

Funziona nel terminale e nell'app desktop di Claude Code.

## Installazione

Al prompt di una sessione di Claude Code nel terminale:

```
/plugin install barra-progresso --marketplace pier21q/barra-progresso
```

Da una shell:

```bash
claude plugin install barra-progresso --marketplace pier21q/barra-progresso
```

Rispondi `y` per aggiungere il marketplace, poi scegli l'ambito (user per averla in tutte le sessioni).

Nell'app desktop, dove `/plugin` non è disponibile: clicca + accanto alla casella del prompt, poi Plugins, Add marketplace con `pier21q/barra-progresso`, poi Add plugin.

## Licenza

MIT
