const $=id=>document.getElementById(id);
const database=new Promise((resolve,reject)=>{const request=indexedDB.open('photo-preview-mockups',1);request.onupgradeneeded=()=>request.result.createObjectStore('views',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
// Consume startup rejection even if the visitor never opens their local collection.
database.catch(()=>{});
async function transact(mode,fn){const db=await database;return new Promise((resolve,reject)=>{const tx=db.transaction('views',mode),request=fn(tx.objectStore('views'));tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Сохранение отменено'));});}
function element(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;}
async function render(){const records=(await transact('readonly',store=>store.getAll())).sort((a,b)=>b.createdAt-a.createdAt);$('mockup-count').textContent=records.length;$('mockup-list').replaceChildren();$('mockup-status').textContent=records.length?'':'Здесь появятся сохранённые виды кружек.';for(const item of records){const card=element('article'),img=element('img');img.src=item.data;img.alt=item.title;img.loading='lazy';const link=element('a','Скачать PNG');link.href=item.data;link.download=item.filename;const remove=element('button','Удалить');remove.onclick=async()=>{if(!confirm('Удалить этот макет из браузера? Скачанная копия останется.'))return;try{await transact('readwrite',store=>store.delete(item.id));await render();}catch{$('mockup-status').textContent='Не удалось удалить макет.';}};const actions=element('div');actions.className='actions';actions.append(link,remove);card.append(element('h3',item.title),img,element('p',item.details),actions);$('mockup-list').append(card);}}
window.saveMugPreview=async({data,name,body,handle})=>{
 if(typeof data!=='string'||!data.startsWith('data:image/png;base64,')||data.length>16000000)throw Error('Некорректный снимок');
 const all=await transact('readonly',store=>store.getAll());
 if(all.length>=20){await render();$('mockups').showModal();$('mockup-status').textContent='Уже 20 макетов. Скачайте нужные и удалите один, затем повторите сохранение.';throw Error('Лимит макетов');}
 const now=new Date(),stamp=now.toLocaleString('ru-RU'),id=crypto.randomUUID();
 const clean=String(name||'Моё фото').replace(/\.[^.]+$/,'').slice(0,80);
 const filename=('Кружка_'+clean+'_'+now.toISOString().replace(/[:.]/g,'-')+'.png').replace(/[\\/<>"|?*]/g,'_');
 await transact('readwrite',store=>store.put({id,data,name:clean,createdAt:now.getTime(),title:'Кружка — '+clean,details:stamp+' · Кружка: '+body+' · Ручка: '+handle,filename}));
 await render();$('mockups').showModal();$('mockup-status').textContent='Макет сохранён. Можно скачать PNG сейчас или вернуться к нему позже через меню.';
};
$('open-mockups').onclick=async()=>{$('mockups').showModal();try{await render();}catch{$('mockup-status').textContent='Браузер не разрешил открыть хранилище макетов.';}};
$('close-mockups').onclick=()=>$('mockups').close();
transact('readonly',store=>store.count()).then(n=>$('mockup-count').textContent=n).catch(()=>{});
