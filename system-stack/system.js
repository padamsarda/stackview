import {createViewer,toolbar,THREE} from './viewer3d.js';
const $=s=>document.querySelector(s),v=createViewer($('#view')),groups={},errors=[];
const mm=x=>x/1000,P=p=>new THREE.Vector3(...p.map(mm)),mats={};
const material=c=>mats[c]??=new THREE.MeshStandardMaterial({color:c,metalness:.35,roughness:.5});
function box(g,s,p,c){const o=new THREE.Mesh(new THREE.BoxGeometry(...s.map(mm)),material(c));o.position.copy(P(p));g.add(o);return o;}
function tube(g,ps,c,r=.7){const o=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ps.map(P),false,'centripetal'),32,mm(r),6,false),material(c));g.add(o);}
function cyl(g,r,h,p,c){const o=new THREE.Mesh(new THREE.CylinderGeometry(mm(r),mm(r),mm(h),24),material(c));o.position.copy(P(p));g.add(o);return o;}
const defs=[['camera','Camera CAD',297],['obc','OBC',257],['payload','Payload transceiver / TTC',222],['adcs','ADCS',200],['wheels','Wheel mount + placeholder PCB',154],['power','Power PCB placeholder',113],['battery','Battery board',95],['beacon','EPS–Beacon',10],['ads','Deployment housing',-15],['fss','Fine sun sensor',0],['ant','170 mm turnstile arms',0],['solar','Four deployed solar wings',0],['css','Four coarse sun sensors',235],['wires','Side harnesses',0],['rails','Guard rails / body outline',0]];
for(const [id,name,y] of defs){const g=new THREE.Group();g.name=name;g.userData={fit:true,y};groups[id]=g;v.scene.add(g);}
let state={spread:0,css:0,hidden:[]};try{state={...state,...JSON.parse(location.hash?decodeURIComponent(location.hash.slice(1)):localStorage.getItem('anant-system-stack-v2')||'{}')}}catch{}state.spread=Math.max(0,Math.min(40,Number(state.spread)||0));state.css=Math.max(0,Math.min(60,Number(state.css)||0));if(!Array.isArray(state.hidden))state.hidden=[];
const detailHidden=new Set();
const fit=()=>Object.values(groups).filter(g=>g.visible);$('#view').append(...toolbar(v,fit));$('#branch').textContent='system-stack';$('#toggle-side').onclick=()=>$('#side').classList.toggle('collapsed');
box(groups.adcs,[12,5,5],[85,4,-30],0xe7e1cc);
// Compact 50 x 50 x 6 mm ADS with central coax feed-through.
const adsShape=new THREE.Shape();adsShape.moveTo(-25,-25);adsShape.lineTo(25,-25);adsShape.lineTo(25,25);adsShape.lineTo(-25,25);adsShape.closePath();const feedHole=new THREE.Path();feedHole.absarc(0,0,3,0,Math.PI*2,true);adsShape.holes.push(feedHole);const adsMesh=new THREE.Mesh(new THREE.ExtrudeGeometry(adsShape,{depth:6,bevelEnabled:false,curveSegments:24}),material(0x727d88));adsMesh.scale.setScalar(.001);adsMesh.rotation.x=Math.PI/2;adsMesh.position.copy(P([43,0,-36.83]));groups.ads.add(adsMesh);
box(groups.fss,[35,14,24],[43,-34,-3],0xb8bdc3);cyl(groups.fss,7.5,7.68,[43,-44.84,-3],0x272c33);cyl(groups.fss,5.5,.6,[43,-49,-3],0x10203e);box(groups.fss,[12,4,4],[43,-33,11],0xe8e1d0);
box(groups.ant,[12,4,12],[43,-29,-36.83],0x282c33);for(let i=0;i<4;i++){let a=Math.PI/4+i*Math.PI/2;tube(groups.ant,[[43,-32,-36.83],[43+170*Math.cos(a),-32,-36.83+170*Math.sin(a)]],0xc09a78,.5);}
for(let i=0;i<4;i++){const g=new THREE.Group();g.position.copy(P([43,-12,-36.83]));g.rotation.y=i*Math.PI/2;g.name='Solar wing '+(i+1);groups.solar.add(g);box(g,[80,1.6,300],[0,0,202],0x494331);for(let j=0;j<7;j++){box(g,[70,.3,38],[0,-1.05,73+42*j],0x152b53);for(let k=0;k<6;k++)box(g,[.15,.1,37],[-29+k*11.6,-1.25,73+42*j],0x8293b0);}for(const x of [-27,27])cyl(g,3,12,[x,0,52],0xb0b7bd).rotation.z=Math.PI/2;}
for(const [x,z] of [[0,0],[85.73,3.81],[85.73,-76.2],[0,-73.66]])cyl(groups.rails,1.45,320,[x,170,z],0x8b969e);
const inputBlocks=[[43,10],[90,-36.83],[43,-84],[-4,-36.83]];for(const [x,z] of inputBlocks)box(groups.power,[7,5,7],[x,4,z],0x3b4858);

