import {firebaseConfig,cloudEnabled,shopUrl} from './config.js?v=5';
import {storageReady,uploadPhoto,isPhotoUrl} from './photo-storage.js?v=5';
const $=id=>document.getElementById(id),ROOT='photoPreviewV1';
let user=null,auth,db,api,items=[],selected=null,scope='guest',revision=0,unsubscribe,commentUnsubscribe,busy=false;
let noticeTimer,largeItem=null,publicImageUrl='',publicUploadPending=false,publicImageVersion=0,uploadController=null,posting=false;
function notice(message){$('notice').textContent=message;$('notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('visible'),5500);}
const localDB=new Promise((resolve,reject)=>{const r=indexedDB.open('photo-preview-local',1);r.onupgradeneeded=()=>r.result.createObjectStore('galleries');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function localRead(key){const d=await localDB;return new Promise((resolve,reject)=>{const r=d.transaction('galleries').objectStore('galleries').get(key);r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});}
async function localWrite(key,value){const d=await localDB;return new Promise((resolve,reject)=>{const t=d.transaction('galleries','readwrite');t.objectStore('galleries').put(value,key);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}
function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
function accountUI(){
 $('login').hidden=!!user;$('logout').hidden=!user;
 $('account-state').textContent=user?'Вы вошли: '+(user.displayName||'Пользователь'):'Без входа — галерея этого браузера.';
 $('cloud-state').textContent=storageReady&&cloudEnabled?(user?'Фото сохраняются между устройствами. Файлы доступны по прямой ссылке, но не публикуются в общей галерее автоматически.':'Войдите через Google для облачного сохранения. Гостевые фото остаются на устройстве.'):'Новые снимки сохраняются только в этом браузере. Облачное фотохранилище ещё не подключено. Ранее сохранённые фото аккаунта доступны после входа.';
 $('comments-state').textContent=cloudEnabled?(user?'Поделитесь фотографией и подписью — публикацию увидят все.':'Войдите через Google, чтобы опубликовать работу.'):'Публикация отзывов ещё не подключена.';
 $('comment-text').disabled=!(cloudEnabled&&user&&api);$('send-comment').disabled=!(cloudEnabled&&user&&api)||publicUploadPending||posting;
}
function render(){
 $('count').textContent=items.length;$('gallery-empty').hidden=items.length>0;const grid=$('gallery-grid');grid.replaceChildren();
 for(const item of [...items].sort((a,b)=>b.createdAt-a.createdAt)){
 const card=node('article',undefined,'card');card.dataset.selected=String(item.id===selected);const img=node('img');img.src=item.data;img.alt=item.name;img.loading='lazy';img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label','Открыть крупно: '+item.name);img.onclick=()=>showLarge(item);img.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showLarge(item);}};
 const info=node('div',undefined,'info');info.append(node('h3',item.name));const date=node('time',new Date(item.createdAt).toLocaleDateString('ru-RU'));date.dateTime=new Date(item.createdAt).toISOString();info.append(date);
 const actions=node('div',undefined,'actions');const use=node('button','Примерить');use.onclick=()=>showLarge(item);const del=node('button','Удалить');del.onclick=async()=>{if(!confirm('Удалить этот снимок из галереи?'))return;try{await remove(item.id);notice('Фото удалено из галереи.');}catch{notice('Не удалось удалить. Попробуйте ещё раз.');}};actions.append(use,del);info.append(actions);card.append(img,info);grid.append(card);
 }
}
async function loadScope(){const current=++revision;unsubscribe?.();unsubscribe=null;selected=null;items=[];render();const key=scope;
 let local=[];try{local=await localRead(key);}catch{notice('Не удалось открыть сохранённые фото браузера.');}if(current!==revision)return;
 const merge=remote=>{items=[...new Map([...remote,...local].map(x=>[x.id,x])).values()];render();};merge([]);
 if(cloudEnabled&&user&&api)unsubscribe=api.onValue(api.ref(db,ROOT+'/galleries/'+user.uid),s=>{if(current===revision)merge(Object.values(s.val()||{}));},()=>notice('Облачная галерея недоступна. Фото браузера сохранены.'));
}
async function write(item){const key=scope,token=revision;
 // Firebase receives links only. Existing inline photos remain readable, never re-uploaded silently.
 if(cloudEnabled&&user&&api&&isPhotoUrl(item.data)){
  await api.set(api.ref(db,ROOT+'/galleries/'+user.uid+'/'+item.id),item);
  const saved=await localRead(key);await localWrite(key,saved.filter(x=>x.id!==item.id));
 }else{const saved=await localRead(key);await localWrite(key,[...saved.filter(x=>x.id!==item.id),item]);}
 if(token===revision)await loadScope();
}
async function remove(id){const key=scope,token=revision;if(cloudEnabled&&user&&api)await api.remove(api.ref(db,ROOT+'/galleries/'+user.uid+'/'+id));const saved=await localRead(key);await localWrite(key,saved.filter(x=>x.id!==id));if(token===revision)await loadScope();}
async function compress(file){
 if(file.size>20*1024*1024)throw Error('Выберите фото до 20 МБ.');
 if(!/^image\/(jpeg|png|webp|avif|heic|heif)$/i.test(file.type))throw Error('Нужна фотография JPG, PNG или WebP.');
 const url=URL.createObjectURL(file);try{const im=new Image();im.src=url;try{await im.decode();}catch{throw Error('Не удалось прочитать фото. Сохраните HEIC в JPG.');}
 const c=document.createElement('canvas');let side=2560;for(let i=0;i<8;i++){const scale=Math.min(1,side/Math.max(im.width,im.height));c.width=Math.max(1,Math.round(im.width*scale));c.height=Math.max(1,Math.round(im.height*scale));const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(im,0,0,c.width,c.height);const data=c.toDataURL('image/jpeg',.84-i*.055);if(data.length<=4000000)return data;side=Math.round(side*.8);}throw Error('Фото слишком сложное для сохранения. Попробуйте уменьшить его.');}finally{URL.revokeObjectURL(url);}
}
async function add(file,preview=true){if(busy)return;busy=true;const token=revision;try{
 if(items.length>=20)throw Error('В галерее уже 20 фото. Удалите ненужное, чтобы добавить новое.');notice('Готовлю снимок…');let data=await compress(file);if(cloudEnabled&&user&&storageReady){notice('Загружаю фотографию…');data=await uploadPhoto(data);}if(token!==revision)throw Error('Аккаунт изменился. Добавьте фото ещё раз.');
 const state=$('viewer').contentWindow.demo?.getState();const item={id:Array.from({length:20},(_,i)=>'p'+i).find(id=>!items.some(x=>x.id===id)),name:file.name.slice(0,120),data,createdAt:Date.now(),body:state?.bodyColor||'#f7f7f7',handle:state?.handleColor||'#ffd02a'};await write(item);selected=item.id;render();showLarge(item);notice(isPhotoUrl(data)?'Фото сохранено в аккаунте.':'Фото сохранено в этом браузере.');
 }catch(e){notice(e.message||'Не удалось сохранить фото.');}finally{busy=false;}}
function showLarge(item){$('photo-scroll').classList.remove('zoomed');$('photo-zoom').setAttribute('aria-pressed','false');$('photo-zoom').textContent='Увеличить ×2';largeItem=item;$('large-title').textContent=item.name||'Фотография';$('large-image').src=item.data;$('large-apply').hidden=!item.id;if(!$('large-photo').open)$('large-photo').showModal();}
$('close-large').onclick=$('large-close').onclick=()=>$('large-photo').close();
$('large-apply').onclick=()=>{if(largeItem){apply(largeItem);$('large-photo').close();}};
function apply(item){if(!$('viewer').contentWindow.__ready){notice('Кружка ещё загружается. Попробуйте через несколько секунд.');return;}selected=item.id;render();$('viewer').contentWindow.postMessage({type:'preview-photo',data:item.data,name:item.name,body:item.body,handle:item.handle},location.origin);$('gallery').close();}
$('open-gallery').onclick=()=>$('gallery').showModal();$('open-comments').onclick=()=>$('comments').showModal();document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('add-photo').onclick=()=>$('gallery-file').click();$('gallery-file').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)add(f);};
$('save-design').onclick=async()=>{const item=items.find(x=>x.id===selected),state=$('viewer').contentWindow.demo?.getState();if(!item||!state){notice('Сначала примерьте снимок из галереи.');return;}try{await write({...item,body:state.bodyColor,handle:state.handleColor});notice('Цвета сохранены вместе с фото.');}catch{notice('Не удалось сохранить цвета.');}};
addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==$('viewer').contentWindow)return;if(e.data?.type==='photo-chosen'&&e.data.file instanceof File)add(e.data.file,false);if(e.data?.type==='preview-error')notice('Не удалось примерить снимок.');});
if(shopUrl){try{const url=new URL(shopUrl);if(url.protocol==='https:'){$('shop').href=url.href;$('shop').hidden=false;}}catch{}}
let initPromise;
function initFirebase(){return initPromise||=(async()=>{
 const [app,A,D]=await Promise.all([import('https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js')]);
 const firebase=app.getApps()[0]||app.initializeApp(firebaseConfig);api={...A,...D};auth=A.getAuth(firebase);db=D.getDatabase(firebase);
 await A.setPersistence(auth,A.browserLocalPersistence);
 A.onAuthStateChanged(auth,u=>{if(user?.uid!==u?.uid){clearPublic();$('comment-text').value='';}user=u;scope=u?u.uid:'guest';accountUI();renderComments();loadScope();});
 if(cloudEnabled)listenComments();return api;
 })().catch(e=>{initPromise=null;throw e;});}
$('login').onclick=async()=>{try{if(!api){notice('Подключаю вход Google. Через секунду нажмите ещё раз.');await initFirebase();notice('Готово. Нажмите «Войти через Google».');return;}await api.signInWithPopup(auth,new api.GoogleAuthProvider());}catch(e){notice(e.code==='auth/unauthorized-domain'?'Для входа нужно разрешить домен сайта в Firebase.':e.code==='auth/popup-closed-by-user'?'Окно входа закрыто.':e.code==='auth/popup-blocked'?'Браузер заблокировал окно Google. Разрешите всплывающие окна для сайта.':'Вход недоступен. Проверьте интернет и попробуйте снова.');}};
$('logout').onclick=async()=>{try{await api.signOut(auth);notice('Вы вышли из аккаунта.');}catch{notice('Не удалось выйти. Попробуйте снова.');}};
let comments=[];
function renderComments(){const list=$('comment-list');list.replaceChildren();for(const c of comments){const el=node('article',undefined,'comment');el.append(node('strong',c.author||'Посетитель'));const match=String(c.text||'').match(/^!\[Фото\]\((https:\/\/[^\s)]+)\)\n?/);if(match&&isPhotoUrl(match[1])){const pic=node('img');pic.src=match[1];pic.alt='Работа '+(c.author||'посетителя');pic.loading='lazy';pic.referrerPolicy='no-referrer';pic.tabIndex=0;pic.setAttribute('role','button');pic.setAttribute('aria-label','Открыть фотографию крупно');pic.onclick=()=>showLarge({name:c.author||'Фотография',data:match[1]});pic.onkeydown=e=>{if(e.key==='Enter')pic.click();};el.append(pic);}el.append(node('p',match?c.text.slice(match[0].length):c.text),node('time',new Date(c.createdAt).toLocaleString('ru-RU')));if(user?.uid===c.uid){const del=node('button','Удалить');del.onclick=async()=>{if(!confirm('Удалить публикацию? Файл в фотохранилище останется; владелец сайта может удалить его отдельно.'))return;try{await api.remove(api.ref(db,ROOT+'/comments/'+c.id));}catch{notice('Не удалось удалить отзыв.');}};el.append(del);}list.append(el);}}
function listenComments(){commentUnsubscribe?.();commentUnsubscribe=api.onValue(api.query(api.ref(db,ROOT+'/comments'),api.orderByChild('createdAt'),api.limitToLast(50)),s=>{comments=Object.entries(s.val()||{}).map(([id,v])=>({...v,id})).sort((a,b)=>b.createdAt-a.createdAt);renderComments();},()=>{$('comments-state').textContent='Отзывы временно недоступны.';});}
$('comment-form').onsubmit=async e=>{e.preventDefault();if(posting)return;if(publicUploadPending){notice('Дождитесь фотографии в предпросмотре или отмените её добавление.');return;}const caption=$('comment-text').value.trim();const text=(publicImageUrl?'![Фото]('+publicImageUrl+')\n':'')+caption;if(!user||!cloudEnabled||!api||!text)return;if(text.length>500){notice('Сократите подпись: вместе со ссылкой допускается 500 символов.');return;}posting=true;$('send-comment').disabled=true;try{await api.set(api.push(api.ref(db,ROOT+'/comments')),{uid:user.uid,author:(user.displayName||'Посетитель').slice(0,80),text,createdAt:api.serverTimestamp()});$('comment-text').value='';clearPublic();notice('Работа опубликована в общей галерее.');}catch{notice('Не удалось опубликовать отзыв.');}finally{posting=false;accountUI();}};
accountUI();loadScope();initFirebase().then(()=>accountUI()).catch(()=>{$('account-state').textContent='Google пока недоступен. Локальная примерка работает.';});

