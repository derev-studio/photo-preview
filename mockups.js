const $=id=>document.getElementById(id);
const database=new Promise((resolve,reject)=>{const request=indexedDB.open('photo-preview-mockups',1);request.onupgradeneeded=()=>request.result.createObjectStore('views',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
// Consume startup rejection even if the visitor never opens their local collection.
database.catch(()=>{});
async function transact(mode,fn){const db=await database;return new Promise((resolve,reject)=>{const tx=db.transaction('views',mode),request=fn(tx.objectStore('views'));tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Сохранение отменено'));});}
function element(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;}
function asFile(item){const bytes=Uint8Array.from(atob(item.data.split(',')[1]),c=>c.charCodeAt(0));return new File([bytes],item.filename,{type:'image/png'});}
function status(text){$('mockup-status').textContent=text;$('mockup-view-status').textContent=text;}
function actionsFor(item,large=false){
 const actions=element('div');actions.className='actions';
 const link=element('a','Скачать PNG');link.href=item.data;link.download=item.filename;
 const share=element('button','Поделиться');share.onclick=async()=>{try{const file=asFile(item);if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:item.title});}else{status('Здесь отправка файла не поддерживается. Нажмите «Скачать PNG» и прикрепите его в нужном приложении.');}}catch(e){if(e.name!=='AbortError')status('Не удалось открыть отправку. Скачайте PNG и прикрепите его вручную.');}};
 const publish=element('button','В галерею работ');publish.title='Подготовить публикацию — подтверждение отдельно';publish.onclick=()=>window.prepareMugPublication?.(asFile(item),item.title);
 actions.append(link,share,publish);
 if(large){const zoom=element('button','Увеличить ×2');zoom.setAttribute('aria-pressed','false');zoom.onclick=()=>{const on=$('mockup-scroll').classList.toggle('zoomed');zoom.textContent=on?'Показать целиком':'Увеличить ×2';zoom.setAttribute('aria-pressed',String(on));};actions.append(zoom);}
 else{const open=element('button','Открыть крупно');open.onclick=()=>showMockup(item);actions.prepend(open);const remove=element('button','Удалить');remove.onclick=async()=>{if(!confirm('Удалить этот макет из браузера? Скачанная копия останется.'))return;try{await transact('readwrite',store=>store.delete(item.id));await render();}catch{status('Не удалось удалить макет.');}};actions.append(remove);}
 return actions;
}
function showMockup(item){$('mockup-view-title').textContent=item.title;$('mockup-image').src=item.data;$('mockup-scroll').classList.remove('zoomed');$('mockup-view-status').textContent=item.details;$('mockup-view-actions').replaceChildren(actionsFor(item,true));$('mockup-view').showModal();}
async function render(){const records=(await transact('readonly',store=>store.getAll())).sort((a,b)=>b.createdAt-a.createdAt);$('mockup-count').textContent=records.length;$('mockup-list').replaceChildren();$('mockup-status').textContent=records.length?'':'Сначала примерьте фото, затем нажмите «Сохранить вид» под кружкой.';for(const item of records){const card=element('article'),img=element('img');img.src=item.data;img.alt=item.title;img.loading='lazy';img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label','Открыть крупно: '+item.title);img.onclick=()=>showMockup(item);img.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showMockup(item);}};card.append(element('h3',item.title),img,element('p',item.details),actionsFor(item));$('mockup-list').append(card);}}
window.showGallerySection=(section,refresh=true)=>{const mockups=section==='mockups';$('photos-section').hidden=mockups;$('mockups').hidden=!mockups;$('tab-photos').setAttribute('aria-pressed',String(!mockups));$('tab-mockups').setAttribute('aria-pressed',String(mockups));if(mockups&&refresh)render().catch(()=>status('Браузер не разрешил открыть макеты.'));};
function openCollection(){window.showGallerySection('mockups',false);if(!$('gallery').open)$('gallery').showModal();}
window.saveMugPreview=async({data,name,body,handle})=>{
 if(typeof data!=='string'||!data.startsWith('data:image/png;base64,')||data.length>16000000)throw Error('Некорректный снимок');
 const all=await transact('readonly',store=>store.getAll());
 if(all.length>=20){await render();openCollection();$('mockup-status').textContent='Уже 20 макетов. Скачайте нужные и удалите один, затем повторите сохранение.';throw Error('Лимит макетов');}
 const now=new Date(),stamp=now.toLocaleString('ru-RU'),id=crypto.randomUUID();
 const clean=String(name||'Моё фото').replace(/\.[^.]+$/,'').slice(0,80);
 const filename=('Кружка_'+clean+'_'+now.toISOString().replace(/[:.]/g,'-')+'.png').replace(/[\\/<>"|?*]/g,'_');
 await transact('readwrite',store=>store.put({id,data,name:clean,createdAt:now.getTime(),title:'Кружка — '+clean,details:stamp+' · Кружка: '+body+' · Ручка: '+handle,filename}));
 await render();openCollection();$('mockup-status').textContent='Макет сохранён. Можно скачать PNG сейчас или вернуться к нему позже в разделе «Макеты кружек».';
};
$('tab-photos').onclick=()=>window.showGallerySection('photos');
$('tab-mockups').onclick=()=>window.showGallerySection('mockups');
$('close-mockup-view').onclick=()=>$('mockup-view').close();
transact('readonly',store=>store.count()).then(n=>$('mockup-count').textContent=n).catch(()=>{});