// Female PACK socket placeholder on the underside of the power PCB.
// J12 model transform: (119.6,1.595,129.2) mm, +90 deg around Y.
// Socket centers align with its 2 x 2, 3 mm-pitch contacts.
// At the 18 mm PCB spacing the open mating face is at battery Y + 11.5 mm.
const packSocket=new THREE.Group();packSocket.name='Female PACK connector';
packSocket.position.copy(P([20.325,0,-77.385]));groups.power.add(packSocket);
box(packSocket,[8,1,7.5],[0,-.5,0],0x242832);
for(const x of [-3.5,3.5])box(packSocket,[1,5.5,7.5],[x,-3.75,0],0x242832);
for(const z of [-3.25,3.25])box(packSocket,[6,5.5,1],[0,-3.75,z],0x242832);
box(packSocket,[.6,5.5,5.5],[0,-3.75,0],0x242832);
box(packSocket,[6,5.5,.6],[0,-3.75,0],0x242832);
for(const x of [-1.5,1.5])for(const z of [-1.5,1.5])
  box(packSocket,[.8,.5,.8],[x,-2,z],0xbd9b50);
box(packSocket,[1.2,3,2],[4,-2.5,0],0x343a42);

function wires(){const g=groups.wires;for(const o of [...g.children]){g.remove(o);o.geometry?.dispose();}const Y=id=>groups[id].position.y*1000,a=Y('adcs'),p=Y('power'),b=Y('battery'),o=Y('obc');tube(g,[[43,-33,11],[98,-25,11],[98,a,-30],[85,a+4,-30]],0x252932,1);for(let i=0;i<4;i++){let angle=i*Math.PI/2,x=43+57*Math.sin(angle),z=-36.83+57*Math.cos(angle),end=inputBlocks[i];tube(g,[[x,-12,z],[x,0,z],[x,p+5,z],[end[0],p+5,end[1]]],0xab7844,.8);}tube(g,[[56.3,Y('beacon')+4,-63.18],[43,Y('beacon')+6,-36.83],[43,-15,-36.83],[43,-29,-36.83]],0x252932,.8);const targets=[[8.01,4.94],[74.05,4.94],[86.5,-64.97],[75.26,-76.594]];const available=new Set([0,1,2,3]);groups.css.updateMatrixWorld(true);groups.css.children.forEach(c=>{if(!c.userData.connector)return;const q=c.userData.connector.localToWorld(c.userData.connectorPoint.clone()).multiplyScalar(1000);const j=[...available].sort((i,j)=>Math.hypot(q.x-targets[i][0],q.z-targets[i][1])-Math.hypot(q.x-targets[j][0],q.z-targets[j][1]))[0];available.delete(j);const t=targets[j];tube(g,[[q.x,q.y,q.z],[q.x,o-9,q.z],[t[0],o-9,t[1]],[t[0],o+3,t[1]]],0xd7d4c1,.6);});}