function clearPublic(){uploadController?.abort();uploadController=null;publicImageUrl='';publicUploadPending=false;publicImageVersion++;$('public-preview').hidden=true;$('public-image').removeAttribute('src');$('comment-text').required=true;$('attach-public').hidden=false;$('cancel-public').hidden=true;$('upload-status').textContent='';accountUI();}
$('remove-public').onclick=$('cancel-public').onclick=clearPublic;
$('attach-public').onclick=()=>{
 if(!user){notice('Сначала войдите через Google.');return;}
 if(!storageReady){$('upload-status').textContent='Загрузка в фотохранилище ещё не подключена. Примерка и сохранение фото в браузере работают.';return;}
 $('public-file').click();
};
$('public-file').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 clearPublic();const version=publicImageVersion,token=revision;uploadController=new AbortController();
 publicUploadPending=true;$('cancel-public').hidden=false;$('attach-public').hidden=true;accountUI();
 try{
  $('upload-status').textContent='Готовлю фотографию…';const data=await compress(file);
  if(version!==publicImageVersion||token!==revision)return;
  $('public-image').src=data;$('public-preview').hidden=false;
  $('upload-status').textContent='Загружаю фотографию…';const url=await uploadPhoto(data,uploadController.signal);
  if(version!==publicImageVersion||token!==revision)return;
  publicImageUrl=url;publicUploadPending=false;$('public-image').src=url;$('comment-text').required=false;
  $('upload-status').textContent='Фото прикреплено. Теперь можно опубликовать.';
 }catch(err){if(version!==publicImageVersion||token!==revision)return;$('upload-status').textContent=err.message||'Не удалось загрузить фото.';$('attach-public').hidden=false;}
 finally{accountUI();}
};

$('photo-zoom').onclick=()=>{const zoomed=$('photo-scroll').classList.toggle('zoomed');$('photo-zoom').setAttribute('aria-pressed',String(zoomed));$('photo-zoom').textContent=zoomed?'Показать целиком':'Увеличить ×2';};
