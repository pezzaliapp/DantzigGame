# 🎮 Dantzig Game — LP Puzzle (PWA, responsive)

Gioco/puzzle ispirato a **George Dantzig**. Obiettivo: massimizzare
`z = c₁·x + c₂·y` rispettando vincoli lineari che definiscono la **regione ammissibile**.

## 🕹️ Come si gioca
1. **Nuovo** → genera un problema casuale.
2. Trascina il **puntino giallo** nella zona blu (o inserisci x,y).
3. **Verifica** → confronta il tuo `z` con l’ottimo `z*` e ottieni un punteggio.
4. Aiuti:
   - **Hint**: disegna la retta `z = costante` e la freccia **“più z →”** dal tuo punto.
   - **Simplex step**: visualizza un percorso didattico tra vertici con `z` crescente.

## 🏆 Punteggio
- 0–100 in base al rapporto `z/z*`.
- **+10** extra in modalità **intera** (Snap interi) o **booleana** (0/1) se il punto è ammissibile.
- Il best viene salvato in `localStorage` per livello e opzioni.

## 📚 Livelli
- **Facile** (2 vincoli obliqui)
- **Medio** (3 vincoli obliqui)
- **Difficile** (4 vincoli obliqui)
- **Esperto** (5 vincoli obliqui)
- **Maestro** (6 vincoli obliqui)

L’ottimo cade in un **vertice** della regione ammissibile.

## ⚙️ Tecnico
- Canvas responsive, **1:1 su mobile** piccolo, opzione **Adatta in altezza**.
- **Pinch‑zoom** e **pan** su touchscreen.
- PWA offline (Service Worker). Licenza **MIT**.

## 🔧 Sviluppo
Apri `index.html` in un web server statico (o GitHub Pages).  
Per forzare update della PWA: svuota cache o `Unregister` il Service Worker da DevTools.

---
Autore: PezzaliAPP · Dantzig Game — 2025
