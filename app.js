/* Dantzig Game — avanzato
   - Livelli: easy (2 obliqui), medium (3), hard (4)
   - Modalità intera / booleana {0,1} con bonus punteggio
   - Simplex step-by-step (didattico): cammino di miglioramento su vertici
   - Best score in localStorage per (level, mode)
*/
(function(){
  'use strict';
  // ---- DOM ----
  const canvas = document.getElementById('plot');
  const ctx = canvas.getContext('2d');
  const newBtn = document.getElementById('newBtn');
  const checkBtn = document.getElementById('checkBtn');
  const hintBtn = document.getElementById('hintBtn');
  const xVal = document.getElementById('xVal');
  const yVal = document.getElementById('yVal');
  const snapInt = document.getElementById('snapInt');
  const boolMode = document.getElementById('boolMode');
  const centerBtn = document.getElementById('centerBtn');
  const problemText = document.getElementById('problemText');
  const constraintsText = document.getElementById('constraintsText');
  const scoreBox = document.getElementById('scoreBox');
  const status = document.getElementById('status');
  const levelSel = document.getElementById('levelSel');
  const bestScoreEl = document.getElementById('bestScore');
  const simplexBtn = document.getElementById('simplexBtn');
  const sxPrev = document.getElementById('sxPrev');
  const sxNext = document.getElementById('sxNext');
  const sxStep = document.getElementById('sxStep');
  const helpBtn = document.getElementById('helpBtn');
  const tutorial = document.getElementById('tutorial');
  const dontShow = document.getElementById('dontShow');
  const closeTutorial = document.getElementById('closeTutorial');
  const installLink = document.getElementById('installLink');

  // ---- State ----
  let W = canvas.width, H = canvas.height;
  let PAD = 56;
  let world = { Xmax: 12, Ymax: 12, c:[3,2], slants: [], seed: 0, level:'easy' };
  let player = { x: 2, y: 2 };
  let dragging = false;
  let hint = false;
  let pwaEvent = null;
  let simplexPath = []; // list of vertices
  let simplexIndex = 0;

  // ---- Utils ----
  const rnd = (n=1)=>Math.random()*n;
  const irnd = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

  function key(){ return `dantzig.best.${world.level}.${boolMode.checked?'bool':snapInt.checked?'int':'cont'}`; }
  function loadBest(){ const v = localStorage.getItem(key()); bestScoreEl.textContent = v? `Best: ${v}/100` : 'Best: —'; }
  function saveBest(score){ const cur = parseInt(localStorage.getItem(key())||'0',10); if(score>cur){ localStorage.setItem(key(), String(score)); loadBest(); } }

  function toScreen(x,y){
    const sx = PAD + (x/world.Xmax)*(W-2*PAD);
    const sy = H-PAD - (y/world.Ymax)*(H-2*PAD);
    return [sx,sy];
  }
  function toWorld(sx,sy){
    const x = ((sx-PAD)/(W-2*PAD))*world.Xmax;
    const y = ((H-PAD-sy)/(H-2*PAD))*world.Ymax;
    return [x,y];
  }

  // ---- Problem generation ----
  function genProblem(){
    const level = levelSel.value;
    world.level = level;
    const Xmax = irnd(8,16), Ymax = irnd(8,16);
    const c1 = irnd(1,8), c2 = irnd(1,8);
    const slants = [];
    const nObl = level==='easy' ? 2 : level==='medium' ? 3 : 4;
    for(let i=0;i<nObl;i++){
      const a = irnd(1,7), b = irnd(1,7);
      const px = irnd(Math.floor(Xmax*0.35), Math.floor(Xmax*0.9));
      const py = irnd(Math.floor(Ymax*0.35), Math.floor(Ymax*0.9));
      const d  = a*px + b*py;
      slants.push({a,b,d});
    }
    world = { Xmax, Ymax, c:[c1,c2], slants, level };
    console.log('NUOVO PROBLEMA', world);
    slants.forEach((s,i)=>console.log(`vincolo ${i+1}: ${s.a}x + ${s.b}y ≤ ${s.d}`));
    player.x = Math.min(2, Xmax/2);
    player.y = Math.min(2, Ymax/2);
    hint = false;
    updateTexts();
    draw();
    status.textContent = 'Nuovo problema.';
    scoreBox.textContent = '—';
    simplexPath = [];
    simplexIndex = 0;
    loadBest();
  }

  function feasible(p, quantize=false){
    const {Xmax,Ymax,slants} = world;
    let [x,y]=p;
    if(quantize && boolMode.checked){ x = Math.round(x); y = Math.round(y); x = x<0?0:x>1?1:x; y = y<0?0:y>1?1:y; }
    if(x<0 || y<0 || x> Xmax || y> Ymax) return false;
    for(const s of slants){ if(s.a*x + s.b*y - s.d > 1e-9) return false; }
    return true;
  }

  function objectiveValue(x,y){ const [c1,c2]=world.c; return c1*x + c2*y; }

  function lineIntersections(lines){
    const pts = [];
    for(let i=0;i<lines.length;i++){
      for(let j=i+1;j<lines.length;j++){
        const L1 = lines[i], L2 = lines[j];
        const det = L1.A*L2.B - L2.A*L1.B;
        if(Math.abs(det) < 1e-9) continue;
        const x = (L1.C*L2.B - L2.C*L1.B)/det;
        const y = (L1.A*L2.C - L2.A*L1.C)/det;
        pts.push([x,y]);
      }
    }
    return pts;
  }

  function computeVertices(){
    const {Xmax,Ymax,slants} = world;
    const lines = [
      {A:1,B:0,C:0},{A:0,B:1,C:0},{A:1,B:0,C:Xmax},{A:0,B:1,C:Ymax}
    ];
    for(const s of slants){ lines.push({A:s.a, B:s.b, C:s.d}); }
    const cand = lineIntersections(lines);
    cand.push([0,0],[Xmax,0],[0,Ymax],[Xmax,Ymax]);
    const verts = cand.filter(p=>feasible(p, false));
    // dedup
    const uniq = [];
    for(const p of verts){
      if(!uniq.some(q=>Math.hypot(q[0]-p[0], q[1]-p[1])<1e-6)) uniq.push(p);
    }
    return uniq;
  }

  function computeOptimum(){
    const verts = computeVertices();
    if(verts.length===0) return {ok:false};
    let best = verts[0], bestVal = objectiveValue(verts[0][0], verts[0][1]);
    for(const p of verts){
      const val = objectiveValue(p[0], p[1]);
      if(val>bestVal){ best=p; bestVal=val; }
    }
    return {ok:true, point:best, value:bestVal, verts};
  }

  // ---- Simplex path (didattico) ----
  function buildSimplexPath(){
    const opt = computeOptimum();
    if(!opt.ok){ simplexPath=[]; simplexIndex=0; return; }
    const verts = opt.verts.slice();
    // start from the feasible vertex with minimal objective (for contrast)
    verts.sort((a,b)=>objectiveValue(a[0],a[1]) - objectiveValue(b[0],b[1]));
    const start = verts[0], goal = opt.point;
    // greedy ascent: each step pick neighbor vertex with highest improvement (approx neighbor by sharing one boundary line)
    // For simplicity, we approximate neighbors by selecting next best distinct vertex with increasing objective.
    const path = [start];
    let remaining = verts.filter(v=>v!==start);
    let current = start;
    while(true){
      // pick best remaining that improves
      let improving = remaining.filter(v=>objectiveValue(v[0],v[1])>objectiveValue(current[0],current[1]));
      if(improving.length===0) break;
      improving.sort((a,b)=>objectiveValue(b[0],b[1]) - objectiveValue(a[0],a[1]));
      const next = improving[0];
      path.push(next);
      remaining = remaining.filter(v=>v!==next);
      current = next;
      if(current===goal || (Math.hypot(current[0]-goal[0], current[1]-goal[1])<1e-6)) break;
    }
    // ensure goal is last
    if(Math.hypot(path[path.length-1][0]-opt.point[0], path[path.length-1][1]-opt.point[1])>1e-6){
      path.push(opt.point);
    }
    simplexPath = path;
    simplexIndex = 0;
    updateSimplexLabel();
  }

  function updateSimplexLabel(){
    if(simplexPath.length===0){ sxStep.textContent = '—'; return; }
    sxStep.textContent = `Step ${simplexIndex+1}/${simplexPath.length}`;
  }

  // ---- Drawing ----
  function drawGrid(){
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = '#0b0c10'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = '#2a2d36'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(PAD,PAD, W-2*PAD, H-2*PAD); ctx.stroke();
    ctx.fillStyle = '#9aa0a6'; ctx.font = '12px system-ui';
    for(let i=0;i<=world.Xmax;i++){
      const [sx,sy] = toScreen(i,0);
      ctx.beginPath(); ctx.moveTo(sx, H-PAD); ctx.lineTo(sx, H-PAD+5); ctx.stroke();
      ctx.fillText(i.toString(), sx-3, H-PAD+18);
    }
    for(let j=0;j<=world.Ymax;j++){
      const [sx,sy] = toScreen(0,j);
      ctx.beginPath(); ctx.moveTo(PAD-5, sy); ctx.lineTo(PAD, sy); ctx.stroke();
      ctx.fillText(j.toString(), PAD-24, sy+4);
    }
  }

  function drawConstraints(){
    const {Xmax,Ymax,slants} = world;
    // draw slanted lines
    for(const s of slants){
      const pts = [];
      if(s.b!==0){ const y=s.d/s.b; if(y>=0 && y<=Ymax) pts.push([0,y]); }
      if(s.a!==0){ const x=s.d/s.a; if(x>=0 && x<=Xmax) pts.push([x,0]); }
      if(s.b!==0){ const y=(s.d - s.a*Xmax)/s.b; if(y>=0 && y<=Ymax) pts.push([Xmax,y]); }
      if(s.a!==0){ const x=(s.d - s.b*Ymax)/s.a; if(x>=0 && x<=Xmax) pts.push([x,Ymax]); }
      if(pts.length>=2){
        const [p1,p2]=pts.slice(0,2);
        const [x1,y1]=toScreen(p1[0],p1[1]);
        const [x2,y2]=toScreen(p2[0],p2[1]);
        ctx.strokeStyle = '#9aa0a6';
        ctx.lineWidth = 1.25;
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      }
    }
    // fill feasible region coarse
    ctx.fillStyle = 'rgba(30,136,229,0.15)';
    const step = 2;
    for(let sx=PAD; sx<=W-PAD; sx+=step){
      for(let sy=PAD; sy<=H-PAD; sy+=step){
        const [x,y]=toWorld(sx,sy);
        if(feasible([x,y], false)) ctx.fillRect(sx,sy,step,step);
      }
    }
  }

  function drawObjective(lineThroughPoint=null){
    const [c1,c2]=world.c;
    let k;
    if(lineThroughPoint){
      k = objectiveValue(lineThroughPoint[0], lineThroughPoint[1]);
    }else{
      k = objectiveValue(world.Xmax*0.6, world.Ymax*0.6);
    }
    const pts = [];
    if(c1!==0){ pts.push([k/c1, 0]); }
    if(c2!==0){ pts.push([0, k/c2]); }
    const clip = pts.filter(p=>p[0]>=0 && p[1]>=0 && p[0]<=world.Xmax && p[1]<=world.Ymax);
    if(clip.length>=2){
      const [p1,p2]=clip;
      const [x1,y1]=toScreen(p1[0],p1[1]);
      const [x2,y2]=toScreen(p2[0],p2[1]);
      ctx.strokeStyle = '#f4511e';
      ctx.lineWidth = 1.25;
      ctx.setLineDash([6,6]);
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawPlayer(){
    let px = player.x, py = player.y;
    if(boolMode.checked){ px = Math.round(px); py = Math.round(py); }
    const [sx,sy]=toScreen(px,py);
    ctx.fillStyle = '#fdd663';
    ctx.beginPath(); ctx.arc(sx,sy,5,0,Math.PI*2); ctx.fill();
    ctx.font = '12px system-ui'; ctx.fillStyle = '#fdd663';
    ctx.fillText(`(${px.toFixed(2)}, ${py.toFixed(2)})`, sx+8, sy-8);
  }

  function drawOptimum(opt){
    if(!opt?.ok) return;
    const [sx,sy]=toScreen(opt.point[0], opt.point[1]);
    ctx.fillStyle = '#81c784';
    ctx.beginPath(); ctx.arc(sx,sy,6,0,Math.PI*2); ctx.fill();
  }

  function drawSimplexStep(){
    if(simplexPath.length===0) return;
    const p = simplexPath[simplexIndex];
    drawObjective(p);
    // draw visited vertices
    ctx.fillStyle = '#81c784';
    for(let i=0;i<=simplexIndex;i++){
      const [sx,sy]=toScreen(simplexPath[i][0], simplexPath[i][1]);
      ctx.beginPath(); ctx.arc(sx,sy,4,0,Math.PI*2); ctx.fill();
    }
  }

  function draw(){
    drawGrid();
    drawConstraints();
    if(hint) drawObjective(player);
    drawPlayer();
    drawSimplexStep();
  }

  // ---- Interaction ----
  function setFromInputs(){
    let x = parseFloat(xVal.value), y = parseFloat(yVal.value);
    if(Number.isFinite(x) && Number.isFinite(y)){
      if(boolMode.checked){ x = Math.round(x); y = Math.round(y); x=clamp(x,0,1); y=clamp(y,0,1); }
      if(snapInt.checked){ x=Math.round(x); y=Math.round(y); }
      player.x = clamp(x, 0, world.Xmax);
      player.y = clamp(y, 0, world.Ymax);
      draw();
    }
  }
  xVal.addEventListener('change', setFromInputs);
  yVal.addEventListener('change', setFromInputs);

  function onDragLike(e){
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    let [x,y] = toWorld(sx,sy);
    if(boolMode.checked){ x = Math.round(x); y = Math.round(y); x=clamp(x,0,1); y=clamp(y,0,1); }
    if(snapInt.checked){ x=Math.round(x); y=Math.round(y); }
    player.x = clamp(x,0,world.Xmax);
    player.y = clamp(y,0,world.Ymax);
    xVal.value = player.x.toFixed(2);
    yVal.value = player.y.toFixed(2);
    draw();
  }
  canvas.addEventListener('mousedown', e=>{ dragging=true; onDragLike(e); });
  canvas.addEventListener('mousemove', e=>{ if(dragging) onDragLike(e); });
  window.addEventListener('mouseup', ()=> dragging=false);
  canvas.addEventListener('touchstart', e=>{ dragging=true; onDragLike(e.touches[0]); e.preventDefault(); }, {passive:false});
  canvas.addEventListener('touchmove', e=>{ if(dragging) onDragLike(e.touches[0]); e.preventDefault(); }, {passive:false});
  window.addEventListener('touchend', ()=> dragging=false);

  newBtn.addEventListener('click', genProblem);
  levelSel.addEventListener('change', genProblem);
  hintBtn.addEventListener('click', ()=>{ hint = !hint; hintBtn.classList.toggle('primary', hint); draw(); });
  centerBtn.addEventListener('click', ()=>{ xVal.value = player.x.toFixed(2); yVal.value = player.y.toFixed(2); draw(); });
  [snapInt, boolMode].forEach(el=> el.addEventListener('change', ()=>{ draw(); loadBest(); }));

  checkBtn.addEventListener('click', ()=>{
    const opt = computeOptimum();
    if(!opt.ok){ status.textContent = 'Nessuna soluzione ammissibile.'; return; }
    const within = feasible([player.x, player.y], true);
    const myVal = objectiveValue(player.x, player.y);
    const bestVal = opt.value;
    const ratio = Math.max(0, Math.min(1, myVal / (bestVal || 1)));
    let score = Math.round(ratio * 100);
    let bonus = 0;
    if(within && (snapInt.checked || boolMode.checked)) bonus = 10;
    score = Math.min(100, score + bonus);
    scoreBox.textContent = within
      ? `z=${myVal.toFixed(2)} | z*=${bestVal.toFixed(2)} → Punteggio: ${score}/100 ${bonus?`(+${bonus} bonus)`:''}`
      : `Punto non ammissibile.`;
    drawGrid(); drawConstraints(); if(hint) drawObjective(player); drawPlayer(); drawOptimum(opt); drawSimplexStep();
    status.textContent = within
      ? (score>=100 ? 'Perfetto! Vertice ottimo.' : 'Ammissibile. Puoi migliorare.')
      : 'Fuori dalla regione ammissibile.';
    if(within) saveBest(score);
  });

  simplexBtn.addEventListener('click', ()=>{
    buildSimplexPath();
    draw();
  });
  sxPrev.addEventListener('click', ()=>{ if(simplexPath.length){ simplexIndex = Math.max(0, simplexIndex-1); updateSimplexLabel(); draw(); } });
  sxNext.addEventListener('click', ()=>{ if(simplexPath.length){ simplexIndex = Math.min(simplexPath.length-1, simplexIndex+1); updateSimplexLabel(); draw(); } });

  // ---- Tutorial ----
  helpBtn.addEventListener('click', ()=> tutorial.showModal());
  closeTutorial.addEventListener('click', ()=>{
    if(dontShow.checked) localStorage.setItem('dantzig.tutorial.hidden','1');
    tutorial.close();
  });
  function maybeShowTutorial(){
    if(!localStorage.getItem('dantzig.tutorial.hidden')) tutorial.showModal();
  }

  // ---- PWA ----
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js');
  }
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault(); pwaEvent = e; installLink.style.display='inline';
  });
  installLink.addEventListener('click', async (e)=>{ e.preventDefault(); if(pwaEvent){ pwaEvent.prompt(); } });

  // ---- Init ----
  genProblem();
  maybeShowTutorial();
})();
