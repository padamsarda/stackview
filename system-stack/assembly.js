import {createViewer,toolbar,THREE,CSS2DObject} from './viewer3d.js?v=cases5';
import {CASES,ROD_LENGTH,ROD_RADIUS,HOLES,packLevels} from './assembly-config.mjs?v=cases5';
const $=s=>document.querySelector(s);
const caseId=new URLSearchParams(location.search).get('case')==='2'?2:1,config=CASES[caseId];
const mobile=matchMedia('(max-width:760px)');
$('#side').classList.toggle('collapsed',mobile.matches);
$('#title').textContent=config.title+' · System stack';
$('#case-name').textContent=config.subtitle;
document.title=config.title+' · AnantSAT system stack';
let v;
try{v=createViewer($('#view'),{stack:true})}catch(e){
  $('#loading').textContent='3D rendering could not start. Enable hardware acceleration / WebGL in your browser, then reload.';
  throw e;
}
const groups={},errors=[],mats={},labels=[],root=new THREE.Group();
root.userData.fit=true;root.name='Complete spacecraft assembly';v.scene.add(root);
const mm=x=>x/1000,P=p=>new THREE.Vector3(...p.map(mm));
const material=c=>mats[c]??=new THREE.MeshLambertMaterial({color:c});
function box(g,s,p,c){const o=new THREE.Mesh(new THREE.BoxGeometry(...s.map(mm)),material(c));o.position.copy(P(p));g.add(o);return o;}
function cyl(g,r,h,p,c){const o=new THREE.Mesh(new THREE.CylinderGeometry(mm(r),mm(r),mm(h),24),material(c));o.position.copy(P(p));g.add(o);return o;}
function tube(g,ps,c,r=.7){
  const curve=new THREE.CatmullRomCurve3(ps.map(P),false,'centripetal');
  const o=new THREE.Mesh(new THREE.TubeGeometry(curve,32,mm(r),6,false),material(c));g.add(o);return o;
}
const defs=[
 ['camera','Camera + payload PCB'],['obc','OBC'],['payload','TTC'],
 ['adcs','ADCS'],['wheels','Reaction wheels + placeholder PCB'],['power','Power PCB placeholder'],
 ['battery','Battery board + mount'],['beacon','EPS–Beacon + magnetorquers'],
 ['ads','ADS housing'],['fss','Fine sun sensor'],['ant','Cu–Be turnstile · 170 mm arms'],
 ['solar','Solar wings'],['css','Coarse sun sensors'],['wires','Harnesses'],['rails','Stack rods']];
for(const[id,name]of defs){const g=new THREE.Group();g.name=name;groups[id]=g;root.add(g);}
const defaults=()=>({spread:0,css:0,hidden:[],detailsHidden:[],flip:false,labels:true,opacity:.55});
const key='anant-system-case-'+caseId+'-v4';
let state=defaults();
try{state={...state,...JSON.parse(location.hash?decodeURIComponent(location.hash.slice(1)):localStorage.getItem(key)||'{}')}}catch{}
for(const [k,max]of [['spread',40],['css',60]])state[k]=Math.max(0,Math.min(max,Number(state[k])||0));
state.opacity=Math.max(.15,Math.min(1,Number(state.opacity)||.55));
state.hidden=Array.isArray(state.hidden)?state.hidden:[];
state.detailsHidden=Array.isArray(state.detailsHidden)?state.detailsHidden:[];
state.flip=state.flip===true;state.labels=state.labels!==false;
let ready=false,report=null,bounds={},cssRadius=55,wingY=0,adsY=0,antY=0,fssY=0;
let initialFit=true,lastFocus=mobile.matches?'stack':'all';
const core=()=>config.order.map(id=>groups[id]).filter(g=>g.visible);
const all=()=>Object.values(groups).filter(g=>g.visible);
function focus(kind=lastFocus,animate=true){
  lastFocus=kind;
  v.fit(kind==='stack'?core():all(),new THREE.Vector3(.95,.45,1.3),animate);
  $('#focus-stack').classList.toggle('on',kind==='stack');
  $('#fit-all').classList.toggle('on',kind==='all');
}
$('#view').append(...toolbar(v,all));
$('#focus-stack').onclick=()=>focus('stack');
$('#fit-all').onclick=()=>focus('all');
$('#flip').onclick=()=>{state.flip=!state.flip;layout();focus();};
$('#labels-toggle').onclick=()=>{state.labels=!state.labels;layout();};
$('#toggle-side').onclick=()=>{
  const collapsed=$('#side').classList.toggle('collapsed');
  $('#toggle-side').setAttribute('aria-expanded',String(!collapsed));
  if(!mobile.matches)requestAnimationFrame(()=>focus(lastFocus,false));
};
const closeDrawer=()=>{$('#side').classList.add('collapsed');$('#toggle-side').setAttribute('aria-expanded','false');};
$('#close-controls').onclick=closeDrawer;
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer();});
// Canvas resize preserves the current camera; Fit buttons explicitly reframe it.

