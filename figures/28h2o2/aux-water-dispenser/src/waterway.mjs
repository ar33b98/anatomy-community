import * as k from '../../../../.skill/kit/iso-kit.mjs';
import * as G from '../../../../.skill/kit/lathe.mjs';
import * as A from '../../../../.skill/kit/audit.mjs';
import {tubePieces,tubeSvg} from '../../../../.skill/kit/tube.mjs';
import {safetyHtml,safetyCSS,safetyLive} from './water-safety.mjs';

export const lessons=[
 ['stored','01','水存在哪里','常温水在大桶和上部储水腔；热水单独存放在热罐。','大桶是主要水源。桶座下的储水腔暂存未经加热的水，并向两条支路供水。下面剖开的金属内胆是热罐，专门存放需要加热的那部分水。','上部：常温水 · 下部：热罐'],
 ['heat','02','内胆里的水怎样变热','电加热件通电，把热量传给罐内的水。','这里示意贴合罐底的电阻式加热件：电能转成热，经罐底传到水中。水在罐内对流、逐渐升温。橙色表示升温后的水；运动圆点表示对流，不是沸腾气泡。','加热件：通电 · 热罐：升温'],
 ['ready','03','加热好以后存在哪里','仍然留在热罐里，等你打开热水阀。','达到温控设定的上限后，加热电路断开，热水留在内胆中。水温降到下限时，再恢复加热。实际阈值、内胆容量和加热件形式尚未取得该型号说明书确认。','加热件：断电 · 热罐：储存热水'],
 ['hot','04','热水怎样流出来','打开热水阀：热罐上部出水，下部同时补水。','储水腔与热罐连通。上面的水比出水口高，水在重力形成的压力下流动：常温水从热罐下部进入，罐内热水从上部出口，经热水管和阀门流出。两条流向同时显示；正常供水时内胆通常保持充满。连续取水会使罐内水逐渐降温。','热水阀：开 · 下部补水 / 上部出水'],
 ['cold','05','常温水走哪条路','从上部储水腔直接流向常温阀，绕过热罐。','常温口供应的是未经加热的桶装水。它由另一根管直接连接上部储水腔；下方热罐中的热水仍储存在原处。这里没有制冷系统。','常温阀：开 · 热罐不参与这条支路'],
 ['reheat','06','没喝完，怎样反复保温','水留在热罐里；温控让加热件交替通电与断电。','不取水时，热罐中的水会散热。温控在水温降到下限后恢复加热，到上限后断开。图中没有打开取水阀，也没有画出“每次加热就产生毒物”。判断水质需要看原水、储存、卫生条件及实际浓度，详见下方说明。','热罐保温循环 · 两个取水阀关闭'],
 ['hygiene','07','久置时关注哪些位置','标出的储水腔、常温水路和出水嘴都需要清洁维护。','这些部位没有经过热罐的加热过程。久置、污染和清洁不足可能影响微生物状况；热罐再次加热不能代表整个水路已被消毒。描边只标出卫生关注位置，并不表示这台机器已检出污染。','卫生关注位置 · 非本机污染检测结果']
];

// Qualitative teaching states: no invented temperature, capacity or heating time.
export function teachingState(phase,age=0){
 const cycle=phase===5?Math.floor(age/2)%4:null,progress=(age%2)/2;
 const cycleWarmth=cycle===null?1:[.7+.12*progress,.82+.18*progress,1-.08*progress,.92-.22*progress][cycle];
 return {phase,cycle,heater:phase===1||(phase===5&&cycle<2),hotOpen:phase===3,coldOpen:phase===4,
  feed:phase===3,warmth:phase===1?Math.min(1,age/4.5):phase===5?cycleWarmth:1};
}

