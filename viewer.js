import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
const $=id=>document.getElementById(id);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.97;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;$('stage').appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#f1eee7');
const pm=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pm.fromScene(room,.045).texture;scene.environmentIntensity=.7;room.dispose();pm.dispose();
const camera=new THREE.PerspectiveCamera(32,innerWidth/innerHeight,.002,3);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=.19;controls.maxDistance=.7;
const target=new THREE.Vector3(.015,.054,0);
function home(){const damp=controls.enableDamping;controls.enableDamping=false;controls.update();camera.up.set(0,1,0);camera.position.set(.083,.139,.405);controls.target.copy(target);controls.update();controls.enableDamping=damp;}
home();
const key=new THREE.DirectionalLight('#fff6e8',2.3);key.position.set(-.15,.29,.22);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-.24,right:.24,top:.23,bottom:-.2,near:.01,far:.8});key.shadow.bias=-.0001;key.shadow.normalBias=.00025;key.shadow.radius=5;scene.add(key);
const fill=new THREE.DirectionalLight('#ffffff',.9);fill.position.set(.17,.15,-.15);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(3,3),new THREE.ShadowMaterial({opacity:.09}));ground.rotation.x=-Math.PI/2;ground.position.y=-.0003;ground.receiveShadow=true;scene.add(ground);
const pivot=new THREE.Group();pivot.position.x=.041;scene.add(pivot);
const R=.041,H=.074,W=H*1.5,CY=.048; // Full 3:2 photograph; no portrait stretching or crop.
const printCenterU=.75;
let clip,liveCanvas,liveCtx,freezeCanvas,freezeTime=4.92;
let customImage=null,fitMode='contain',bodyColor='#f7f7f7',handleColor='#ffd02a',atlasCanvas,atlasCtx;
const ceramicMaterials=[],handleMaterials=[];
let mug,surface,photo,atlas,blankAtlas,photoPlane,photoGeo,frame,trail,points,magicDust,magicHalo,magicLight,elapsed=0,running=false,ready=false,printed=false;
const duration=14.3;
const ease=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*x*(x*(x*6-15)+10);};
const lerp=THREE.MathUtils.lerp;
const startPos=new THREE.Vector3(.046,.09,.18),endPos=new THREE.Vector3(.041,CY,R+.0002);
const flight=new THREE.CubicBezierCurve3(startPos,new THREE.Vector3(.035,.11,.15),new THREE.Vector3(.041,.075,.10),endPos);
const COLS=144,ROWS=12;
function paintFrame(ctx,src){
 const w=src.videoWidth||src.width,h=src.videoHeight||src.height;
 const aspect=1.5,sw=Math.min(w,h*aspect),sh=sw/aspect;
 ctx.drawImage(src,(w-sw)/2,(h-sh)/2,sw,sh,0,0,1536,1024);
}
function seekClip(t){return new Promise(resolve=>{if(Math.abs(clip.currentTime-t)<.006&&!clip.seeking){resolve();return;}clip.addEventListener('seeked',()=>resolve(),{once:true});clip.currentTime=t;});}
function syncLiving(t){
 if(!clip)return;if(customImage){clip.pause();return;}
 const active=t>=.7&&t<5.75,desired=Math.min(freezeTime,Math.max(0,(t-.7)/5.05*freezeTime));
 if(active&&running){if(Math.abs(clip.currentTime-desired)>.3&&!clip.seeking)clip.currentTime=desired;if(clip.paused)clip.play().catch(()=>{});}
 else {clip.pause();if(t<5.75&&Math.abs(clip.currentTime-desired)>.08&&!clip.seeking)clip.currentTime=desired;}
 if(t>=5.75)liveCtx.drawImage(freezeCanvas,0,0);else if(clip.readyState>=2)paintFrame(liveCtx,clip);
 photo.needsUpdate=true;
}
function buildPhoto(){
 photoGeo=new THREE.BufferGeometry();const p=[],uv=[],ind=[];
 for(let j=0;j<=ROWS;j++)for(let i=0;i<=COLS;i++){p.push((i/COLS-.5)*W,(.5-j/ROWS)*H,0);uv.push(i/COLS,j/ROWS);}
 for(let j=0;j<ROWS;j++)for(let i=0;i<COLS;i++){const a=j*(COLS+1)+i,b=a+COLS+1;ind.push(a,b,a+1,a+1,b,b+1);}
 photoGeo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));photoGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));photoGeo.setIndex(ind);photoGeo.computeVertexNormals();photoGeo.computeBoundingSphere();
 photoPlane=new THREE.Mesh(photoGeo,new THREE.MeshPhysicalMaterial({map:photo,roughness:.35,metalness:0,clearcoat:.25,clearcoatRoughness:.2,side:THREE.DoubleSide,transparent:true,opacity:0}));photoPlane.castShadow=false;photoPlane.material.depthWrite=false;photoPlane.renderOrder=2;mug.add(photoPlane);
 frame=new THREE.Mesh(new THREE.BoxGeometry(W+.0024,H+.0024,.0006),new THREE.MeshPhysicalMaterial({color:'#fffdf7',roughness:.45,transparent:true,opacity:0}));scene.add(frame);
 const tgeo=new THREE.BufferGeometry();tgeo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(42*3),3));trail=new THREE.Line(tgeo,new THREE.LineBasicMaterial({color:'#d2a650',transparent:true,opacity:0,depthWrite:false}));scene.add(trail);
 const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,248,213,1)');gr.addColorStop(.2,'rgba(255,222,153,.75)');gr.addColorStop(1,'rgba(255,206,125,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);
 const star=document.createElement('canvas');star.width=star.height=128;const sg=star.getContext('2d');const glow=sg.createRadialGradient(64,64,0,64,64,64);glow.addColorStop(0,'rgba(255,255,235,1)');glow.addColorStop(.13,'rgba(255,240,181,.9)');glow.addColorStop(.4,'rgba(255,188,63,.25)');glow.addColorStop(1,'rgba(255,180,60,0)');sg.fillStyle=glow;sg.fillRect(0,0,128,128);sg.fillStyle='#fff9df';sg.beginPath();sg.moveTo(64,10);sg.lineTo(69,59);sg.lineTo(118,64);sg.lineTo(69,69);sg.lineTo(64,118);sg.lineTo(59,69);sg.lineTo(10,64);sg.lineTo(59,59);sg.closePath();sg.fill();
 const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(200*3),3));magicDust=new THREE.Points(dg,new THREE.PointsMaterial({map:new THREE.CanvasTexture(star),color:'#ffcc76',size:.0045,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(magicDust);
 magicHalo=new THREE.Mesh(new THREE.TorusGeometry(.051,.00045,8,120),new THREE.MeshBasicMaterial({color:'#ffe5a2',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));magicHalo.rotation.x=Math.PI/2;magicHalo.position.set(.041,.06,0);scene.add(magicHalo);
 magicLight=new THREE.PointLight('#ffc663',0,.24,2);magicLight.position.set(.041,.08,.075);scene.add(magicLight);
 const pgeo=new THREE.BufferGeometry();pgeo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(30*3),3));points=new THREE.Points(pgeo,new THREE.PointsMaterial({map:new THREE.CanvasTexture(c),color:0xffdc96,size:.0018,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(points);
}
function bendPhoto(b){
 const a=photoGeo.attributes.position,k=b/(R+.0002);
 for(let j=0;j<=ROWS;j++)for(let i=0;i<=COLS;i++){const s=(i/COLS-.5)*W,t=k*s,idx=j*(COLS+1)+i;a.setXYZ(idx,b<.00001?s:Math.sin(t)/k,(.5-j/ROWS)*H,b<.00001?0:(Math.cos(t)-1)/k);}
 a.needsUpdate=true;photoGeo.computeVertexNormals();photoGeo.computeBoundingSphere();
}
function setPrint(enabled){if(printed===enabled)return;printed=enabled;surface.material.map=blankAtlas;surface.material.color.set(bodyColor);}
function updateUI(t){
 const phase=t<1.2?0:t<6.5?1:2;const visible=t>=6.5;$('customizer').classList.toggle('visible',visible);$('customizer').inert=!visible;
 document.querySelectorAll('.step').forEach((e,i)=>e.classList.toggle('active',i===phase));
 $('caption').textContent=t<1.2?'Всё начинается с чистой кружки':t<3.8?'Любимые лица оживают':t<5.75?'Тёплое объятие — настоящий момент':t<6.5?'Объятие замирает на керамике':t<7.8?'Ваш снимок становится частью кружки':t<duration?'Рассмотрите её со всех сторон':'Теперь кружку можно вращать мышью';
 if(customImage)$('caption').textContent=t<1.2?'Ваша кружка готовится':t<6.5?'Ваша фотография прилетает на кружку':t<duration?'Ваше фото на керамике':'Меняйте цвета и вращайте кружку мышью';
 $('progress').style.transform=`scaleX(${Math.min(t/duration,1)})`;$('pause').textContent=running?'Пауза':'Продолжить';$('pause').disabled=t>=duration;
}
function renderAt(t){
 if(!ready)return;t=THREE.MathUtils.clamp(t,0,duration);elapsed=t;
 syncLiving(t);setPrint(t>=6.25);
 const flightT=ease((t-3.1)/3.15),bend=ease((t-3.65)/2.6);
 const pos=flight.getPoint(flightT);
 const distance=camera.position.distanceTo(startPos),viewH=2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
 const largeScale=Math.min(viewH*.64/H,viewH*camera.aspect*.84/W);
 photoPlane.scale.setScalar(lerp(largeScale,1,ease((t-3.1)/2.9)));
 photoPlane.quaternion.copy(camera.quaternion).slerp(new THREE.Quaternion(),ease((t-3.1)/2.4));
 photoPlane.position.copy(pos);photoPlane.position.x-=pivot.position.x;
 bendPhoto(bend);
 // Keep every vertex outside the ceramic during wrapping, including the edges.
 photoPlane.updateMatrix();const vertices=photoGeo.attributes.position,v=new THREE.Vector3();let clearance=0;
 for(let i=0;i<vertices.count;i++){v.fromBufferAttribute(vertices,i).applyMatrix4(photoPlane.matrix);if(v.y>=0&&v.y<=.095&&Math.abs(v.x)<R+.00015){clearance=Math.max(clearance,Math.sqrt((R+.00015)**2-v.x*v.x)-v.z);}}
 photoPlane.position.z+=Math.max(0,clearance);pos.z=photoPlane.position.z;
 photoPlane.material.opacity=ease((t-.7)/.75);photoPlane.visible=t>.7;
 photoPlane.userData.clearance=clearance;
 // The same photograph stays on the mug and rotates with it: no texture handoff.
 photoPlane.material.roughness=lerp(.35,.19,bend);photoPlane.material.clearcoat=lerp(.25,.65,bend);photoPlane.material.clearcoatRoughness=lerp(.2,.12,bend);
 frame.position.copy(pos);frame.quaternion.copy(photoPlane.quaternion);frame.scale.copy(photoPlane.scale);frame.translateZ(-.00036);frame.material.opacity=photoPlane.material.opacity*(1-ease((t-3.05)/.45));frame.visible=frame.material.opacity>.001&&t<6.5;
 const shimmer=ease((t-1.4)/.5)*(1-ease((t-5.5)/.65));trail.material.opacity=.75*shimmer;points.material.opacity=.9*shimmer;
 const tr=trail.geometry.attributes.position;
 for(let i=0;i<42;i++){const tt=Math.max(0,flightT-.23+i/41*.23),v=flight.getPoint(tt);tr.setXYZ(i,v.x,v.y-.022,v.z-.005);}tr.needsUpdate=true;trail.geometry.computeBoundingSphere();
 const pp=points.geometry.attributes.position;
 for(let i=0;i<30;i++){const tt=Math.max(0,flightT-(i/30)*.32),v=flight.getPoint(tt);pp.setXYZ(i,v.x+Math.sin(i*7.2+t*2)*.0025,v.y-.022+Math.cos(i*2.6+t*3)*.004,v.z+Math.sin(i*3.1)*.002);}pp.needsUpdate=true;points.geometry.computeBoundingSphere();
 // Gold motes spiral around the airborne photo, then gather on the mug.
 const appear=ease((t-.55)/.8),vanish=1-ease((t-7.0)/1.0),strength=appear*vanish;
 const sparkPos=magicDust.geometry.attributes.position,settle=ease((t-3.9)/2.1);
 for(let i=0;i<200;i++){
  const q=i/199,a=i*2.399963+t*(i%2?1.4:-1.1),spread=.028+(i%9)*.003;
  const cx=lerp(pos.x,.041,settle),cy=lerp(pos.y,CY,settle),cz=lerp(pos.z,0,settle);
  const radius=lerp(spread,.045+Math.sin(i*7.3+t)*.005,settle);
  sparkPos.setXYZ(i,cx+Math.cos(a)*radius,cy+(q-.5)*lerp(.07,.112,settle)+Math.sin(t*2+i)*.004,cz+Math.sin(a)*radius);
 }
 sparkPos.needsUpdate=true;magicDust.geometry.computeBoundingSphere();magicDust.material.opacity=strength*(.6+.15*Math.sin(t*8));
 const flash=Math.exp(-Math.pow((t-6.42)/.23,2));magicLight.intensity=.0007*flash;
 magicHalo.material.opacity=(.35*Math.sin(Math.PI*ease((t-4.2)/2.5))+.85*flash)*vanish;
 magicHalo.position.y=lerp(.017,.09,ease((t-4)/2.7));magicHalo.scale.setScalar(1+.12*flash);magicHalo.rotation.z=t*.8;
 pivot.rotation.y=t<7.8?0:Math.PI*2*ease((t-7.8)/6);
 controls.enabled=t>=duration;
 updateUI(t);
}
const bodyPalette=[['Белая','#f7f7f7'],['Небо','#97d5ee'],['Море','#329bb8'],['Мята','#9ddbcc'],['Розовая','#eabaca']];
const handlePalette=[['Жёлтая','#ffd02a'],['Небо','#97d5ee'],['Море','#329bb8'],['Бирюза','#68cbbb'],['Розовая','#eabaca'],['Белая','#f7f7f7']];
function drawFitted(ctx,source,x,y,w,h,mode){
 const iw=source.naturalWidth||source.width,ih=source.naturalHeight||source.height;
 const scale=mode==='cover'?Math.max(w/iw,h/ih):Math.min(w/iw,h/ih);
 ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(source,x+(w-iw*scale)/2,y+(h-ih*scale)/2,iw*scale,ih*scale);ctx.restore();
}
function repaint(){
 if(!atlasCanvas)return;
 atlasCtx.fillStyle=bodyColor;atlasCtx.fillRect(0,0,atlasCanvas.width,atlasCanvas.height);
 const uw=W/(2*Math.PI*R),vh=H/.086,x=(printCenterU-uw/2)*atlasCanvas.width,y=(1-vh)/2*atlasCanvas.height,w=uw*atlasCanvas.width,h=vh*atlasCanvas.height;
 drawFitted(atlasCtx,customImage||freezeCanvas,x,y,w,h,customImage?fitMode:'contain');atlas.needsUpdate=true;
 if(customImage){liveCtx.fillStyle=bodyColor;liveCtx.fillRect(0,0,1536,1024);drawFitted(liveCtx,customImage,0,0,1536,1024,fitMode);photo.needsUpdate=true;}
 else syncLiving(elapsed);
}
function applyColors(){
 ceramicMaterials.forEach(m=>m.color.set(bodyColor));handleMaterials.forEach(m=>m.color.set(handleColor));
 if(surface)surface.material.color.set(bodyColor);repaint();
 for(const [kind,value] of [['body',bodyColor],['handle',handleColor]])document.querySelectorAll('[data-color-kind="'+kind+'"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.hex===value)));
 $('body-name').textContent=bodyPalette.find(p=>p[1]===bodyColor)?.[0]||'';$('handle-name').textContent=handlePalette.find(p=>p[1]===handleColor)?.[0]||'';
}
function showFinished(){running=false;clip.pause();home();renderAt(duration);}
function buildCustomizer(){
 for(const [kind,colors] of [['body',bodyPalette],['handle',handlePalette]]){
  const host=$(kind+'-colors');for(const [name,hex]of colors){const b=document.createElement('button');b.className='swatch';b.title=name;b.setAttribute('aria-label',(kind==='body'?'Кружка: ':'Ручка: ')+name);b.dataset.colorKind=kind;b.dataset.hex=hex;b.style.setProperty('--swatch',hex);b.onclick=()=>{if(kind==='body')bodyColor=hex;else handleColor=hex;applyColors();};host.append(b);}
 }
 $('upload-photo').onclick=$('quick-photo').onclick=()=>{if(ready)$('photo-file').click();};
 $('photo-file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;let url;
  try{
   if(file.size>20*1024*1024)throw Error('Выберите фото размером до 20 МБ.');
   if(!/^image\/(jpeg|png|webp|avif|heic|heif)$/i.test(file.type)&&!/[.](jpe?g|png|webp|avif|heic|heif)$/i.test(file.name))throw Error('Выберите фотографию JPG, PNG или WebP.');
   $('photo-message').textContent='Открываю фотографию…';url=URL.createObjectURL(file);const im=new Image();im.src=url;
   try{await im.decode();}catch{throw Error('Не удалось прочитать фото. Для HEIC сохраните копию в JPG и попробуйте снова.');}
   customImage=im;fitMode='contain';clip.pause();repaint();showFinished();
   $('photo-message').textContent='Фото примерено. «Повторить» покажет его волшебный подлёт.';
   parent.postMessage({type:'photo-chosen',file},location.origin);$('photo-name').textContent=file.name;$('fit-options').hidden=false;$('restore-demo').hidden=false;
   document.querySelectorAll('[data-fit]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fit===fitMode)));
  }catch(err){showFinished();$('photo-message').textContent=err.message;$('customizer').classList.add('visible');$('customizer').inert=false;}
  finally{if(url)URL.revokeObjectURL(url);e.target.value='';}
 };
 document.querySelectorAll('[data-fit]').forEach(b=>b.onclick=()=>{fitMode=b.dataset.fit;document.querySelectorAll('[data-fit]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));repaint();});
 $('restore-demo').onclick=()=>{customImage=null;fitMode='contain';showFinished();repaint();$('photo-name').textContent='Семейный пример';$('photo-message').textContent='Своё фото остаётся обычной фотографией. Живое объятие — в готовом примере.';$('fit-options').hidden=true;$('restore-demo').hidden=true;};
}
function resize(){const viewHeight=innerWidth<700?550:innerHeight;renderer.setSize(innerWidth,viewHeight);camera.aspect=innerWidth/viewHeight;camera.fov=innerWidth<700?46:32;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
$('replay').onclick=()=>{if(!ready)return;home();elapsed=0;running=true;renderAt(0);};
$('pause').onclick=()=>{if(!ready)return;running=!running;syncLiving(elapsed);updateUI(elapsed);};
$('inspect').onclick=()=>{if(!ready)return;running=false;home();renderAt(duration);};
let last=performance.now();function loop(now){requestAnimationFrame(loop);const dt=Math.min((now-last)/1000,.1);last=now;if(ready&&running&&!document.hidden){renderAt(elapsed+dt);if(elapsed>=duration){running=false;updateUI(elapsed);}}controls.update();renderer.render(scene,camera);}requestAnimationFrame(loop);
async function main(){
 const img=new Image();img.src='./family-photo.png';await img.decode();clip=document.createElement('video');clip.muted=true;clip.playsInline=true;clip.preload='auto';clip.setAttribute('playsinline','');clip.setAttribute('webkit-playsinline','');clip.addEventListener('seeked',()=>{if(photo&&liveCtx&&!customImage){if(elapsed>=5.75)liveCtx.drawImage(freezeCanvas,0,0);else paintFrame(liveCtx,clip);photo.needsUpdate=true;}});
 clip.src='./family-hug.mp4';
 await new Promise((resolve,reject)=>{clip.addEventListener('loadeddata',resolve,{once:true});clip.addEventListener('error',()=>reject(new Error('Video could not load')),{once:true});clip.load();});
 freezeTime=Math.max(0,clip.duration-.08);freezeCanvas=document.createElement('canvas');freezeCanvas.width=1536;freezeCanvas.height=1024;
 await seekClip(freezeTime);paintFrame(freezeCanvas.getContext('2d'),clip);await seekClip(0);
 liveCanvas=document.createElement('canvas');liveCanvas.width=1536;liveCanvas.height=1024;liveCtx=liveCanvas.getContext('2d');paintFrame(liveCtx,clip);
 photo=new THREE.CanvasTexture(liveCanvas);photo.colorSpace=THREE.SRGBColorSpace;photo.flipY=false;photo.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());photo.needsUpdate=true;
 const c=document.createElement('canvas');c.width=3072;c.height=1024;const g=c.getContext('2d');atlasCanvas=c;atlasCtx=g;g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);
 const uw=W/(2*Math.PI*R),vh=H/.086;g.drawImage(freezeCanvas,(printCenterU-uw/2)*c.width,(1-vh)/2*c.height,uw*c.width,vh*c.height);
 atlas=new THREE.CanvasTexture(c);atlas.colorSpace=THREE.SRGBColorSpace;atlas.flipY=false;atlas.anisotropy=photo.anisotropy;
 const blank=document.createElement('canvas');blank.width=blank.height=2;const bg=blank.getContext('2d');bg.fillStyle='#fff';bg.fillRect(0,0,2,2);blankAtlas=new THREE.CanvasTexture(blank);blankAtlas.colorSpace=THREE.SRGBColorSpace;blankAtlas.flipY=false;
 const gltf=await new GLTFLoader().loadAsync('./heart-mug.glb');mug=gltf.scene;pivot.add(mug);mug.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});surface=mug.getObjectByName('Mug_Print_Surface');surface.material=surface.material.clone();surface.material.map=blankAtlas;mug.traverse(o=>{if(o.isMesh&&o!==surface){o.material=o.material.clone();if(o.name==='Heart_Handle')handleMaterials.push(o.material);else ceramicMaterials.push(o.material);}});buildPhoto();buildCustomizer();applyColors();
 ready=true;$('loading').classList.add('hidden');document.querySelectorAll('button').forEach(b=>b.disabled=false);running=!matchMedia('(prefers-reduced-motion: reduce)').matches;renderAt(running?0:duration);
 window.demo={seek:async t=>{running=false;home();await seekClip(Math.min(freezeTime,Math.max(0,(t-.7)/5.05*freezeTime)));renderAt(t);renderer.render(scene,camera);},play:()=>{running=true;},getState:()=>({time:elapsed,running,printed,photoVisible:photoPlane.visible,photoOpacity:photoPlane.material.opacity,printMapReady:!!surface.material.map,bend:ease((elapsed-3.65)/2.6),rotation:pivot.rotation.y,controls:controls.enabled,videoTime:clip.currentTime,videoPaused:clip.paused,freezeTime,customPhoto:!!customImage,fitMode,bodyColor,handleColor}),exportPrinted:async()=>{running=false;renderAt(duration);const result=await new GLTFExporter().parseAsync(mug,{binary:true,onlyVisible:true});return Array.from(new Uint8Array(result));},atlas:()=>c.toDataURL('image/png')};
 window.clip=clip;window.camera=camera;window.controls=controls;window.renderer=renderer;window.mug=mug;window.photoPlane=photoPlane;window.__ready=true;
}
main().catch(e=>{$('loading').textContent='Не удалось открыть 3D. Попробуйте открыть файл в Chrome.';window.__error=String(e);console.error(e);});

// Parent page and viewer must share an origin. Never accept external frame commands.
addEventListener('message',async e=>{
 if(e.source!==parent||e.origin!==location.origin||!ready||e.data?.type!=='preview-photo')return;
 try{
  const {data,name,body,handle}=e.data;
  if(typeof data!=='string'||data.length>260000||!data.startsWith('data:image/jpeg;base64,'))return;
  const im=new Image();im.src=data;await im.decode();customImage=im;fitMode='contain';
  if(/^#[0-9a-f]{6}$/i.test(body||''))bodyColor=body;
  if(/^#[0-9a-f]{6}$/i.test(handle||''))handleColor=handle;
  applyColors();home();running=true;renderAt(0);$('photo-name').textContent=name||'Моя фотография';
  $('fit-options').hidden=false;$('restore-demo').hidden=false;
  $('photo-message').textContent='Снимок из вашей галереи. Нажмите «Повторить» для волшебного подлёта.';
  parent.postMessage({type:'preview-applied'},location.origin);
 }catch{parent.postMessage({type:'preview-error'},location.origin);}
});
