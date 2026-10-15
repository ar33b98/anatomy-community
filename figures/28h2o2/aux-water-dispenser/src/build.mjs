import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as k from '../../../../.skill/kit/iso-kit.mjs';
import * as G from '../../../../.skill/kit/lathe.mjs';
import * as A from '../../../../.skill/kit/audit.mjs';
import { tubePieces, tubeSvg } from '../../../../.skill/kit/tube.mjs';
import {makeWaterway} from './waterway.mjs';
import {english} from './english.mjs';

const HERE=dirname(fileURLToPath(import.meta.url));
const theme=process.argv.includes('--light')?'light':'dark';
const W=700,H=880;
const P=k.fitProjection([[-96,0,-7],[66,120,-7],[-60,0,312],[60,110,312],[-54,-4,508],[54,104,508]],W,H,{pad:60,azimuth:62,elevation:18});
const R=A.recorder(P);
const at=p=>k.iso(p,P), S=k.solidSvg, L=k.lineSvg;
function put(name,group,center,svg,shape,cls=''){
  R.put({name,piece:'machine',at:center,group,cls,svg,shapes:[R.solid(shape)]});
}
function box(name,group,x,y,z,w,d,h,{tone='mid',r=.4,extra='',inner='',cls='',bevel=.4}={}){
 const plan={x,y,w,d,r};
 put(name,group,[x+w/2,y+d/2,z+h/2],S(k.slabOf(plan,z,h,P,6,bevel),{tone,inner})+extra,A.slab(plan,z,h,{name},6),cls);
}
function cyl(name,group,x,y,z,r,h,{tone='mid',extra='',inner='',cls='',bevel=.3}={}){
 put(name,group,[x,y,z+h/2],S(k.cylinder(x,y,r,z,h,P,72,bevel),{tone,inner})+extra,A.cylinder(x,y,r,z,h,{name}),cls);
}
function turned(name,group,F,profile,{tone='mid',extra='',inner='',cls='',smooth=false}={}){
 const opts={smooth,steps:96};
 put(name,group,G.add3(F.o,G.mul3(F.a,(profile[0][0]+profile.at(-1)[0])/2)),S(G.solidOf(profile,F,P,opts),{tone,inner})+extra,A.solid(F,profile,{name,radius:smooth?.radius}),cls);
}
function ring(name,group,x,y,z,ri,ro,h,{tone='mid',cls='',extra=''}={}){
 const F=G.frameAlong([x,y,z],[0,0,1]);
 put(name,group,[x,y,z+h/2],S(G.ringBand(0,h,ri,ro,F,P,{steps:96}),{tone})+extra,A.ring(F,0,h,ri,ro,{name}),cls);
}
function arcShell(name,group,x,y,z,ri,ro,h,{tone='mid',start=145,end=325,cls=''}={}){
 const points=[];
 for(let i=0;i<=72;i++){let a=(start+(end-start)*i/72)*Math.PI/180;points.push([x+ro*Math.cos(a),y+ro*Math.sin(a)]);}
 for(let i=72;i>=0;i--){let a=(start+(end-start)*i/72)*Math.PI/180;points.push([x+ri*Math.cos(a),y+ri*Math.sin(a)]);}
 put(name,group,[x,y,z+h/2],S(k.extrude(points,z,h,P,{convex:false}),{tone}),A.extruded(points,z,h,{name}),cls);
}
const flowRoutes=[];
function tube(name,group,points,r,{tone='mid',flow=false,limp=false}={}){
 const route=G.fillet(points,Math.max(5,r*3.5),14,{P,tube:r});
 R.route(name,route,r,{piece:'machine',limp});
 const chunks=tubePieces(route,r,P,{maxLength:12,spacing:1.1});
 chunks.forEach((t,i)=>{
  R.put({name:name+':'+i,piece:'machine',at:t.mid,group,svg:tubeSvg(t,{tone}),shapes:[A.tube(t.points,t.radii)],route:name,chunk:i});
 });
 if(flow)flowRoutes.push({name,group,points:route,chunks:chunks.map(({from,to})=>({from,to}))});
}
function screws(plan,z){return L(k.corners(plan,4).map(([x,y])=>k.ring(x,y,1.05,z,P,20)).join(''),{tone:'lo'})+k.dotsSvg(k.corners(plan,4).map(([x,y])=>at([x,y,z])),{size:.35,tone:'mid'});}
const base={x:-61,y:0,w:122,d:112,r:2};
// Frame and visible cabinet features.
for(const [i,[x,y]] of [[-48,14],[48,14],[-48,98],[48,98]].entries())cyl('stand.foot'+i,'frame',x,y,-6,5.5,6,{tone:'lo'});
box('stand.base','frame',-61,0,0,122,112,8,{r:2,tone:'lo',inner:L(k.sideSeam(base,4,P,6),{tone:'faint'}),extra:screws(base,8)});
box('frame.back','frame',-61,0,8,122,3,298,{tone:'lo',extra:L([-51,51].map(x=>k.pathOf([[x,3,132],[x+2,3,132],[x+2,3,265],[x,3,265]].map(at),true)).join(''),{tone:'faint'})});
box('frame.left','frame',-61,3,8,3,109,298,{tone:'lo'});
box('frame.side','frame',58,3,8,3,109,298,{tone:'mid',cls:'cover',extra:L([183,190,197,204,211].map(z=>k.pathOf([[61,25,z],[61,74,z],[61,74,z+2],[61,25,z+2]].map(at),true)).join(''),{tone:'lo'})});
box('frame.lower-door','frame',-58,108,8,116,3,109,{tone:'mid',inner:L(k.sideSeam({x:-58,y:108,w:116,d:3,r:.4},14,P,6),{tone:'faint'})});
box('frame.lower-shelf','frame',-58,3,64,116,105,2,{tone:'lo',extra:L(k.planOutline({x:-54,y:7,w:108,d:97,r:1},66,P),{tone:'faint'})});
box('frame.tray-shelf','frame',-58,3,117,116,105,4,{tone:'lo'});
for(const [x,y] of [[-58,103],[55,103]]){
 box('frame.front-post-lower'+x,'frame',x,y,121,3,5,105,{tone:'lo'});
 box('frame.front-post-upper'+x,'frame',x,y,230,3,5,76,{tone:'lo'});
}
box('frame.upper-front-rail','frame',-58,105,226,116,3,4,{tone:'mid'});
box('frame.upper-rear-rail','frame',-58,3,272,116,5,2,{tone:'lo'});
box('frame.top','frame',-61,0,306,122,112,4,{tone:'mid',extra:screws(base,310)});
box('frame.front-panel','frame',-58,108,230,116,3,76,{tone:'hi',cls:'cover',extra:k.faceTextSvg(k.sideMatrix([-51,111],297,P,'left'),'AUX',{size:4.7,tone:'mid'})});
for(const [i,x] of [-17,0,17].entries())box('control.indicator'+i,'control',x-3.4,111,276,6.8,.8,7,{tone:'lo',cls:'cover'});
// Open front door follows the photographed left hinge. No hidden-line or ghost shell.
box('frame.open-door','frame',-95,112,122,37,3,102,{tone:'lo',r:0});
for(const z of [132,208])box('frame.hinge'+z,'frame',-58,108,z,3,7,10,{tone:'mid',r:0});
box('outlet.tray','outlet',-53,52,121,106,52,3,{r:3,tone:'mid',extra:L(k.planOutline({x:-49,y:56,w:98,d:44,r:2},124,P),{tone:'lo'})});
for(const [i,x] of [-26,27].entries())ring('outlet.rest-ring'+i,'outlet',x,78,124,19.6,21,1,{tone:'lo'});
// Bottle: axial segments are split at the raised bands, so no band penetrates a body.
ring('bottle.seat','bottle',0,50,310,13,24,3,{tone:'hi'});
ring('bottle.seal','bottle',0,50,313,13,18,1.4,{tone:'lo'});
cyl('bottle.neck','bottle',0,50,314.4,13,13.6,{tone:'hi'});
const BF=G.frameAlong([0,50,0],[0,0,1]);
turned('bottle.shoulder','bottle',BF,[[328,13],[344,33],[356,52]],{tone:'mid'});
cyl('bottle.lower-band','bottle',0,50,356,54,8,{tone:'mid',inner:L(k.sideArc(0,50,54,359,P,72),{tone:'lo'})});
cyl('bottle.lower-body','bottle',0,50,364,52,41,{tone:'mid',inner:L(k.sideArc(0,50,52,396,P,72),{tone:'faint'})});
cyl('bottle.middle-band','bottle',0,50,405,54,8,{tone:'mid'});
cyl('bottle.middle-body','bottle',0,50,413,52,50,{tone:'hi',inner:L(k.sideArc(0,50,52,452,P,72),{tone:'faint'})});
cyl('bottle.upper-band','bottle',0,50,463,54,8,{tone:'mid'});
cyl('bottle.upper-body','bottle',0,50,471,52,16,{tone:'mid'});
const radius=s=>52*Math.sqrt(Math.max(0,1-((s-487)/20)**2));
const slope=s=>s>=507?-1000:-52*(s-487)/(400*Math.sqrt(Math.max(1e-8,1-((s-487)/20)**2)));
turned('bottle.bottom','bottle',BF,Array.from({length:33},(_,i)=>[487+i*20/32,radius(487+i*20/32),1]),{tone:'mid',smooth:{radius,slope}});
// Supply reservoir attaches to the top cover. Its lower face is the two branch ports.
cyl('reservoir.base','reservoir',0,50,274,37,3,{tone:'mid'});
cyl('reservoir.body','reservoir',0,50,277,37,26,{tone:'mid',inner:L(k.sideArc(0,50,37,296,P,72),{tone:'lo'})});
cyl('reservoir.lid','reservoir',0,50,303,37,3,{tone:'hi'});
// Hot tank supported by two mounting rails; the centre stays open for its lower inlet.
box('hot.mount-L','hot',-47,3,199,6,64,3,{tone:'lo'});
box('hot.mount-R','hot',-3,3,199,6,64,3,{tone:'lo'});
cyl('hot.bottom','hot',-22,38,202,21,3,{tone:'hi'});
arcShell('hot.tank-wall','hot',-22,38,205,19.6,21,56,{tone:'hi'});
arcShell('hot.insulation','hot',-22,38,205,21,23,56,{tone:'lo'});
cyl('hot.top','hot',-22,38,261,21,3,{tone:'hi',inner:L(k.ring(-22,38,17,264,P,72),{tone:'lo'})});
// Illustrative base-contact heater, matching the enlarged water-path figure.
// Its annular mounting plate leaves the central lower inlet clear.
arcShell('hot.heater-base-back','hot',-22,38,200,6,14,2,{tone:'mid'});
arcShell('hot.heater-base-front','hot',-22,38,200,6,14,2,{tone:'mid',start:325,end:505});
arcShell('hot.heater-back','hot',-22,38,197,9,11,3,{tone:'hi'});
arcShell('hot.heater-front','hot',-22,38,197,9,11,3,{tone:'hi',start:325,end:505});
cyl('hot.heater-contact','hot',-12,38,194,2,3,{tone:'mid'});
// Flat-faced couplings are drawn at actual tube terminals.
for(const [name,x,y,z] of [['cold.source',30,64,271],['hot.source',15,40,271],['hot.inlet',-22,38,199],['hot.vent0',-22,32,264],['hot.vent1',-22,32,271]])cyl(name,name.startsWith('cold')?'cold':'hot',x,y,z,3.4,3,{tone:'mid'});
cyl('hot.outlet-neck','hot',-22,46,264,1.4,2.929,{tone:'mid'});
put('hot.outlet-elbow','hot',[-22,46,269],S(G.sphereOf([-22,46,269],2.5,P),{tone:'mid'}),A.ball([-22,46,269],2.5,{name:'hot.outlet-elbow'}));
tube('cold.pipe','cold',[[30,64,271],[30,64,248],[30,99,248],[30,99,234]],1.65,{tone:'hi',flow:true});
tube('hot.feed','hot',[[15,40,271],[15,40,180],[-22,38,180],[-22,38,199]],1.6,{tone:'mid',flow:true});
tube('hot.pipe','hot',[[-22,47.878,269],[-22,99,269],[-22,99,234]],1.65,{tone:'hi',flow:true});
tube('hot.vent','hot',[[-22,32,267],[-22,32,271]],1.2,{tone:'lo'});
// Outlets and valve internals are mounted on one cross-bracket.
box('outlet.support','outlet',-58,91,225,116,3,3,{tone:'lo'});
for(const [tag,x] of [['hot',-22],['cold',30]]){
 cyl(tag+'.valve-body',tag,x,99,225,5,7,{tone:'hi'});
 cyl(tag+'.valve-cap',tag,x,99,232,5.3,2,{tone:'mid'});
 // A tube meets the top cap face at z232; this disc is the valve's visual collar.
 cyl(tag+'.stem',tag,x,99,220,2.4,5,{tone:'mid'});
 cyl(tag+'.spout',tag,x,99,214,3.3,6,{tone:'hi'});
 ring(tag+'.spout-rim',tag,x,99,212.5,1.6,3.3,1.5,{tone:'mid'});
}
// Thermostats land on a mounting pad, rather than intersecting the round tank.
box('control.thermo-pad','control',-5,34,264,8,8,2,{tone:'mid'});
box('control.thermostat','control',-4,34,266,3,8,6,{tone:'hi'});
box('control.overheat','control',0,34,266,3,8,5,{tone:'hi'});
// Functionally representative wiring panel on an anchored tray at the rear right.
box('control.bracket','control',35,3,263,20,32,2,{tone:'lo'});
for(const [i,[x,y]] of [[39,7],[51,7],[39,30],[51,30]].entries())cyl('control.standoff'+i,'control',x,y,265,1.6,3,{tone:'mid'});
const PCB={x:37,y:5,w:16,d:28,r:1};
box('control.board','control',37,5,268,16,28,1.2,{tone:'mid',r:1,extra:screws(PCB,269.2)});
box('control.switch','control',39,8,269.2,5,8,5,{tone:'mid'});
box('control.terminals','control',39,24,269.2,12,5,3,{tone:'mid'});
box('control.circuit','control',46,9,269.2,5,5,1.8,{tone:'mid'});
cyl('control.capacitor','control',48.5,18.5,269.2,2,4,{tone:'mid'});
box('control.connector','control',39,19,269.2,5,3,2,{tone:'mid'});
// Rear wiring is supported by the chassis, without inventing a pump or cooling system.
box('control.power-entry','control',38,3,145,12,4,13,{tone:'mid'});
box('control.wire-terminal','control',42,7,151,4,2,3,{tone:'mid'});
box('control.board-terminal','control',42,5,265,4,2,3,{tone:'mid'});
tube('control.harness','control',[[44,9,152],[44,16,152],[44,16,253],[44,5,253],[44,5,265]],.65,{tone:'lo',limp:true});
// The drawing and the audit use exactly the same shapes.
A.settle(R,P);
R.items.sort((a,b)=>a.key-b.key);
const renderItems=()=>R.items.map(i=>`<g data-assembly="${i.group}" data-name="${i.name}" class="part ${i.cls||''}">${i.svg}</g>`).join('');
const halo=`<path class="iso-halo" d="${k.haloOf(base,-6,8,P)}"/>`;
const art=halo+renderItems();
const svg=k.figureSvg({width:W,height:H,label:'奥克斯 YR-5-A 温热饮水机结构示意：水桶、聪明座、上部储水腔、常温支路、机内热罐、热水支路和温控电路。内部布局为同类机制推定。',body:art+flowRoutes.map((r,i)=>`<circle data-flow="${i}" r="1.2" fill="var(--anatomy-lit)" opacity="0"/>`).join('')});
const sourceHtml=`<details class="sources"><summary>绘图依据与来源</summary><p>型号 YR-5-A、热水／常温、无烧水壶：由用户确认。外壳依据提供的照片；剖开后的布局为同类机制推定，未取得本机原厂拆机图。</p><ol><li><span class="research-link">CN2539462Y · 分水池与冷热支路</span>：只采用常温和热水拓扑。</li><li><span class="research-link">CN205963801U · 传统饮水机背景结构</span>：上槽分水、热罐下进上出。</li><li><span class="research-link">CN223041337U · 桶座进气与补水</span>：桶口封水与补气关系。</li><li><span class="research-link">CN201510145U · 传统热罐加热机制</span>：加热件与温控。</li></ol><p>没有画制冷、过滤或杀菌系统。几何比例、元件数量与动画时序仅服务于讲解，不代表实测值或原厂物料清单。</p></details>`;
const waterway=makeWaterway({theme,overviewSvg:svg,sourceHtml});
writeFileSync(join(HERE,theme==='light'?'dispenser-light.html':'dispenser.html'),english(waterway.html));
A.auditOrExit(R,P);
A.auditOrExit(waterway.R,waterway.P);
