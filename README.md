# 🎮 Dantzig Game — LP Puzzle (PWA, responsive)

Gioco interattivo ispirato a **George Dantzig**: massimizza `z = c₁x + c₂y` sotto vincoli lineari.

## Regole rapide (per tutti)
- **Scopo**: sposta il puntino giallo nella **zona blu** per ottenere il valore più alto di `z`.
- **Hint**: mostra la **retta z = costante** passante per il tuo punto + freccia **“più z →”**.
- **Simplex step**: percorso tra i **vertici** con `z` crescente, fino all’ottimo.

## Tecnico
- 2D PL, livelli Facile/Medio/Difficile (2/3/4 vincoli), Snap interi, Boolean {0,1}, PWA offline, pinch-zoom/pan, canvas responsive.
