/* Dantzig Game — clean build with robust Hint + Boolean UX + Simplex toggle + extra levels */
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
  const fitHeight = document.getElementById('fitHeight');
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

  // --- Responsive canvas (DPR aware) ---
  const wrap = document.getElementById('plotWrap');
  let W = 700, H = 700;
  let PAD = 56;
  function resizeCanvas(){
    if(!wrap) return;
    const headerH = document.querySelector('header')?.getBoundingClientRect().height || 0;
    const footerH = document.querySelector('footer')?.getBoundingClientRect().height || 0;
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const maxH = Math.max(320, vpH - headerH - footerH - 24);
    const cssW = wrap.clientWidth || 700;
    let cssH;
    if (vpW < 600 && !fitHeight.checked) cssH = cssW; else cssH = Math.min(cssW, maxH);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = cssW; H = cssH;
    draw();
  }
  const ro = new ResizeObserver(()=> resizeCanvas()); ro.observe(wrap);
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', resizeCanvas);
  fitHeight.addEventListener('change', resizeCanvas);

  // ---- State ----
  let world = { Xmax: 12, Ymax: 12, c:[3,2], slants: [], level:'easy' };
  let view  = { xmin:0, xmax:12, ymin:0, ymax:12 };
  let player = { x: 2, y: 2 };
  let dragging = false;
  let hint = false;
  let simplexPath = []; let simplexIndex = 0; let simplexActive = false;

  // ---- Utils ----
  const irnd = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  function key(){ return `dantzig.best.${world.level}.${boolMode.checked?'bool':snapInt.checked?'int':'cont'}`; }
  function loadBest(){ const v = localStorage.getItem(key()); bestScoreEl.textContent = v? `Best: ${v}/100` : 'Best: —'; }
  function saveBest(score){ const cur = parseInt(localStorage.getItem(key())||'0',10); if(score>cur){ localStorage.setItem(key(), String(score)); loadBest(); } }

  function toScreen(x,y){
    const sx = PAD + ((x - view.xmin)/(view.xmax - view.xmin))*(W-2*PAD);
    const sy = H-PAD - ((y - view.ymin)/(view.ymax - view.ymin))*(H-2*PAD);
    return [sx,sy];
  }
  function toWorld(sx,sy){
    const x = view.xmin + ((sx-PAD)/(W-2*PAD))*(view.xmax - view.xmin);
    const y = view.ymin + ((H-PAD-sy)/(H-2*PAD))*(view.ymax - view.ymin);
    return [x,y];
  }

  // ---- Problem generation ----
  function genProblem(){
    const level = levelSel.value;
    const Xmax = irnd(8,16), Ymax = irnd(8,16);
    const c1 = irnd(1,8), c2 = irnd(1,8);
    const slants = [];
    const nObl = level==='easy' ? 2 : level==='medium' ? 3 : level==='hard' ? 4 : level==='expert' ? 5 : 6;
    for(let i=0;i<nObl;i++){
      const a = irnd(1,7), b = irnd(1,7);
      const px = irnd(Math.floor(Xmax*0.35), Math.floor(Xmax*0.9));
      const py = irnd(Math.floor(Ymax*0.35), Math.floor(Ymax*0.9));
      const d  = a*px + b*py;
      slants.push({a,b,d});
    }
    world = { Xmax, Ymax, c:[c1,c2], slants, level };
    view  = { xmin:0, xmax:Xmax, ymin:0, ymax:Ymax };
    player.x = Math.min(2, Xmax/2); player.y = Math.min(2, Ymax/2);
    hint = false; simplexActive = false; simplexPath=[]; simplexIndex=0;
    updateTexts(); status.textContent = 'Nuovo problema.'; scoreBox.textContent='—'; loadBest(); resizeCanvas(); draw();
    updateSimplexUI();
  }

  function feasible(p, quantize=false){
    const {Xmax,Ymax,slants} = world;
    let [x,y]=p;
    if(quantize && boolMode.checked){ x = x<=0 ? 0 : 1; y = y<=0 ? 0 : 1; }
    if(x<0 || y<0 || x> Xmax || y> Ymax) return false;
    for(const s of slants){ if(s.a*x + s.b*y - s.d > 1e-9) return false; }
    return true;
  }
  const objectiveValue = (x,y)=> world.c[0]*x + world.c[1]*y;

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

  // ---- Simplex (didattico) ----
  function buildSimplexPath(){
    const opt = computeOptimum();
    if(!opt.ok){ simplexPath=[]; simplexIndex=0; updateSimplexLabel(); return; }
    const verts = opt.verts.slice().sort((a,b)=>objectiveValue(a[0],a[1]) - objectiveValue(b[0],b[1]));
    const start = verts[0], goal = opt.point;
    const path = [start];
    let remaining = verts.filter(v=>v!==start);
    let current = start;
    while(true){
      let improving = remaining.filter(v=>objectiveValue(v[0],v[1])>objectiveValue(current[0],current[1]));
      if(improving.length===0) break;
      improving.sort((a,b)=>objectiveValue(b[0],b[1]) - objectiveValue(a[0],a[1]));
      const next = improving[0];
      path.push(next);
      remaining = remaining.filter(v=>v!==next);
      current = next;
      if(Math.hypot(current[0]-goal[0], current[1]-goal[1])<1e-6) break;
    }
    if(Math.hypot(path[path.length-1][0]-goal[0], path[path.length-1][1])>1e-6) path.push(goal);
    simplexPath = path; simplexIndex=0; updateSimplexLabel();
  }

  function updateSimplexLabel(){ sxStep.textContent = simplexPath.length? `Step ${simplexIndex+1}/${simplexPath.length}`:'—'; }
  function updateSimplexUI(){ if(simplexBtn){ simplexBtn.classList.toggle('primary', simplexActive && simplexPath.length>0); } updateSimplexLabel(); }

  // ---- Drawing ----
  function drawGrid(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#0b0c10'; ctx.fillRect(0,0,canvas.width,canvas.height);
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
    // Region shading
    ctx.fillStyle = 'rgba(30,136,229,0.15)';
    const step = 2;
    for(let sx=PAD; sx<=W-PAD; sx+=step){
      for(let sy=PAD; sy<=H-PAD; sy+=step){
        const [x,y]=toWorld(sx,sy);
        if(feasible([x,y], false)) ctx.fillRect(sx,sy,step,step);
      }
    }
  }

  function drawSimplexStep(){
    if(simplexPath.length===0) return;
    const p = simplexPath[simplexIndex];
    // polyline
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for(let i=0;i<=simplexIndex;i++){
      const [sx,sy]=toScreen(simplexPath[i][0], simplexPath[i][1]);
      if(i===0) ctx.moveTo(sx,sy); else ctx.lineTo(sx,sy);
    }
    ctx.stroke();
    // arrowhead
    if(simplexIndex>0){
      const [sxA,syA]=toScreen(simplexPath[simplexIndex-1][0], simplexPath[simplexIndex-1][1]);
      const [sxB,syB]=toScreen(simplexPath[simplexIndex][0], simplexPath[simplexIndex][1]);
      const angle = Math.atan2(syB - syA, sxB - sxA);
      const ah=9; ctx.fillStyle='#00e676';
      ctx.beginPath();
      ctx.moveTo(sxB, syB);
      ctx.lineTo(sxB - ah*Math.cos(angle - Math.PI/6), syB - ah*Math.sin(angle - Math.PI/6));
      ctx.lineTo(sxB - ah*Math.cos(angle + Math.PI/6), syB - ah*Math.sin(angle + Math.PI/6));
      ctx.closePath(); ctx.fill();
    }
  }

  function drawPlayer(){
    let px = player.x, py = player.y;
    const [sx,sy]=toScreen(px,py);
    ctx.fillStyle = '#fdd663';
    ctx.beginPath(); ctx.arc(sx,sy,5,0,Math.PI*2); ctx.fill();
    ctx.font = '12px system-ui'; ctx.fillStyle = '#fdd663';
    ctx.fillText(`(${px.toFixed(2)}, ${py.toFixed(2)})`, sx+8, sy-8);
  }

  // ---- Hint overlay (robust, drawn last) ----
  function drawHintOverlay(){
    try{
      const [c1,c2]=world.c;
      // Direction tangent to level set
      const tx=c2, ty=-c1, normT=Math.hypot(tx,ty)||1, dir={x:tx/normT, y:ty/normT};
      const p0={x:player.x, y:player.y};
      const xmin=view.xmin, xmax=view.xmax, ymin=view.ymin, ymax=view.ymax;
      const ts=[];
      if(Math.abs(dir.x)>1e-9){ ts.push((xmin-p0.x)/dir.x, (xmax-p0.x)/dir.x); }
      if(Math.abs(dir.y)>1e-9){ ts.push((ymin-p0.y)/dir.y, (ymax-p0.y)/dir.y); }
      const cand=[];
      for(const t of ts){
        const x=p0.x+t*dir.x, y=p0.y+t*dir.y;
        if(x>=xmin-1e-6&&x<=xmax+1e-6&&y>=ymin-1e-6&&y<=ymax+1e-6) cand.push([x,y]);
      }
      const uniq=[];
      for(const p of cand){ if(!uniq.some(q=>Math.hypot(q[0]-p[0], q[1]-p[1])<1e-5)) uniq.push(p); }
      if(uniq.length>=2){
        uniq.sort((a,b)=> (Math.hypot(a[0]-p0.x,a[1]-p0.y) - Math.hypot(b[0]-p0.x,b[1]-p0.y)) );
        const pA=uniq[0], pB=uniq[uniq.length-1];
        const [x1,y1]=toScreen(pA[0],pA[1]); const [x2,y2]=toScreen(pB[0],pB[1]);
        ctx.save();
        ctx.strokeStyle='#ff9800'; ctx.lineWidth=2.5; ctx.setLineDash([6,6]);
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); ctx.setLineDash([]);
        // ascent arrow
        const gnorm=Math.hypot(c1,c2)||1, gx=(c1/gnorm)*28, gy=(c2/gnorm)*28;
        const [sx,sy]=toScreen(player.x, player.y);
        const dx=gx*(W-2*PAD)/(view.xmax-view.xmin), dy=-gy*(H-2*PAD)/(view.ymax-view.ymin);
        ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx+dx, sy+dy); ctx.stroke();
        const angle=Math.atan2(dy,dx), ah=8;
        ctx.beginPath(); ctx.moveTo(sx+dx, sy+dy);
        ctx.lineTo(sx+dx - ah*Math.cos(angle - Math.PI/6), sy+dy - ah*Math.sin(angle - Math.PI/6));
        ctx.lineTo(sx+dx - ah*Math.cos(angle + Math.PI/6), sy+dy - ah*Math.sin(angle + Math.PI/6));
        ctx.closePath(); ctx.fillStyle='#ff9800'; ctx.fill();
        // label
        ctx.fillStyle='#ff9800'; ctx.font='12px system-ui'; ctx.fillText('z = costante', (x1+x2)/2 + 6, (y1+y2)/2 - 6);
        ctx.restore();
      }
    }catch(e){ console.error('Hint overlay error:', e); }
  }

  function draw(){
    drawGrid();
    drawConstraints();
    if(simplexActive) drawSimplexStep();
    drawPlayer();
    if(hint) drawHintOverlay();
  }

  // ---- Texts ----
  function updateTexts(){
    const {Xmax,Ymax,c,slants} = world;
    problemText.textContent = `Massimizza z = ${c[0]}·x + ${c[1]}·y con x≥0, y≥0, x≤${Xmax}, y≤${Ymax}` + (slants.length?` e ${slants.length} vincoli obliqui.`:'.');
    const cons = [`x ≥ 0`, `y ≥ 0`, `x ≤ ${Xmax}`, `y ≤ ${Ymax}`, ...slants.map(s=>`${s.a}·x + ${s.b}·y ≤ ${s.d}`)].join('\\n');
    constraintsText.textContent = cons;
    xVal.value = player.x.toFixed(2); yVal.value = player.y.toFixed(2);
  }

  // ---- Interaction ----
  function setFromInputs(){
    let x = parseFloat(xVal.value), y = parseFloat(yVal.value);
    if(Number.isFinite(x) && Number.isFinite(y)){
      if(boolMode.checked){ x = x<=0 ? 0 : 1; y = y<=0 ? 0 : 1; }
      else if(snapInt.checked){ x=Math.round(x); y=Math.round(y); }
      player.x = clamp(x,0,world.Xmax); player.y = clamp(y,0,world.Ymax); draw();
    }
  }
  xVal.addEventListener('change', setFromInputs);
  yVal.addEventListener('change', setFromInputs);

  function onDragLike(e){
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    let [x,y] = toWorld(sx,sy);
    if(boolMode.checked){
      x = (x < 0.5) ? 0 : 1;
      y = (y < 0.5) ? 0 : 1;
    } else if(snapInt.checked){
      x = Math.round(x); y = Math.round(y);
    }
    player.x = clamp(x,0,world.Xmax);
    player.y = clamp(y,0,world.Ymax);
    xVal.value = player.x.toFixed(2);
    yVal.value = player.y.toFixed(2);
    draw();
  }
  canvas.addEventListener('mousedown', e=>{ dragging=true; onDragLike(e); });
  canvas.addEventListener('mousemove', e=>{ if(dragging) onDragLike(e); });
  window.addEventListener('mouseup', ()=> dragging=false);
  canvas.addEventListener('touchstart', e=>{ dragging=true; }, {passive:false});
  canvas.addEventListener('touchmove', e=>{ if(e.touches.length===1 && dragging) onDragLike(e.touches[0]); }, {passive:false});
  window.addEventListener('touchend', ()=> dragging=false);

  // ---- Pinch zoom & pan (two-finger) ----
  let pinchState = { active:false, startDist:0, startCenter:null, startView:null };
  function distance(a,b){ const dx=a.clientX-b.clientX, dy=a.clientY-b.clientY; return Math.hypot(dx,dy); }
  function midpoint(a,b){ return { x:(a.clientX+b.clientX)/2, y:(a.clientY+b.clientY)/2 }; }
  canvas.addEventListener('touchstart', e=>{
    if(e.touches.length===2){
      pinchState.active = true;
      pinchState.startDist = distance(e.touches[0], e.touches[1]);
      pinchState.startCenter = midpoint(e.touches[0], e.touches[1]);
      pinchState.startView = {...view};
    }
  }, {passive:false});
  canvas.addEventListener('touchmove', e=>{
    if(pinchState.active && e.touches.length===2){
      e.preventDefault();
      const curDist = distance(e.touches[0], e.touches[1]);
      const scale = curDist / (pinchState.startDist || 1);
      const rect = canvas.getBoundingClientRect();
      const cx = pinchState.startCenter.x - rect.left;
      const cy = pinchState.startCenter.y - rect.top;
      const [wx,wy] = toWorld(cx, cy);

      const vxw = (pinchState.startView.xmax - pinchState.startView.xmin);
      const vyw = (pinchState.startView.ymax - pinchState.startView.ymin);
      const newVxw = vxw / scale;
      const newVyw = vyw / scale;

      view.xmin = wx - ( (wx - pinchState.startView.xmin) / vxw ) * newVxw;
      view.xmax = view.xmin + newVxw;
      view.ymin = wy - ( (wy - pinchState.startView.ymin) / vyw ) * newVyw;
      view.ymax = view.ymin + newVyw;

      const clampRange = (min, max, wmin, wmax) => {
        const w = max - min; 
        if(w > (wmax - wmin)){ return [wmin, wmax]; }
        if(min < wmin){ return [wmin, wmin + w]; }
        if(max > wmax){ return [wmax - w, wmax]; }
        return [min, max];
      };
      [view.xmin, view.xmax] = clampRange(view.xmin, view.xmax, 0, world.Xmax);
      [view.ymin, view.ymax] = clampRange(view.ymin, view.ymax, 0, world.Ymax);
      draw();
    }
  }, {passive:false});
  window.addEventListener('touchend', ()=> pinchState.active=false);

  // ---- Buttons ----
  newBtn.addEventListener('click', genProblem);
  levelSel.addEventListener('change', genProblem);
  hintBtn.addEventListener('click', ()=>{ hint = !hint; hintBtn.classList.toggle('primary', hint); status.textContent = hint ? 'Hint attivo' : 'Hint disattivato'; draw(); });
  simplexBtn.addEventListener('click', ()=>{
    if(!simplexActive){
      buildSimplexPath();
      simplexIndex = 0;
      simplexActive = simplexPath.length>0;
    }else{
      simplexActive = false; simplexPath = []; simplexIndex = 0;
    }
    updateSimplexUI(); draw();
  });
  centerBtn.addEventListener('click', ()=>{ xVal.value = player.x.toFixed(2); yVal.value = player.y.toFixed(2); draw(); });
  [snapInt, boolMode].forEach(el=> el.addEventListener('change', ()=>{ if(el===boolMode && boolMode.checked){ player.x = player.x<0.5?0:1; player.y = player.y<0.5?0:1; } draw(); loadBest(); }));

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
    drawGrid(); drawConstraints(); if(simplexActive) drawSimplexStep(); drawPlayer(); if(hint) drawHintOverlay();
    status.textContent = within ? (score>=100 ? 'Perfetto! Vertice ottimo.' : 'Ammissibile. Puoi migliorare.') : 'Fuori dalla regione ammissibile.';
    if(within) saveBest(score);
  });

  sxPrev?.addEventListener('click', ()=>{ if(simplexPath.length){ simplexActive=true; simplexIndex = Math.max(0, simplexIndex-1); updateSimplexUI(); draw(); } });
  sxNext?.addEventListener('click', ()=>{ if(simplexPath.length){ simplexActive=true; simplexIndex = Math.min(simplexPath.length-1, simplexIndex+1); updateSimplexUI(); draw(); } });

  // ---- Tutorial ----
  helpBtn.addEventListener('click', ()=> tutorial.showModal());
  closeTutorial.addEventListener('click', ()=>{
    if(document.getElementById('dontShow').checked) localStorage.setItem('dantzig.tutorial.hidden','1');
    tutorial.close();
  });
  function maybeShowTutorial(){ if(!localStorage.getItem('dantzig.tutorial.hidden')) tutorial.showModal(); }

  // ---- PWA ----
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js'); }

  // ---- Init ----
  genProblem();
  resizeCanvas();
  maybeShowTutorial();
})();
