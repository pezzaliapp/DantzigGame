# 🎮 Dantzig Game — LP Puzzle (PWA, responsive)

![License](https://img.shields.io/badge/license-MIT-green)
![PWA](https://img.shields.io/badge/PWA-offline-blue)
![JS](https://img.shields.io/badge/made%20with-JavaScript-yellow)

Gioco interattivo ispirato a **George Dantzig**: massimizza `z = c₁x + c₂y` sotto vincoli lineari. Trascina il punto nella regione ammissibile e prova a raggiungere l'ottimo.

## ✨ Funzionalità
- Generazione casuale PL con livelli **Facile / Medio / Difficile** (2/3/4 vincoli obliqui)
- Modalità **Snap interi** e **Boolean {0,1}** (+10 punti bonus se ammissibile)
- **Simplex step-by-step** (pivot didattico)
- **Best score** in `localStorage`
- **Tutorial** iniziale
- **PWA offline** (manifest + service worker)
- **Canvas responsive** con **devicePixelRatio** e:
  - **Aspect ratio 1:1 su mobile piccolo**
  - **Pinch-zoom & pan** sul grafico (multi-touch)
  - **Toggle “Adatta in altezza”** per schermi orizzontali

## 🧪 Prova su GitHub Pages
Pubblica la cartella su Pages e apri `index.html`.

## 🖼️ Screenshot
Aggiungi un’immagine in `docs/screenshot.png` e linkala qui.

## 🚀 Avvio locale
```bash
git clone https://github.com/tuo-username/DantzigGame.git
cd DantzigGame
# Apri index.html nel browser
```
Suggerito: hard refresh (⌘⇧R / Ctrl+F5) se aggiornate versioni PWA.

## 📚 Come si gioca
1. **Nuovo** → genera un problema.
2. Trascina il punto giallo nella regione blu.
3. **Verifica** → punteggio ≈ `100·z/z*` (+10 con Snap/Boolean se ammissibile).
4. **Hint** → retta dell’obiettivo. **Simplex step** → percorso sui vertici.

## ⚖️ Licenza
MIT © 2025 PezzaliAPP