function layout(){defs.forEach(([id,,y],i)=>{groups[id].visible=!state.hidden.includes(id);groups[id].position.y=mm(y+(i<9?state.spread*(8-i):0));});groups.css.position.y=groups.obc.position.y;groups.css.children.forEach((g,i)=>{const a=i*Math.PI/2;g.position.x=mm(43+(55+state.css)*Math.cos(a));g.position.z=mm(-36.83+(55+state.css)*Math.sin(a));});wires();try{localStorage.setItem('anant-system-stack-v2',JSON.stringify(state))}catch{}v.requestRender();}
function panel(){$('#side').innerHTML='<h3>System assembly</h3><p class="small muted">Camera to antenna end · integration study</p><div id="list"></div><label class="field">Explode <input id="spread" type="range" min="0" max="40"></label><label class="field">CSS spread <input id="css" type="range" min="0" max="60"></label><button class="btn" id="reset">Reset</button> <button class="btn" id="copy">Copy view</button><details><summary>Assumptions / open interfaces</summary><p class="small">Current study exceeds the 3U length envelope; camera orientation and packing must be resolved. Board spacing and mount alignment are provisional. Power/wheel PCBs, hinges, connectors and cable endpoints are placeholders. Camera PC104 mating requires verification. Solar cells are representative 70 × 38 mm geometry. Four antenna arms are 170 mm each; diameter assumed 1 mm. FSS uses CubeSense Sun M2.1E4.5 ICD 1.02 indicative dimensions. PC104 cable bridges deferred.</p><a href="https://www.cubespace.co.za/uploads/ef058ab7-ccf6-4993-97e2-fd3025567b3d.pdf">FSS interface document</a></details><p id="status" class="small">Loading CAD…</p>';for(const[id,name]of defs){let l=document.createElement('label');l.className='field';let c=document.createElement('input');c.type='checkbox';c.checked=!state.hidden.includes(id);c.onchange=()=>{state.hidden=c.checked?state.hidden.filter(x=>x!==id):[...state.hidden,id];layout();};l.append(c,document.createTextNode(name));$('#list').append(l);}for(const k of ['spread','css']){$('#'+k).value=state[k];$('#'+k).oninput=e=>{state[k]=+e.target.value;layout();};}$('#reset').onclick=()=>{state={spread:0,css:0,hidden:[]};panel();layout();v.fit(fit());};$('#copy').onclick=async()=>{location.hash=encodeURIComponent(JSON.stringify(state));try{await navigator.clipboard.writeText(location.href)}catch{}};}
const site=await(await fetch('site.json')).json(),boards=Object.fromEntries(site.boards.map(b=>[b.id,b]));panel();layout();
// The standards export has two disconnected PCBs. Keep only the right-hand
// PCB containing the declared PC104 anchor; no triangles cross x = 170 mm.
function singleStandardPCB(model){
  model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const geometry=mesh.geometry.clone(),position=geometry.getAttribute('position');
    const index=geometry.getIndex(),kept=[],bounds=new THREE.Box3();
    const count=index?index.count:position.count;
    for(let i=0;i<count;i+=3){
      const tri=[0,1,2].map(k=>index?index.getX(i+k):i+k);
      if(tri.every(j=>position.getX(j)>.170)){
        kept.push(...tri);
        for(const j of tri)bounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(position,j));
      }
    }
    geometry.setIndex(kept);
    geometry.boundingBox=bounds;
    geometry.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());
    mesh.geometry=geometry;
    mesh.visible=kept.length>0;
  });
}
async function board(id,src){const b=boards[src];if(!b?.glb)throw Error(src+' unavailable');let m=await v.load(b.glb);if(src==='pc104')singleStandardPCB(m);m.position.set(-mm(b.stack.x),0,-mm(b.stack.y));const pivot=new THREE.Group();pivot.rotation.y=-b.stack.rot*Math.PI/180;pivot.add(m);groups[id].add(pivot);}
async function cad(id,file){const m=await v.load('assembly/'+(file==='camera'?'camera-opt':file)+'.glb'),b=new THREE.Box3().setFromObject(m),c=b.getCenter(new THREE.Vector3());m.position.set(mm(43)-c.x,id==='mount'?-b.max.y:-b.min.y+mm(id==='wheels'?3:0),mm(-36.83)-c.z);groups[id].add(m);if(id==='camera')groups[id].visible=true;groups[id].userData.cadBounds={min:b.min.toArray(),max:b.max.toArray()};}
const jobs=[...['obc','payload','adcs','battery'].map(id=>[id,()=>board(id,id)]),['beacon',()=>board('beacon','beacon-eps')],...['camera','wheels'].map(id=>[id,()=>cad(id,id)]),['power',()=>board('power','pc104')],['wheels-standard',()=>board('wheels','pc104')],['css',async()=>{const m=await v.load(boards.css.glb),b=new THREE.Box3().setFromObject(m);m.position.copy(b.getCenter(new THREE.Vector3()).negate());for(let i=0;i<4;i++){let g=new THREE.Group(),p=new THREE.Group();p.add(m.clone(true));p.rotation.order="YXZ";p.rotation.x=Math.PI/2;p.rotation.y=Math.PI/2-i*Math.PI/2;box(g,[6,4,4],[0,-5,0],0xe3dfd0);g.name='CSS '+(i+1);g.userData.connector=p;g.userData.connectorPoint=P([175.435, -2,87.345]).add(m.position);g.add(p);groups.css.add(g);}}]];
await Promise.all(jobs.map(async([id,fn])=>{try{await fn()}catch(e){errors.push(id+': '+e.message)}}));layout();v.fit(fit(),new THREE.Vector3(.9,.7,1.3),false);$('#status').textContent=errors.length?errors.join('; '):'Loaded · provisional mechanical fit';for(const id of ['solar','css']){const d=document.createElement('details');const title=document.createElement('summary');title.textContent='Individual '+id;d.append(title);groups[id].children.forEach((g,i)=>{const label=document.createElement('label');label.className='field';const input=document.createElement('input');input.type='checkbox';input.checked=true;input.onchange=()=>{g.visible=input.checked;v.requestRender();};label.append(input,document.createTextNode(g.name));d.append(label);});$('#side').append(d);}window.systemAssembly={groups,state,viewer:v,errors};