export function makeWaterway({theme='light',overviewSvg='',sourceHtml=''}){
 const W=740,H=670;
 const base={x:-104,y:-15,w:210,d:157,r:4};
 const P=k.fitProjection([...k.boxCorners(base,-5,8),[-90,8,241],[106,12,241],[-45,0,243],[80,116,170]],W,H,{pad:65,azimuth:58,elevation:28});
 const R=A.recorder(P),at=p=>k.iso(p,P),S=k.solidSvg,L=k.lineSvg;
 function put(name,group,center,svg,shape,material=''){
  R.put({name,piece:'core',at:center,group,material,svg,shapes:[R.solid(shape)]});
 }
 function box(name,group,x,y,z,w,d,h,tone='mid',extra=''){
  const plan={x,y,w,d,r:.5};put(name,group,[x+w/2,y+d/2,z+h/2],S(k.slabOf(plan,z,h,P,6,.4),{tone})+extra,A.slab(plan,z,h,{name},6));
 }
 function cyl(name,group,x,y,z,r,h,{tone='mid',material='',extra=''}={}){
  put(name,group,[x,y,z+h/2],S(k.cylinder(x,y,r,z,h,P,96,.35),{tone})+extra,A.cylinder(x,y,r,z,h,{name}),material);
 }
 function sector(name,group,x,y,z,ri,ro,h,{tone='mid',start=148,end=328,material=''}={}){
  const pts=[];for(let i=0;i<=64;i++){const a=(start+(end-start)*i/64)*Math.PI/180;pts.push([x+ro*Math.cos(a),y+ro*Math.sin(a)])}
  if(ri===0)pts.push([x,y]);else for(let i=64;i>=0;i--){const a=(start+(end-start)*i/64)*Math.PI/180;pts.push([x+ri*Math.cos(a),y+ri*Math.sin(a)])}
  put(name,group,[x,y,z+h/2],S(k.extrude(pts,z,h,P,{convex:false}),{tone}),A.extruded(pts,z,h,{name}),material);
 }
 function ring(name,group,x,y,z,ri,ro,h,tone='mid'){
  const F=G.frameAlong([x,y,z],[0,0,1]);put(name,group,[x,y,z+h/2],S(G.ringBand(0,h,ri,ro,F,P),{tone}),A.ring(F,0,h,ri,ro,{name}));
 }
 function ball(name,group,p,r){put(name,group,p,S(G.sphereOf(p,r,P),{tone:'mid'}),A.ball(p,r,{name}));}
 const routes=[];
 function tube(name,group,pts,r,{material='',limp=false}={}){
  const route=G.fillet(pts,Math.max(6,r*3.5),14,{P,tube:r});R.route(name,route,r,{piece:'core',limp});
  const chunks=tubePieces(route,r,P,{maxLength:11,spacing:1});
  chunks.forEach((t,i)=>R.put({name:name+':'+i,piece:'core',at:t.mid,group,material,svg:tubeSvg(t,{tone:'hi'}),shapes:[A.tube(t.points,t.radii)],route:name,chunk:i}));
  if(material)routes.push({name,group,points:route,chunks:chunks.map(({from,to})=>({from,to}))});
 }
 // The bench is a teaching cutaway, rather than a claimed factory layout.
 for(const [i,[x,y]] of [[-90,18],[92,18],[-90,128],[92,128]].entries())cyl('stand.foot'+i,'stand',x,y,-5,5,5,{tone:'lo'});
 box('stand.base','stand',base.x,base.y,0,base.w,base.d,8,'lo',L(k.planOutline(k.insetPlan(base,5),8,P),{tone:'faint'}));
 box('stand.back','stand',-99,-15,8,200,3,229,'lo');
 for(const x of [-102,99])box('stand.rear-rib'+x,'stand',x,-12,8,3,3,229,'lo');
 for(const x of [-25,17])box('reservoir.bracket'+x,'reservoir',x,-12,166,8,18,3,'lo');
 cyl('reservoir.bottom','reservoir',0,30,169,42,5,{tone:'hi'});
 sector('reservoir.wall','reservoir',0,30,174,39,42,46,{tone:'hi'});
 cyl('reservoir.water','reservoir',0,30,174,39,40,{tone:'hi',material:'cold-water'});
 sector('reservoir.lid','reservoir',0,30,220,0,42,2,{tone:'mid'});
 cyl('reservoir.bucket-neck','reservoir',0,30,222,10,14,{tone:'hi'});
 ring('reservoir.neck-rim','reservoir',0,30,236,7,10,2,'hi');
 // Two real mounting studs carry the hot vessel; the heater sits below its floor.
 for(const [i,x] of [-69,-21].entries())cyl('hot.support'+i,'hot',x,40,8,2.6,42,{tone:'lo'});
 cyl('hot.floor','hot',-45,40,50,28,5,{tone:'hi'});
 sector('hot.wall','hot',-45,40,55,26,28,76,{tone:'hi'});
 sector('hot.insulation','hot',-45,40,55,28,30,76,{tone:'lo'});
 cyl('hot.water','hot',-45,40,55,26,76,{tone:'hi',material:'hot-water'});
 cyl('hot.lid','hot',-45,40,131,28,5,{tone:'hi',extra:L(k.ring(-45,40,23,136,P),{tone:'lo'})});
 cyl('heater.mount','heater',-45,40,47,20,3,{tone:'mid'});
 sector('heater.back','heater',-45,40,40,4,18,7,{tone:'hi',material:'heater'});
 sector('heater.front','heater',-45,40,40,4,18,7,{tone:'hi',start:328,end:508,material:'heater'});
 cyl('heater.terminal','heater',-45,40,37,3,10,{tone:'mid'});
 // Temperature switches on a lid-mounted demonstration bracket.
 box('control.mount','control',-25,35,136,8,10,2,'mid');
 box('control.thermostat','control',-24,36,138,3,8,6,'hi');
 box('control.limit','control',-20,36,138,3,8,5,'hi');
 box('control.board-bracket','control',77,-12,191,20,45,3,'lo');
 for(const [i,[x,y]] of [[80,11],[94,11],[80,30],[94,30]].entries())cyl('control.spacer'+i,'control',x,y,194,1.4,3,{tone:'mid'});
 box('control.board','control',78,9,197,18,23,1.3,'mid');
 box('control.switch','control',80,11,198.3,6,8,5,'mid');
 box('control.terminal','control',87,13,198.3,6,5,3,'mid');
 box('control.connector','control',82,25,198.3,10,4,3,'mid');
 cyl('control.wire-port','control',90,20,188,2,3,{tone:'mid'});
 tube('power.cable','control',[[90,20,188],[90,20,22],[-45,20,22],[-45,40,22],[-45,40,37]],.65,{limp:true});
 // Cold supply drops to a lower hot inlet. Outgoing hot pipe starts at the top.
 for(const [name,x,y,z] of [['feed.source',20,25,166],['cold.source',28,48,166],['feed.inlet',-45,17,47]])cyl(name,name.startsWith('cold')?'cold':'feed',x,y,z,2.8,3,{tone:'hi'});
 cyl('hot.port','hot',-45,40,136,1.45,3.963,{tone:'mid'});
 ball('hot.elbow','hot',[-45,40,142],2.5);
 tube('feed.pipe','feed',[[20,25,166],[20,25,28],[-45,17,28],[-45,17,47]],1.85,{material:'cold-pipe'});
 tube('cold.pipe','cold',[[28,48,166],[28,48,150],[70,48,150],[70,111,150],[70,111,78]],1.85,{material:'cold-pipe'});
 tube('hot.pipe','hot',[[-45,41.68,142],[-45,111,142],[-45,111,78]],1.85,{material:'hot-pipe'});
 // Valve pedestals leave the downward spout free at the front.
 for(const [tag,x] of [['hot',-45],['cold',70]]){
  cyl(tag+'.valve-stand',tag,x,106,8,2.5,52,{tone:'lo'});
  cyl(tag+'.valve-base',tag,x,106,60,8,3,{tone:'mid'});
  box(tag+'.valve',tag,x-5,101,63,10,10,12,'hi');
  cyl(tag+'.cap',tag,x,111,75,3.8,3,{tone:'hi'});
  const F=G.frameAlong([x,111,69],[0,1,0]);
  put(tag+'.front-port',tag,[x,112.5,69],S(G.disc(0,3,2.8,F,P),{tone:'mid'}),A.disc(F,0,3,2.8,{name:tag+'.front-port'}));
  tube(tag+'.spout-pipe',tag,[[x,114,69],[x,123,69],[x,123,60]],1.85,{material:tag+'-pipe'});
  cyl(tag+'.nozzle',tag,x,123,57,3.1,3,{tone:'hi'});
  ring(tag+'.mouth',tag,x,123,55,1.8,3.1,2,'mid');
  box(tag+'.drip-tray',tag,x-16,109,8,32,27,3,'lo',L(k.planOutline({x:x-13,y:112,w:26,d:21,r:1},11,P),{tone:'faint'}));
  cyl(tag+'.stream',tag,x,123,11,.75,44,{tone:'hi',material:tag+'-stream'});
 }
 A.settle(R,P);R.items.sort((a,b)=>a.key-b.key);
 const particleSlots=new Map(routes.map((r,i)=>[r.name+':0',i]));
 const waterOverlay=`<g data-convection>${Array.from({length:4},(_,i)=>`<circle data-circulate="${i}" r="2.2" fill="var(--heat-ink)"/>`).join('')}</g>`;
 const art=`<path class="iso-halo" d="${k.haloOf(base,-5,8,P)}"/>`+R.items.map(i=>`<g data-core-part="${i.name}" data-core-group="${i.group}" data-material="${i.material}" class="core-part">${i.svg}${i.name==='hot.water'?waterOverlay:''}${particleSlots.has(i.name)?`<circle data-water-flow="${particleSlots.get(i.name)}" r="1.35" opacity="0" fill="${i.material.startsWith('hot')?'var(--heat-ink)':'var(--cold-ink)'}"/>`:''}</g>`).join('');
 const annotations=`<g class="water-labels"><text x="${at([0,30,205])[0]}" y="${at([0,30,205])[1]-12}" text-anchor="middle" class="cold-label">常温储水腔</text><text x="${at([-45,40,103])[0]}" y="${at([-45,40,103])[1]}" text-anchor="middle" class="hot-label">热水内胆</text><text x="${at([-45,40,141])[0]-14}" y="${at([-45,40,141])[1]-9}" text-anchor="end" class="port-label">上部出水</text><text x="${at([-45,17,35])[0]+15}" y="${at([-45,17,35])[1]+5}" class="port-label cold-label">下部补水</text><text x="${at([-45,40,43])[0]}" y="${at([-45,40,43])[1]+7}" text-anchor="middle" class="port-label">电加热件</text></g>`;
 const svg=k.figureSvg({width:W,height:H,label:'温热饮水机水路原理放大：蓝色为常温水，橙色为热罐中的水；热罐下部补水，上部出水。',body:art+annotations});
 const phaseNav=`<nav class="lesson-nav" aria-label="水路演示步骤">${lessons.map((l,i)=>`<button data-phase="${i}" aria-pressed="false"><span>${l[1]}</span>${l[2]}</button>`).join('')}</nav>`;
 const body=`<header><p class="eyebrow">AUX YR-5-A / WATER & HEAT</p><h1>热水在内胆里加热，<br>从内胆上部流出。</h1><p class="lead">常温水主要在顶部水桶和上部储水腔；<strong>热水单独储存在下方热罐。</strong></p></header><div class="water-layout"><div>${k.plateHtml({fig:'FIG. 02',title:'储水 · 加热 · 取水',hint:'颜色表示水温类别',readout:'热水已存入内胆',body:`<div class="water-stage" tabindex="0" role="group" aria-label="水路结构图，左右方向键切换演示步骤">${svg}</div>`})}<div class="water-key"><span><i class="blue"></i>未经加热的水</span><span><i class="orange"></i>热罐中的水</span><span><i class="power"></i>加热件通电时亮起</span><span id="hygiene-key" hidden><i class="hygiene"></i>紫色描边：卫生关注部位</span></div><p class="water-caption">剖面露出水的储存位置。圆点只演示流向与罐内对流，不代表气泡；颜色、比例和播放速度不是实测值。</p></div><aside>${phaseNav}<section class="lesson" aria-live="polite"><p id="lesson-index" class="eyebrow"></p><h2 id="lesson-title"></h2><p id="lesson-claim" class="claim"></p><p id="lesson-detail"></p><div class="status"><span id="power-state"></span><span id="valve-state"></span></div></section><div class="water-controls"><button id="play">播放完整过程</button><button id="appearance">${theme==='light'?'深色':'浅色'}外观</button></div><p class="scope">按上置桶温热型的常见机制解释；YR-5-A 的内部布局、加热件形式和温控阈值待实机资料核对。</p></aside></div><section class="storage-answer"><h2>先认清三个存水的位置</h2><div><article><span>01 / 主要水源</span><h3>顶部大桶</h3><p>储存大部分常温水。通过桶座向机内补水。</p></article><article><span>02 / 分水位置</span><h3>桶座下的储水腔</h3><p>暂存未经加热的水，同时供给常温口和热罐。</p></article><article><span>03 / 加热与保温</span><h3>独立热水内胆</h3><p>存放并加热一部分水。取热水时，下进水、上出水。</p></article></div></section><details class="overview"><summary>在整机里看这些部件的位置</summary><p>外壳依据照片，内部排列为结构示意。主图把部件展开并放大，方便看清管路。</p><div>${overviewSvg}</div></details>${sourceHtml}<footer>温热型 · 热水与常温 &nbsp;/&nbsp; 内部水路机制示意</footer>`;
 const live=`
const P=${JSON.stringify(P)},routes=${JSON.stringify(routes)},lessons=${JSON.stringify(lessons)};
const teachingState=${teachingState.toString()};
const stage=document.querySelector('.water-stage'),root=stage.querySelector('svg'),still=matchMedia('(prefers-reduced-motion:reduce)');
let phase=3,age=0,time=0,playing=false,visible=false,frame=0,last=0,warmth=1;
const flowEls=routes.map((r,i)=>root.querySelector('[data-water-flow="'+i+'"]'));
const chunks=routes.map(r=>r.chunks.map((c,j)=>root.querySelector('[data-core-part="'+r.name+':'+j+'"]')));
const lengths=routes.map(r=>{const sums=[0];for(let i=1;i<r.points.length;i++)sums.push(sums.at(-1)+Math.hypot(...r.points[i].map((v,j)=>v-r.points[i-1][j])));return {sums,total:sums.at(-1)}});
function project(p){const a=P.azimuth*Math.PI/180,e=P.elevation*Math.PI/180,s=P.scale*Math.sqrt(1.6);return [P.origin[0]+s*(p[0]*Math.sin(a)-p[1]*Math.cos(a)),P.origin[1]+s*((p[0]*Math.cos(a)+p[1]*Math.sin(a))*Math.sin(e)-p[2]*Math.cos(e))]}
function along(i,t){const r=routes[i],l=lengths[i],d=t*l.total;let j=1;while(j<l.sums.length-1&&l.sums[j]<d)j++;let f=(d-l.sums[j-1])/(l.sums[j]-l.sums[j-1]);return r.points[j].map((v,k)=>r.points[j-1][k]+(v-r.points[j-1][k])*f)}
function updateText(){const s=teachingState(phase,age);root.dataset.phase=String(phase);stage.setAttribute('aria-label','水路结构图，当前：'+lessons[phase][2]);document.querySelectorAll('[data-phase]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.phase===phase)));document.querySelector('.lesson').setAttribute('aria-live',playing?'off':'polite');document.getElementById('lesson-index').textContent=lessons[phase][1]+' / '+(phase===1?'颜色从蓝转橙表示升温':'结构与流程');document.getElementById('lesson-title').textContent=lessons[phase][2];document.getElementById('lesson-claim').textContent=lessons[phase][3];document.getElementById('lesson-detail').textContent=lessons[phase][4];document.querySelector('[data-readout]').textContent=lessons[phase][5];document.getElementById('power-state').textContent='加热件：'+(s.heater?'通电':'断电');document.getElementById('valve-state').textContent=s.hotOpen?'热水阀开 / 常温阀关':s.coldOpen?'常温阀开 / 热水阀关':'两个取水阀均关闭';root.dataset.heater=s.heater?'on':'off';root.dataset.hotOpen=String(s.hotOpen);root.dataset.coldOpen=String(s.coldOpen);root.dataset.cycle=String(s.cycle??'');document.getElementById('cycle-controls').hidden=phase!==5;document.getElementById('hygiene-key').hidden=phase!==6;document.querySelectorAll('[data-cycle-step]').forEach(el=>el.dataset.active=String(+el.dataset.cycleStep===s.cycle));if(phase===5)document.querySelector('[data-readout]').textContent=['温控接通 · 重新加热','继续升温 · 加热件通电','达到上限 · 温控断开','散热降温 · 等待再次加热'][s.cycle]}
function select(i,manual=true){phase=(i+lessons.length)%lessons.length;age=still.matches&&phase===1?2.25:0;if(phase===1)warmth=0;if(manual){playing=false;syncPlay()}updateText();draw();run()}
const mix=(a,b,t)=>'#'+a.match(/\\w\\w/g).map((v,i)=>Math.round(parseInt(v,16)+(parseInt(b.match(/\\w\\w/g)[i],16)-parseInt(v,16))*t).toString(16).padStart(2,'0')).join('');
function draw(){const s=teachingState(phase,age);if(phase===5&&root.dataset.cycle!==String(s.cycle))updateText();warmth=s.warmth;root.style.setProperty('--water-warmth',String(warmth));const light=document.body.dataset.theme==='light';const cold=light?['d0e7ee','aed6e2','bcdee8','c7e3ec','d9edf1']:['194150','123340','163948','1b4352','245263'];const hot=light?['f3ceb2','dfb18f','e8bc99','f0c5a5','f8d5bb']:['714529','4c2d1d','5a3520','694126','825436'];cold.forEach((v,i)=>root.style.setProperty('--hot-tone-'+i,mix(v,hot[i],warmth)));
flowEls.forEach((el,i)=>{const r=routes[i],on=r.group==='feed'?s.feed:r.group==='hot'?s.hotOpen:r.group==='cold'?s.coldOpen:false;el.style.opacity=on?'1':'0';const t=(time*.17+i*.19)%1,d=t*lengths[i].total,j=r.chunks.findIndex(c=>d>=c.from&&d<=c.to),parent=chunks[i][j<0?chunks[i].length-1:j];if(el.parentNode!==parent)parent.appendChild(el);const [x,y]=project(along(i,t));el.setAttribute('cx',x);el.setAttribute('cy',y)});
root.querySelector('[data-convection]').style.opacity=s.heater?'1':'0';root.querySelectorAll('[data-circulate]').forEach((el,i)=>{const a=time*.8+i*Math.PI/2,az=P.azimuth*Math.PI/180,side=Math.cos(a)*8;const p=[-45+Math.cos(az)*20+Math.sin(az)*side,40+Math.sin(az)*20-Math.cos(az)*side,93+Math.sin(a)*29],q=project(p);el.setAttribute('cx',q[0]);el.setAttribute('cy',q[1])});
}
function tick(now){const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(!still.matches){age+=dt;time+=dt;if(playing&&age>(phase===5?8.5:6.5))select(phase+1,false)}draw();frame=visible&&!document.hidden&&!still.matches&&(playing||phase===1||phase===3||phase===4||phase===5)?requestAnimationFrame(tick):0}
function run(){if(!frame&&visible&&!document.hidden&&!still.matches&&(playing||phase===1||phase===3||phase===4||phase===5)){last=0;frame=requestAnimationFrame(tick)}}
document.querySelectorAll('[data-phase]').forEach(b=>b.addEventListener('click',()=>select(+b.dataset.phase)));
stage.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();select(phase+(e.key==='ArrowRight'?1:-1))}});
function syncPlay(){document.getElementById('play').textContent=still.matches?'下一步':playing?'停止自动切换':'自动切换步骤'}
document.getElementById('play').addEventListener('click',()=>{if(still.matches){select(phase+1);return}playing=!playing;if(playing)select(0,false);syncPlay();run()});
document.getElementById('appearance').addEventListener('click',()=>{const light=document.body.dataset.theme!=='light';document.body.dataset.theme=light?'light':'dark';document.getElementById('appearance').textContent=light?'深色外观':'浅色外观';draw()});
new IntersectionObserver(es=>{visible=es.at(-1).isIntersecting;run()}).observe(stage);document.addEventListener('visibilitychange',run);still.addEventListener('change',()=>{if(still.matches){playing=false}syncPlay();draw();run()});syncPlay();updateText();draw();
`;
 const html=k.pageHtml({title:'奥克斯 YR-5-A · 热水怎样加热和流出',theme,body:body.replace('<footer>','<footer>made by H2O2 / GitHub: 28H2O2 · ').replace('<div class="water-controls">',"<section id=\"cycle-controls\" class=\"cycle-controls\" hidden aria-label=\"温控保温循环\"><div class=\"cycle-step-list\"><span data-cycle-step=\"0\">① 温控接通</span><span data-cycle-step=\"1\">② 继续升温</span><span data-cycle-step=\"2\">③ 温控断开</span><span data-cycle-step=\"3\">④ 散热降温</span></div><button id=\"cycle-next\">手动查看下一阶段</button><p>循环时序、颜色变化为教学演示，不代表本机温度、加热次数或真实耗时。</p></section>"+'<div class="water-controls">').replace('<details class="overview">',safetyHtml+'<details class="overview">'),script:live+safetyLive,width:1180}).replace('lang="en"','lang="zh-CN"').replace('</style>',coreCSS+pageCSS+safetyCSS+'</style>');
 return {html,R,P};
}

