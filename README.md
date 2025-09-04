# 🎮 Dantzig Game — LP Puzzle (PWA, responsive)

![License](https://img.shields.io/badge/license-MIT-green)
![PWA](https://img.shields.io/badge/PWA-offline-blue)
![JS](https://img.shields.io/badge/made%20with-JavaScript-yellow)

Gioco interattivo ispirato a **George Dantzig**: massimizza `z = c₁x + c₂y` sotto vincoli lineari.  
Trascina il punto nella regione ammissibile e prova a raggiungere l'ottimo.

---

## ✨ Scopo del gioco
Immagina di avere un tesoro (la funzione **z = c₁·x + c₂·y**) che cresce più vai verso una certa direzione.  
Ma non puoi andare dove vuoi: ci sono dei **muri invisibili** (i vincoli) che ti permettono di muoverti solo dentro una **zona blu** chiamata **regione ammissibile**.

👉 Il tuo obiettivo è **spostare il puntino giallo nella zona blu** per ottenere il valore più grande possibile di **z**.  
Chi trova il punto “migliore” vince.

---

## 🕹️ Come si gioca
1. Premi **Nuovo**: il gioco crea una nuova mappa con vincoli diversi.
2. Guarda la zona blu: è l’area dove sei autorizzato a muoverti.
3. Trascina con il dito (o col mouse) il **puntino giallo** dentro la zona blu.
4. Quando pensi di aver scelto il posto migliore, premi **Verifica**:
   - il gioco calcola quanto vale il tuo z,
   - lo confronta con il valore massimo possibile (z*),
   - ti dice se sei stato bravo o se puoi migliorare.

---

## 🏆 Regole di punteggio
- Il punteggio va da **0 a 100**.
- Se il tuo z è identico all’ottimo (z = z*), ottieni **100 punti**.
- Se sei più lontano, ottieni una parte proporzionale (es. metà valore = 50 punti).
- **Bonus +10** se giochi in modalità speciale:
  - **Snap interi** (coordinate intere),
  - **Boolean {0,1}** (puoi scegliere solo 0 o 1),
  - e il tuo punto è ammissibile.
- Non puoi superare 100: il massimo è sempre **100/100**.

---

## 🥇 Come si vince
- Vince chi ottiene **100/100** → cioè chi trova il **punto ottimo** della regione.
- Se giochi da solo, puoi cercare di battere il tuo **Best score** salvato dal gioco.
- Puoi sfidare gli amici: ognuno prova con lo stesso problema → chi ottiene più punti, vince.

---

## 📚 Aiuti
- **Hint**: mostra la linea dell’obiettivo, ti suggerisce la direzione in cui migliorare.
- **Simplex step**: ti fa vedere un percorso automatico di miglioramento (come un insegnante che mostra i passi).

---

## 🔧 Funzionalità tecniche
- Generazione casuale PL con livelli **Facile / Medio / Difficile** (2/3/4 vincoli obliqui)
- Modalità **Snap interi** e **Boolean {0,1}** (+10 punti bonus se ammissibile)
- **Simplex step-by-step** (pivot didattico)
- **Best score** in `localStorage`
- **Tutorial** iniziale
- **PWA offline** (manifest + service worker)
- **Canvas responsive** con **devicePixelRatio** e:
  - **Aspect ratio 1:1 su mobile piccolo**
  - **Pinch-zoom & pan** (multi-touch)
  - **Toggle “Adatta in altezza”** per schermi orizzontali

---

## 🚀 Avvio locale
```bash
git clone https://github.com/tuo-username/DantzigGame.git
cd DantzigGame
# Apri index.html nel browser
```

---

## ⚖️ Licenza
MIT © 2025 PezzaliAPP
