import {uploadPhoto,storageReady} from './photo-storage.js?v=7';
const effects={remove:'e_background_removal/f_png',fill:'c_pad,w_1536,h_1024,b_gen_fill'};
export function transformUrl(url,kind){
 const u=new URL(url);
 if(u.origin!=='https://res.cloudinary.com'||!/^\/i1lysqxk\/image\/upload\/v\d+\/[\w/.-]+$/.test(u.pathname)||!effects[kind])throw Error('Не удалось подготовить фото для обработки.');
 return url.replace('/upload/','/upload/'+effects[kind]+'/');
}
export async function processPhoto(url,kind,signal){
 const target=transformUrl(url,kind);
 for(let i=0;i<24;i++){
  signal.throwIfAborted();
  const response=await fetch(target,{signal});
  if(response.ok){const blob=await response.blob();if(!blob.type.startsWith('image/'))throw Error('Сервис не вернул фотографию.');return blob;}
  if(![420,423].includes(response.status))throw Error('ИИ сейчас недоступен: возможно, исчерпан лимит Cloudinary. Оригинал сохранён.');
  await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('Отменено','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},2500);signal.addEventListener('abort',abort,{once:true});});
 }
 throw Error('Обработка ещё не завершена. Попробуйте позже.');
}
export function setupPhotoAI({getItem,saveCopy}){
 const $=id=>document.getElementById(id),panel=$('ai-photo-tools'),status=$('ai-photo-status');
 let original=null,result=null,objectURL='',controller=null,epoch=0,kind='';
 const buttons=()=>panel.querySelectorAll('button');
 const lock=value=>buttons().forEach(b=>b.disabled=value);
 const reset=()=>{epoch++;controller?.abort();controller=null;if(objectURL)URL.revokeObjectURL(objectURL);objectURL='';result=null;original=null;$('large-apply').disabled=false;lock(false);$('ai-result-actions').hidden=true;status.textContent='Обработка в Cloudinary. Оригинал останется; результат можно сохранить копией.';};
 $('large-photo').addEventListener('close',reset);
 async function run(effect){
  const item=getItem();if(!item||!storageReady)return;
  reset();original={...item};kind=effect;const token=epoch;controller=new AbortController();const signal=controller.signal;
  lock(true);status.textContent='ИИ обрабатывает фото… Можно закрыть окно для отмены.';
  const timer=setTimeout(()=>controller?.abort(),90000);
  try{
   let url=item.data;
   if(!/^https:\/\/res.cloudinary.com\/i1lysqxk\/image\/upload\/v\d+\//.test(url)){
    const r=await fetch(url,{signal});if(!r.ok)throw Error('Не удалось прочитать оригинал.');url=await uploadPhoto(await r.blob(),signal);
   }
   result=await processPhoto(url,effect,signal);if(token!==epoch)return;
   objectURL=URL.createObjectURL(result);const im=new Image();im.src=objectURL;await im.decode();if(token!==epoch)return;
   $('large-image').src=objectURL;$('large-apply').disabled=true;$('ai-result-actions').hidden=false;status.textContent='Готово. Сравните и сохраните понравившийся результат.';
  }catch(e){if(token===epoch)status.textContent=e.name==='AbortError'?'Обработка отменена или заняла слишком много времени.':e.message;}
  finally{clearTimeout(timer);if(token===epoch){controller=null;lock(false);}}
 }
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
