import {uploadPhoto,storageReady} from './photo-storage.js?v=7';
export const effectNames={remove:'без фона',edges:'чёткие края',extract:'выделенный объект',fill:'расширенное',restore:'восстановленное',enhance:'свет и цвет',auto:'улучшенное',upscale:'увеличенное',erase:'без лишнего',replace:'замена объекта',recolor:'новый цвет',generate:'новый ИИ-фон',background:'новый фон'};
const effects={remove:'e_background_removal/f_png',edges:'e_background_removal:fineedges_n/f_png',fill:'c_pad,w_1536,h_1024,b_gen_fill',restore:'e_gen_restore',enhance:'e_enhance',auto:'e_auto_enhance',upscale:'c_limit,w_1600,h_1600/e_upscale/c_limit,w_4096,h_4096'};
function prompt(value){
 const text=String(value||'').trim();if(!text||text.length>180)throw Error('Введите описание до 180 символов.');
 // Only words and punctuation that cannot introduce URL transformation syntax.
 if(!/^[\p{L}\p{N} ,.!?\-]+$/u.test(text))throw Error('Используйте слова, цифры, пробелы и простую пунктуацию.');
 return encodeURIComponent(text).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16));
}
export function transformUrl(url,kind,options={}){
 const u=new URL(url);
 if(u.origin!=='https://res.cloudinary.com'||!/^\/i1lysqxk\/image\/upload\/v\d+\/[\w/.-]+$/.test(u.pathname)||!Object.hasOwn(effectNames,kind))throw Error('Не удалось подготовить фото для обработки.');
 let effect=effects[kind];
 if(kind==='extract')effect='e_extract:prompt_'+prompt(options.prompt)+'/f_png';
 if(kind==='erase')effect='e_gen_remove:prompt_'+prompt(options.prompt);
 if(kind==='replace')effect='e_gen_replace:from_'+prompt(options.prompt)+';to_'+prompt(options.to);
 if(kind==='generate')effect='e_gen_background_replace:prompt_'+prompt(options.prompt);
 if(kind==='recolor'){
  if(!/^#[0-9a-f]{6}$/i.test(options.color||''))throw Error('Выберите цвет.');
  effect='e_gen_recolor:prompt_'+prompt(options.prompt)+';to-color_'+options.color.slice(1);
 }
 if(!effect)throw Error('Неизвестная обработка.');
 return url.replace('/upload/','/upload/'+effect+'/');
}
export async function processPhoto(url,kind,signal,options={}){
 const target=transformUrl(url,kind,options);
 for(let i=0;i<24;i++){
  signal.throwIfAborted();
  const response=await fetch(target,{signal});
  if(response.ok){const blob=await response.blob();if(!blob.type.startsWith('image/'))throw Error('Сервис не вернул фотографию.');return blob;}
  if(![420,423].includes(response.status))throw Error('ИИ сейчас недоступен: возможно, исчерпан лимит Cloudinary. Оригинал сохранён.');
  await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('Отменено','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},2500);signal.addEventListener('abort',abort,{once:true});});
 }
 throw Error('Обработка ещё не завершена. Попробуйте позже.');
}
export async function composeBackground(foreground,background){
 const urls=[URL.createObjectURL(foreground),URL.createObjectURL(background)];
 try{
  const images=await Promise.all(urls.map(async url=>{const im=new Image();im.src=url;await im.decode();return im;}));
  const [front,back]=images,c=document.createElement('canvas'),scale=Math.min(1,2560/Math.max(front.naturalWidth,front.naturalHeight));
  c.width=Math.round(front.naturalWidth*scale);c.height=Math.round(front.naturalHeight*scale);
  const ctx=c.getContext('2d'),cover=Math.max(c.width/back.naturalWidth,c.height/back.naturalHeight);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
  ctx.drawImage(back,(c.width-back.naturalWidth*cover)/2,(c.height-back.naturalHeight*cover)/2,back.naturalWidth*cover,back.naturalHeight*cover);
  ctx.drawImage(front,0,0,c.width,c.height);
  return await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Не удалось собрать фото.')),'image/png'));
 }finally{urls.forEach(url=>URL.revokeObjectURL(url));}
}
export function setupPhotoAI({getItem,saveCopy}){
 const $=id=>document.getElementById(id),panel=$('ai-photo-tools'),status=$('ai-photo-status');
 let original=null,result=null,objectURL='',controller=null,epoch=0,kind='',cutout=null;
 const buttons=()=>panel.querySelectorAll('button');
 const lock=value=>buttons().forEach(b=>b.disabled=value);
 const reset=()=>{epoch++;controller?.abort();controller=null;if(objectURL)URL.revokeObjectURL(objectURL);objectURL='';result=null;original=null;cutout=null;$('large-apply').disabled=false;lock(false);$('ai-result-actions').hidden=true;status.textContent='Обработка в Cloudinary. Оригинал останется; результат можно сохранить копией.';};
 $('large-photo').addEventListener('close',reset);
 async function run(effect,background,options={}){
  try{transformUrl("https://res.cloudinary.com/i1lysqxk/image/upload/v1/check.jpg",effect==='background'?'remove':effect,options);}catch(e){status.textContent=e.message;return;}
  const item=getItem();if(!item||!storageReady)return;
  const cachedCutout=cutout;reset();$('large-image').src=item.data;original={...item};kind=effect;const token=epoch;controller=new AbortController();const signal=controller.signal;
  lock(true);status.textContent='ИИ обрабатывает фото… Можно закрыть окно для отмены.';
  const timer=setTimeout(()=>controller?.abort(),90000);
  try{
   let url=item.data;
   if(!(effect==='background'&&cachedCutout)&&!/^https:\/\/res.cloudinary.com\/i1lysqxk\/image\/upload\/v\d+\//.test(url)){
    const r=await fetch(url,{signal});if(!r.ok)throw Error('Не удалось прочитать оригинал.');url=await uploadPhoto(await r.blob(),signal);
   }
   const processed=effect==='background'&&cachedCutout?cachedCutout:await processPhoto(url,effect==='background'?'remove':effect,signal,options);if(token!==epoch)return;
   if(['remove','edges','extract','background'].includes(effect))cutout=processed;
   result=background?await composeBackground(processed,background):processed;if(token!==epoch)return;
   objectURL=URL.createObjectURL(result);const im=new Image();im.src=objectURL;await im.decode();if(token!==epoch)return;
   $('large-image').src=objectURL;$('large-apply').disabled=true;$('ai-result-actions').hidden=false;status.textContent='Готово. Сравните и сохраните понравившийся результат.';
  }catch(e){if(token===epoch)status.textContent=e.name==='AbortError'?'Обработка отменена или заняла слишком много времени.':e.message;}
  finally{clearTimeout(timer);if(token===epoch){controller=null;lock(false);}}
 }
 $('ai-background').onclick=()=>$('ai-background-file').click();
 $('ai-background-file').onchange=e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  if(file.size>20*1024*1024){status.textContent='Выберите фон до 20 МБ.';return;}
  if(!/^image\/(jpeg|png|webp|avif)$/.test(file.type)){status.textContent='Для фона нужен JPG, PNG, WebP или AVIF. HEIC сохраните как JPG.';return;}
  run('background',file);
 };
 panel.querySelectorAll('[data-ai-effect]').forEach(b=>b.onclick=()=>run(b.dataset.aiEffect));
 $('ai-command').onclick=()=>run($('ai-operation').value,undefined,{prompt:$('ai-prompt').value,to:$('ai-replacement').value,color:$('ai-color').value});
 $('ai-operation').onchange=()=>{
  const operation=$('ai-operation').value;
  $('ai-replacement-label').hidden=operation!=='replace';$('ai-color-label').hidden=operation!=='recolor';
  $('ai-prompt-label').firstChild.textContent=operation==='generate'?'Опишите новый фон':operation==='extract'?'Что сохранить на фото?':'Какой объект изменить?';
 };
 $('ai-remove').onclick=()=>run('remove');$('ai-fill').onclick=()=>run('fill');
 $('ai-before').onclick=()=>{if(original)$('large-image').src=original.data;};
 $('ai-after').onclick=()=>{if(objectURL)$('large-image').src=objectURL;};
 $('ai-save').onclick=async()=>{
  if(!result||!original)return;lock(true);const token=epoch;
  try{await saveCopy(result,original,kind);if(token===epoch){reset();status.textContent='Копия сохранена в вашей галерее. Теперь её можно примерить.';}}
  catch(e){if(token===epoch)status.textContent=e.message;}
  finally{if(token===epoch)lock(false);}
 };
 return reset;
}