const coreCSS=`
.iso{--hygiene-ink:#bd9be8;--cold-ink:#65b4d0;--heat-ink:#e8a36d;--cold-face:#194150;--cold-s0:#123340;--cold-s1:#163948;--cold-s2:#1b4352;--cold-s3:#245263;--hot-tone-0:#714529;--hot-tone-1:#4c2d1d;--hot-tone-2:#5a3520;--hot-tone-3:#694126;--hot-tone-4:#825436}
.iso[data-theme=light]{--hygiene-ink:#7952a8;--cold-ink:#287991;--heat-ink:#a75022;--cold-face:#d0e7ee;--cold-s0:#aed6e2;--cold-s1:#bcdee8;--cold-s2:#c7e3ec;--cold-s3:#d9edf1;--hot-tone-0:#f3ceb2;--hot-tone-1:#dfb18f;--hot-tone-2:#e8bc99;--hot-tone-3:#f0c5a5;--hot-tone-4:#f8d5bb}
[data-material=cold-water] .iso-fill{fill:var(--cold-face)}[data-material=cold-water] .iso-top{fill:var(--cold-s3)}[data-material=cold-water] .iso-shade[data-shade='0']{fill:var(--cold-s0)}[data-material=cold-water] .iso-shade[data-shade='1']{fill:var(--cold-s1)}[data-material=cold-water] .iso-shade[data-shade='2']{fill:var(--cold-s2)}[data-material=cold-water] .iso-shade[data-shade='3']{fill:var(--cold-s3)}[data-material=cold-water] .iso-edge,[data-material=cold-water] .iso-crease{stroke:var(--cold-ink)}
[data-material=hot-water] .iso-fill{fill:var(--hot-tone-0)}[data-material=hot-water] .iso-top{fill:var(--hot-tone-4)}[data-material=hot-water] .iso-shade[data-shade='0']{fill:var(--hot-tone-1)}[data-material=hot-water] .iso-shade[data-shade='1']{fill:var(--hot-tone-2)}[data-material=hot-water] .iso-shade[data-shade='2']{fill:var(--hot-tone-3)}[data-material=hot-water] .iso-shade[data-shade='3']{fill:var(--hot-tone-4)}[data-material=hot-water] .iso-edge,[data-material=hot-water] .iso-crease{stroke:var(--heat-ink)}
[data-material=cold-pipe]{--anatomy-hi:var(--cold-ink)}[data-material=hot-pipe]{--anatomy-hi:var(--heat-ink)}[data-material=hot-stream] .iso-fill,[data-material=hot-stream] .iso-shade,[data-material=hot-stream] .iso-top{fill:var(--heat-ink)}[data-material=cold-stream] .iso-fill,[data-material=cold-stream] .iso-shade,[data-material=cold-stream] .iso-top{fill:var(--cold-ink)}[data-material$=stream]{opacity:0;transition:opacity .3s}svg[data-hot-open=true] [data-material=hot-stream],svg[data-cold-open=true] [data-material=cold-stream]{opacity:1}svg[data-heater=on] [data-material=heater] .iso-fill,svg[data-heater=on] [data-material=heater] .iso-top,svg[data-heater=on] [data-material=heater] .iso-shade{fill:var(--heat-ink)}svg[data-heater=on] [data-material=heater] .iso-edge{stroke:var(--anatomy-lit)}svg[data-heater=on] [data-core-part^="power.cable"]{--anatomy-hi:var(--heat-ink)}
.water-labels text{font:600 11px system-ui;paint-order:stroke;stroke:var(--anatomy-card);stroke-width:3px;stroke-linejoin:round}.cold-label{fill:var(--cold-ink)}.hot-label{fill:var(--heat-ink)}.water-labels .port-label{font-size:9px;fill:var(--anatomy-strong)}.water-labels .port-label.cold-label{fill:var(--cold-ink)}[data-convection]{opacity:0}
`;
const pageCSS=`
.iso-page{width:min(1180px,100% - 48px);margin:42px auto 60px}header{margin-bottom:29px}.eyebrow{font:10px/1.5 var(--anatomy-mono);letter-spacing:.14em;color:var(--anatomy-muted);margin:0 0 14px}h1{font-size:35px;line-height:1.35;letter-spacing:-.035em;font-weight:560;color:var(--anatomy-strong);margin:0 0 16px}.lead{font-size:13px;color:var(--anatomy-text);margin:0}.lead strong{font-weight:500;color:var(--anatomy-strong)}.water-layout{display:grid;grid-template-columns:minmax(0,800px) 310px;gap:38px;align-items:start}.iso-figure{margin:0}.iso-plate{border-radius:8px}.water-stage{outline:none}.water-stage svg{overflow:hidden}.lesson-nav{display:flex;flex-direction:column;border-top:1px solid var(--anatomy-faint)}button{font:inherit;cursor:pointer}button:focus-visible,.water-stage:focus-visible{outline:2px solid var(--cold-ink);outline-offset:3px}.lesson-nav button{border:0;border-bottom:1px solid var(--anatomy-faint);background:none;display:flex;gap:15px;text-align:left;padding:13px 0;color:var(--anatomy-text);font-size:12px}.lesson-nav button span{font:10px var(--anatomy-mono);color:var(--anatomy-muted)}.lesson-nav button[aria-pressed=true]{color:var(--anatomy-strong);font-weight:600}.lesson{margin:24px 0}.lesson .eyebrow{font-size:9px;margin-bottom:8px}h2{font-size:20px;line-height:1.4;font-weight:500;color:var(--anatomy-strong);margin:0 0 13px}.lesson p{font-size:12px;line-height:1.9;color:var(--anatomy-text);margin:0 0 14px}.lesson .claim{font-size:15px;line-height:1.7;color:var(--anatomy-strong)}.status{display:flex;flex-direction:column;gap:7px;border-top:1px solid var(--anatomy-faint);padding-top:14px;font:10px/1.5 var(--anatomy-mono);color:var(--anatomy-muted)}.water-controls{display:flex;gap:8px}.water-controls button{font-size:11px;background:var(--anatomy-card);border:1px solid var(--anatomy-lo);border-radius:5px;padding:7px 11px;color:var(--anatomy-text)}.scope{font-size:10px;line-height:1.9;color:var(--anatomy-muted);margin-top:20px}.water-key{display:flex;flex-wrap:wrap;gap:20px;font-size:10px;margin-top:15px;color:var(--anatomy-text)}.water-key span{display:flex;gap:7px;align-items:center}.water-key i{width:7px;height:7px;border-radius:50%}.hygiene{background:var(--hygiene-ink)}.blue{background:var(--cold-ink)}.orange,.power{background:var(--heat-ink)}.power{border-radius:0!important}.water-caption{font-size:10px;line-height:1.8;color:var(--anatomy-muted);margin:9px 0 0}.storage-answer{margin-top:38px;border-top:1px solid var(--anatomy-faint);padding-top:22px}.storage-answer h2{font-size:16px;margin-bottom:18px}.storage-answer>div{display:grid;grid-template-columns:repeat(3,1fr);gap:30px}.storage-answer article span{font:9px var(--anatomy-mono);color:var(--anatomy-muted)}h3{font-size:14px;font-weight:500;color:var(--anatomy-strong);margin:9px 0 7px}.storage-answer p{font-size:11px;color:var(--anatomy-text);margin:0}.overview,.sources{margin-top:25px;border-top:1px solid var(--anatomy-faint);padding-top:16px}.overview summary,.sources summary{font-size:11px;cursor:pointer}.overview p,.sources p,.sources li{font-size:10px;line-height:1.9}.overview .cover{display:none}.overview>div{width:min(350px,100%);margin:20px auto}.sources a{color:var(--anatomy-text);text-underline-offset:3px}footer{margin-top:28px;font:10px var(--anatomy-mono);color:var(--anatomy-muted)}@media(max-width:800px){.iso-page{width:calc(100% - 28px);margin:27px auto}h1{font-size:28px}.lead{font-size:12px;line-height:1.9}.water-layout{grid-template-columns:1fr;gap:22px}.lesson-nav{display:grid;grid-template-columns:1fr 1fr;gap:0 15px}.lesson-nav button{gap:9px;font-size:11px}.iso-plate-corner{font-size:9px}.storage-answer>div{grid-template-columns:1fr;gap:18px}.water-key{gap:11px}.scope{margin-bottom:0}.water-labels text{font-size:13px}}@media(prefers-reduced-motion:reduce){[data-material$=stream]{transition:none}}
`;