// The ADS stays at the far face in Case 1. Case 2 moves its centre 35 mm
// off the optical axis, above the lens tip; this is a mechanical placeholder.
const adsX=43+config.adsOffset,adsZ=-36.83;
if(caseId===1){
  const shape=new THREE.Shape();shape.moveTo(-25,-25);shape.lineTo(25,-25);shape.lineTo(25,25);shape.lineTo(18.5,25);shape.lineTo(18.5,19.33);shape.lineTo(-18.5,19.33);shape.lineTo(-18.5,25);shape.lineTo(-25,25);shape.closePath();
  const hole=new THREE.Path();hole.absarc(0,0,3,0,Math.PI*2,true);shape.holes.push(hole);
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:6,bevelEnabled:false,curveSegments:24}),material(0x727d88));
  mesh.scale.setScalar(.001);mesh.rotation.x=Math.PI/2;mesh.position.copy(P([adsX,0,adsZ]));groups.ads.add(mesh);
}else box(groups.ads,[26,4,26],[adsX,0,adsZ],0x727d88);
box(groups.ant,[12,4,12],[adsX,0,adsZ],0x282c33);
for(let i=0;i<4;i++){
  const a=Math.PI/4+i*Math.PI/2;
  const rod=cyl(groups.ant,ROD_RADIUS,ROD_LENGTH,
    [adsX+ROD_LENGTH/2*Math.cos(a),0,adsZ+ROD_LENGTH/2*Math.sin(a)],0xc49d68);
  rod.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.cos(a),0,Math.sin(a)));
  rod.userData.armLengthMm=ROD_LENGTH;
}
const fssX=43,fssZ=caseId===1?-3:-36.83;
// A 1 mm mounting gap brings the FSS against the PCB; the ADS notch clears its body.
for(const x of [31,55])cyl(groups.fss,1.5,1,[x,.5,caseId===1?-9:-42.83],0x8b969e);
box(groups.fss,[35,14,24],[fssX,-7,fssZ],0xb8bdc3);
cyl(groups.fss,7.5,7.68,[fssX,-17.84,fssZ],0x272c33);
cyl(groups.fss,5.5,.6,[fssX,-21.98,fssZ],0x10203e);
box(groups.fss,[4,5,8],[fssX+19,-7,fssZ],0xe8e1d0);
box(groups.adcs,[12,5,5],[85,4,-30],0xe7e1cc);
for(let i=0;i<4;i++){
  const g=new THREE.Group();g.position.copy(P([43,0,-36.83]));g.rotation.y=i*Math.PI/2;
  g.name='Solar wing '+(i+1);g.userData.detail='solar-'+i;groups.solar.add(g);
  box(g,[80,1.6,config.panelLength],[0,0,config.panelRoot+config.panelLength/2],0x494331);
  for(let j=0;j<7;j++){
    const z=config.firstCell+42*j;
    box(g,[70,.3,38],[0,-1.05,z],0x152b53);
    for(let k=0;k<6;k++)box(g,[.15,.1,37],[-29+k*11.6,-1.25,z],0x8293b0);
  }
  for(const x of [-27,27])cyl(g,3,12,[x,0,config.panelRoot],0xb0b7bd).rotation.z=Math.PI/2;
}
for(const[x,z]of HOLES)cyl(groups.rails,1.45,1,[x,0,z],0x8b969e);
const inputBlocks=[[43,10],[90,-36.83],[43,-84],[-4,-36.83]];
for(const[x,z]of inputBlocks)box(groups.power,[7,5,7],[x,4,z],0x3b4858);
const packSocket=new THREE.Group();packSocket.name='Female PACK connector';
packSocket.position.copy(P([20.325,0,-77.385]));groups.power.add(packSocket);
box(packSocket,[8,1,7.5],[0,-.5,0],0x242832);
for(const x of [-3.5,3.5])box(packSocket,[1,5.5,7.5],[x,-3.75,0],0x242832);
for(const z of [-3.25,3.25])box(packSocket,[6,5.5,1],[0,-3.75,z],0x242832);
box(packSocket,[.6,5.5,5.5],[0,-3.75,0],0x242832);
box(packSocket,[6,5.5,.6],[0,-3.75,0],0x242832);
for(const x of [-1.5,1.5])for(const z of [-1.5,1.5])box(packSocket,[.8,.5,.8],[x,-2,z],0xbd9b50);
box(packSocket,[1.2,3,2],[4,-2.5,0],0x343a42);
function envelope(object,exclude=null){
  object.updateWorldMatrix(true,true);const b=new THREE.Box3();
  function visit(o){
    if(o===exclude||!o.visible)return;
    if(o.isMesh){const part=new THREE.Box3().setFromObject(o);if(!part.isEmpty())b.union(part);}
    for(const c of o.children)visit(c);
  }
  for(const c of object.children)visit(c);
  return b;
}
function compact(){
  root.rotation.set(0,0,0);root.position.set(0,0,0);
  const wheelCAD=groups.wheels.getObjectByName('Imported CAD'),wheelPCB=groups.wheels.getObjectByName('PCB model');
  const pb=envelope(wheelPCB),cb=envelope(wheelCAD);
  wheelCAD.position.y+=Math.max(0,pb.max.y+mm(2)-cb.min.y);
  const scalar={};
  for(const id of config.order){
    bounds[id]=envelope(groups[id],id==='power'?packSocket:null);
    if(bounds[id].isEmpty())throw Error(id+' model has no geometry');
    scalar[id]={min:bounds[id].min.y*1000,max:bounds[id].max.y*1000};
  }
  report=packLevels(config.order,scalar);
  const extra=report.heights.power-report.heights.battery-18;
  packSocket.position.y=-mm(extra);
  if(extra>.01)box(groups.power,[8,extra,7.5],[20.325,-extra/2,-77.385],0x242832);
  const ob=bounds.obc;
  cssRadius=Math.max(55,ob.max.x*1000-43,43-ob.min.x*1000,ob.max.z*1000+36.83,-36.83-ob.min.z*1000)+3;
}
function clearGeometry(g){for(const c of [...g.children]){g.remove(c);c.traverse(o=>o.geometry?.dispose());}}
function wires(){
  const g=groups.wires;clearGeometry(g);
  const Y=id=>groups[id].position.y*1000,a=Y('adcs'),p=Y('power'),o=Y('obc'),b=Y('beacon');
  tube(g,[[fssX+21,fssY-7,fssZ],[98,fssY-7,fssZ],[98,a+4,-30],[85,a+4,-30]],0x252932,1);
  for(let i=0;i<4;i++){
    const angle=i*Math.PI/2,r=config.panelRoot+5,x=43+r*Math.sin(angle),z=-36.83+r*Math.cos(angle),end=inputBlocks[i];
    tube(g,[[x,wingY,z],[x,wingY+(p>wingY?7:-7),z],[x,p+5,z],[end[0],p+5,end[1]]],0xab7844,.8);
  }
  if(caseId===1)tube(g,[[82.98-5.08,b+4,-78],[43,b+5,-36.83],[43,adsY,-36.83],[43,antY,-36.83]],0x252932,.8);
  else{
    // Stay beyond the camera envelope before turning inward at the offset ADS.
    tube(g,[[78,b+4,-78],[103,b+9,-78],[103,adsY,adsZ],[adsX+14,adsY,adsZ],[adsX,antY,adsZ]],0x252932,.8);
    // Payload-to-OBC cable is required only in Case 2; PC104 bridges remain deferred.
    const y=Y('camera');
    tube(g,[[88,y+8,-20],[103,y+8,-20],[103,o+4,-20],[87,o+4,-20]],0x7a93b5,1.1);
    tube(g,[[91,Y('battery')+4,-55],[108,Y('battery')+4,-55],[108,b+5,-55],[91,b+5,-55]],0xa87457,1);
  }
  root.updateMatrixWorld(true);
  // Use the actual connector bodies, not the footprint pin-1 positions.
  // Exported GLBs may merge away component names. These are connector-mouth
  // centres from the OBC CAD transforms, in board-local millimetres.
  const sockets=[['J2',9.885,4.49],['J3',75.925,4.49],['J4',86.05,-66.845],['J5',77.135,-77.044]]
    .map(([ref,x,z])=>({ref,point:new THREE.Vector3(x,o+5.445,z)}));
  const available=new Set([0,1,2,3]);
  groups.css.children.forEach(c=>{
    const socket=c.userData.connector;if(!socket)return;
    // CSS J1 model mouth: [0,4.4,.5] in connector coordinates, transformed
    // by the PCB's actual bottom-side 3D-model offset and rotation.
    const world=socket.localToWorld(c.userData.connectorPoint.clone());
    const ahead=socket.localToWorld(c.userData.connectorPoint.clone().add(P([-1,0,0])));
    const q=root.worldToLocal(world).multiplyScalar(1000);
    const n=root.worldToLocal(ahead).multiplyScalar(1000).sub(q).normalize();
    const j=[...available].sort((i,j)=>q.distanceTo(sockets[i].point)-q.distanceTo(sockets[j].point))[0];
    available.delete(j);if(!c.visible||!groups.css.visible||!groups.obc.visible)return;
    const t=sockets[j].point,exit=q.clone().addScaledVector(n,7),entry=t.clone().add(new THREE.Vector3(0,7,0));
    const level=Math.max(o+12,exit.y+6,entry.y);
    const ps=[q,exit,new THREE.Vector3(exit.x,level,exit.z),new THREE.Vector3(t.x,level,t.z),entry,t];
    const cable=tube(g,ps.map(p=>p.toArray()),0xd7d4c1,.6);
    cable.name=c.name+' to OBC '+sockets[j].ref;
    cable.userData.socketEndpoints={css:q.toArray(),obc:t.toArray(),ref:sockets[j].ref};
    const plug=box(g,[3.8,1.4,2.4],q.clone().addScaledVector(n,.3).toArray(),0xe5e2d7);
    plug.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),n);
  });
}
function layout(){
  if(!ready)return;
  root.rotation.set(0,0,0);root.position.set(0,0,0);
  config.order.forEach((id,i)=>groups[id].position.y=mm(report.heights[id]+state.spread*i));
  const low=config.order[0],lowY=groups[low].position.y*1000+bounds[low].min.y*1000;
  const camTop=groups.camera.position.y*1000+bounds.camera.max.y*1000;
  adsY=caseId===1?lowY-5:groups.camera.position.y*1000+bounds.camera.max.y*1000*.65;
  antY=adsY+(caseId===1?-10:5);
  wingY=caseId===1?adsY+3:lowY-6;
  fssY=groups[caseId===1?'beacon':'adcs'].position.y*1000-1;
  groups.ads.position.y=mm(adsY);groups.ant.position.y=mm(antY);
  groups.solar.position.y=mm(wingY);groups.fss.position.y=mm(fssY);
  groups.css.position.y=groups.obc.position.y;
  groups.css.children.forEach((g,i)=>{
    const a=i*Math.PI/2;g.position.x=mm(43+(cssRadius+state.css)*Math.cos(a));g.position.z=mm(-36.83+(cssRadius+state.css)*Math.sin(a));
  });
  for(const[id]of defs){
    groups[id].visible=!state.hidden.includes(id);
    for(const c of groups[id].children)if(c.userData.detail)c.visible=!state.detailsHidden.includes(c.userData.detail);
  }
  const rodLow=groups[low].position.y*1000,rodHigh=groups.camera.position.y*1000;
  for(const rod of groups.rails.children){rod.scale.y=rodHigh-rodLow;rod.position.y=mm((rodHigh+rodLow)/2);}
  wires();
  for(const label of labels){
    let visible=state.labels;for(let p=label.parent;p&&p!==root;p=p.parent)visible=visible&&p.visible;
    label.visible=visible;label.element.style.opacity=String(state.opacity);
  }
  // Default matches the document: camera at bottom. Flip rotates all geometry,
  // harnesses and labels together around the assembly centre.
  root.updateMatrixWorld(true);
  const centre=new THREE.Vector3(mm(43),mm((camTop+Math.min(fssY-22.28,adsY-6))/2),mm(-36.83));
  root.rotation.z=state.flip?0:Math.PI;
  root.position.copy(centre).sub(centre.clone().applyQuaternion(root.quaternion));
  root.updateMatrixWorld(true);
  $('#flip').setAttribute('aria-pressed',String(state.flip));
  $('#labels-toggle').setAttribute('aria-pressed',String(state.labels));
  $('#labels-toggle').classList.toggle('on',state.labels);
  try{localStorage.setItem(key,JSON.stringify(state))}catch{}
  v.requestRender();
}
function addLabel(parent,text,point,detail){
  const el=document.createElement('button');el.className='assembly-label';el.textContent=text;el.title='Focus '+text;
  el.onclick=()=>v.fit([parent],null,true);
  const label=new CSS2DObject(el);label.position.copy(point);label.userData.detail=detail;
  parent.add(label);labels.push(label);
}
function makeLabels(){
  for(const[id,name]of defs){
    if(['css','wires','rails'].includes(id))continue;
    const b=envelope(groups[id]);if(b.isEmpty())continue;
    const p=new THREE.Vector3(b.max.x+mm(3),(b.min.y+b.max.y)/2,b.max.z);
    p.y-=groups[id].position.y;
    addLabel(groups[id],name,p);
  }
  groups.css.children.forEach((g,i)=>addLabel(g,'CSS '+(i+1),P([0,3,4])));
}
function renderPanel(){
  $('#controls-body').innerHTML='<h2>'+config.title+'</h2><p class="small muted">'+config.summary+'</p>'+
    '<div class="row"><a class="btn" href="assembly.html?case='+(caseId===1?2:1)+'">Open Case '+(caseId===1?2:1)+'</a><button class="btn" id="reset">Reset view</button></div>'+
    '<label class="field">Explode <input id="spread" aria-label="Explode spacing" type="range" min="0" max="40" value="'+state.spread+'"></label>'+
    '<label class="field">CSS spread <input id="css" aria-label="CSS spread" type="range" min="0" max="60" value="'+state.css+'"></label>'+
    '<label class="field">Label opacity <input id="opacity" aria-label="Label opacity" type="range" min=".15" max="1" step=".05" value="'+state.opacity+'"></label>'+
    '<details open><summary>Components</summary><div id="components"></div></details>'+
    '<details><summary>Individual sensors / wings</summary><div id="individual"></div></details>'+
    '<div class="row"><button class="btn" id="inspect-mtq">Inspect magnetorquers</button><button class="btn" id="copy">Copy view</button></div>'+
    '<details><summary>Fit and assumptions</summary><div id="fit-report" class="small"></div><p class="small muted">2 mm envelope clearance; 15.24 mm minimum PCB pitch, at least 18 mm at PACK. Mounts, connectors, harness endpoints and wheel PCB are provisional. Cu–Be arms: 170 mm each, 1 mm assumed diameter. Camera and payload PCB are one imported unit. PC104 bridges deferred. No patch antenna model. Case 2 uses a 35 mm ADS offset with solar panels at the FSS end; optical field-of-view and RF geometry require validation. Battery-enclosure magnetic shielding and mass balance are not validated.</p></details>';
  for(const[id,name]of defs){
    const label=document.createElement('label');label.className='field';
    const input=document.createElement('input');input.type='checkbox';input.checked=!state.hidden.includes(id);
    input.onchange=()=>{state.hidden=input.checked?state.hidden.filter(x=>x!==id):[...state.hidden,id];layout();};
    label.append(input,document.createTextNode(name));$('#components').append(label);
  }
  for(const id of ['solar','css'])groups[id].children.forEach((g,i)=>{
    const token=g.userData.detail;if(!token)return;
    const label=document.createElement('label');label.className='field';const input=document.createElement('input');
    input.type='checkbox';input.checked=!state.detailsHidden.includes(token);
    input.onchange=()=>{state.detailsHidden=input.checked?state.detailsHidden.filter(x=>x!==token):[...state.detailsHidden,token];layout();};
    label.append(input,document.createTextNode(g.name));$('#individual').append(label);
  });
  for(const k of ['spread','css','opacity'])$('#'+k).oninput=e=>{state[k]=+e.target.value;layout();};
  $('#reset').onclick=()=>{state=defaults();history.replaceState(null,'',location.pathname+location.search);renderPanel();layout();focus(mobile.matches?'stack':'all');};
  $('#inspect-mtq').onclick=()=>{state.hidden=defs.map(d=>d[0]).filter(id=>id!=='beacon');renderPanel();layout();v.fit([groups.beacon]);};
  $('#copy').onclick=async()=>{location.hash=encodeURIComponent(JSON.stringify(state));try{await navigator.clipboard.writeText(location.href);$('#copy').textContent='Copied'}catch{$('#copy').textContent='View saved in address bar'}};
  if(report)$('#fit-report').textContent=report.rows.map(r=>r.lower+' → '+r.upper+': '+r.pitch.toFixed(1)+' mm pitch, '+r.gap.toFixed(1)+' mm envelope gap').join(' · ');
}
const site=await(await fetch('site.json',{cache:'no-cache'})).json(),boards=Object.fromEntries(site.boards.map(b=>[b.id,b]));
boards['beacon-eps']={...boards['beacon-eps'],glb:'https://padamsarda.github.io/stackview/codex-eps-beacon-4layer-t-magnetorquers/boards/beacon-eps/board.glb',stack:{x:175.1,y:111.08,rot:0}};
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
async function board(id,src){const b=boards[src];if(!b?.glb)throw Error(src+' unavailable');let m=await v.load(b.glb);if(src==='pc104')singleStandardPCB(m);m.position.set(-mm(b.stack.x),0,-mm(b.stack.y));const pivot=new THREE.Group();pivot.rotation.y=-b.stack.rot*Math.PI/180;pivot.add(m);pivot.name='PCB model';groups[id].add(pivot);}
async function cad(id,file){
  const m=await v.load('assembly/'+(file==='camera'?'camera-opt':file)+'.glb');
  // Camera source PC104 edge lies along -Z. Rotate it onto the stack's -X edge.
  // The source mounting datum is X=-36.79717, Z=-42.92649 mm.
  // The other three centers follow the same asymmetric PC104 mounting pattern.
  if(id==='camera')m.rotation.y=Math.PI/2;
  m.updateMatrixWorld(true);
  const b=new THREE.Box3().setFromObject(m),c=b.getCenter(new THREE.Vector3());
  if(id==='camera')m.position.set(mm(42.92649),-b.min.y,mm(-36.79717));
  else m.position.set(mm(43)-c.x,id==='mount'?-b.max.y:-b.min.y+mm(id==='wheels'?3:0),mm(-36.83)-c.z);
  m.name='Imported CAD';groups[id].add(m);
  if(id==='camera')groups[id].visible=true;
  groups[id].userData.cadBounds={min:b.min.toArray(),max:b.max.toArray()};
}
const jobs=[...['obc','payload','adcs','battery'].map(id=>[id,()=>board(id,id)]),['beacon',()=>board('beacon','beacon-eps')],...['camera','wheels'].map(id=>[id,()=>cad(id,id)]),['power',()=>board('power','pc104')],['wheels-standard',()=>board('wheels','pc104')],['css',async()=>{const m=await v.load(boards.css.glb),b=new THREE.Box3().setFromObject(m);m.position.copy(b.getCenter(new THREE.Vector3()).negate());for(let i=0;i<4;i++){let g=new THREE.Group(),p=new THREE.Group();p.add(m.clone(true));p.rotation.order="YXZ";p.rotation.x=Math.PI/2;p.rotation.y=Math.PI/2-i*Math.PI/2;box(g,[6,4,4],[0,-5,0],0xe3dfd0);g.name='CSS '+(i+1);g.userData.detail='css-'+i;g.userData.connector=p;g.userData.connectorPoint=P([171.285,-1.685,89.195]).add(m.position);g.add(p);groups.css.add(g);}}]];


renderPanel();
await Promise.all(jobs.map(async([id,fn])=>{try{await fn()}catch(e){errors.push(id+': '+e.message)}}));
if(errors.length){
  $('#loading').textContent='Some models failed to load: '+errors.join('; ')+'. Reload to retry.';
}else{
  try{
    compact();makeLabels();ready=true;renderPanel();layout();
    $('#loading').hidden=true;
    // Wait for the final drawer/canvas dimensions before initial framing.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{focus(mobile.matches?'stack':'all',false);initialFit=false;}));
  }catch(e){errors.push(e.message);$('#loading').textContent='Assembly placement failed: '+e.message;}
}
window.systemAssembly={groups,state:()=>state,viewer:v,root,errors,report,caseId};
