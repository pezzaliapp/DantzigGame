/* Dantzig Game — avanzato + responsive (clean build) */
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
  const installLink = document.getElementById('installLink');

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
    // Aspect ratio 1:1 on small screens unless fitHeight is ON
    let cssH;
    if (vpW < 600 && !fitHeight.checked) {
      cssH = cssW; // square
    } else if (fitHeight.checked) {
      cssH = Math.min(cssW, maxH); // fill height, bounded
    } else {
      cssH = Math.min(cssW, maxH);
    }
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = cssW; H = cssH;
    draw();
  }
  const ro = new ResizeObserver(()=> resizeCanvas());
  ro.observe(wrap);
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', resizeCanvas);
  fitHeight.addEventListener('change', resizeCanvas);

  // ---- State ----
  let world = { Xmax: 12, Ymax: 12, c:[3,2], slants: [], level:'easy' };
  let view  = { xmin:0, xmax:12, ymin:0, ymax:12 }; // viewbox for zoom/pan
  let player = { x: 2, y: 2 };
  let dragging = false;
  let hint = false;
  let pwaEvent = null;
  let simplexPath = []; // list of vertices
  let simplexIndex = 0;

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
    const nObl = level==='easy' ? 2 : level==='medium' ? 3 : 4;
    for(let i=0;i<nObl;i++){
      const a = irnd(1,7), b = irnd(1,7);
      const px = irnd(Math.floor(Xmax*0.35), Math.floor(Xmax*0.9));
      const py = irnd(Math.floor(Ymax*0.35), Math.floor(Ymax*0.9));
      const d  = a*px + b*py;
      slants.push({a,b,d});
    }
    world = { Xmax, Ymax, c:[c1,c2], slants, level };
    view  = { xmin:0, xmax:Xmax, ymin:0, ymax:Ymax };
    player.x = Math.min(2, Xmax/2);
    player.y = Math.min(2, Ymax/2);
    hint = false;
    updateTexts();
    status.textContent = 'Nuovo problema.';
    scoreBox.textContent = '—';
    simplexPath = [];
    simplexIndex = 0;
    loadBest();
    draw();
    resizeCanvas();
  }

  function feasible(p, quantize=false){
    const {Xmax,Ymax,slants} = world;
    let [x,y]=p;
    if(quantize && boolMode.checked){ x = Math.round(x); y = Math.round(y); x = clamp(x,0,1); y = clamp(y,0,1); }
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
    if(Math.hypot(path[path.length-1][0]-goal[0], path[path.length-1][1]-goal[1])>1e-6){
      path.push(goal);
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
    // Level set: c1*x + c2*y = k
    let k = lineThroughPoint ? objectiveValue(lineThroughPoint[0], lineThroughPoint[1])
                             : objectiveValue(world.Xmax*0.6, world.Ymax*0.6);
    const {Xmax,Ymax} = world;
    const cand = [];
    // Intersections with rectangle borders
    // x = 0 => y = k/c2
    if (Math.abs(c2) > 1e-9) {
      const y0 = k / c2;
      if (y0 >= 0 && y0 <= Ymax) cand.push([0, y0]);
    }
    // x = Xmax => y = (k - c1*Xmax)/c2
    if (Math.abs(c2) > 1e-9) {
      const yR = (k - c1*Xmax) / c2;
      if (yR >= 0 && yR <= Ymax) cand.push([Xmax, yR]);
    }
    // y = 0 => x = k/c1
    if (Math.abs(c1) > 1e-9) {
      const x0 = k / c1;
      if (x0 >= 0 && x0 <= Xmax) cand.push([x0, 0]);
    }
    // y = Ymax => x = (k - c2*Ymax)/c1
    if (Math.abs(c1) > 1e-9) {
      const xT = (k - c2*Ymax) / c1;
      if (xT >= 0 && xT <= Xmax) cand.push([xT, Ymax]);
    }
    // Deduplicate close points
    const uniq = [];
    for (const p of cand){
      if (!uniq.some(q=>Math.hypot(q[0]-p[0], q[1]-p[1])<1e-6)) uniq.push(p);
    }
    if (uniq.length >= 2){
      const [p1,p2] = uniq.slice(0,2);
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

  // ---- Texts ----
  function updateTexts(){
    const {Xmax,Ymax,c,slants} = world;
    problemText.textContent =
      `Massimizza z = ${c[0]}·x + ${c[1]}·y con x≥0, y≥0, x≤${Xmax}, y≤${Ymax}` +
      (slants.length ? ` e ${slants.length} vincoli obliqui.` : `.`);

    const cons = [
      `x ≥ 0`, `y ≥ 0`, `x ≤ ${Xmax}`, `y ≤ ${Ymax}`,
      ...slants.map((s)=>`${s.a}·x + ${s.b}·y ≤ ${s.d}`)
    ].join('\\n');

    constraintsText.textContent = cons;
    xVal.value = player.x.toFixed(2);
    yVal.value = player.y.toFixed(2);
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
  canvas.addEventListener('touchstart', e=>{
    dragging=true;
    // handle pinch start
    if(e.touches.length===2){ dragging=false; pinchStart(e); }
  }, {passive:false});
  canvas.addEventListener('touchmove', e=>{
    if(e.touches.length===1 && dragging) onDragLike(e.touches[0]);
    if(e.touches.length===2){ pinchMove(e); }
  }, {passive:false});
  window.addEventListener('touchend', ()=> dragging=false);

  // ---- Pinch zoom & pan ----
  let pinchState = { active:false, startDist:0, startCenter:null, startView:null };
  function distance(a,b){ const dx=a.clientX-b.clientX, dy=a.clientY-b.clientY; return Math.hypot(dx,dy); }
  function midpoint(a,b){ return { x:(a.clientX+b.clientX)/2, y:(a.clientY+b.clientY)/2 }; }
  function pinchStart(e){
    if(e.touches.length!==2) return;
    pinchState.active = true;
    pinchState.startDist = distance(e.touches[0], e.touches[1]);
    pinchState.startCenter = midpoint(e.touches[0], e.touches[1]);
    pinchState.startView = {...view};
  }
  function pinchMove(e){
    if(!pinchState.active || e.touches.length!==2) return;
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

    // clamp to world
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

  simplexBtn.addEventListener('click', ()=>{ buildSimplexPath(); draw(); });
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
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js'); }
  window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); installDeferred = e; installLink.style.display='inline'; });
  let installDeferred = null;
  document.getElementById('installLink').addEventListener('click', (e)=>{ e.preventDefault(); if(installDeferred){ installDeferred.prompt(); } });

  // ---- Init ----
  genProblem();
  resizeCanvas();
  maybeShowTutorial();
})();
