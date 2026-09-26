import {photoStorage} from './config.js?v=6';
export const storageReady=!!(photoStorage.cloudName&&photoStorage.uploadPreset);
export function isPhotoUrl(value){
 if(typeof value!=='string'||value.length>300)return false;
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash)return false;
 return (u.hostname==='i.ibb.co'&&/^\/[\w/%.~-]+$/.test(u.pathname))||
 (u.hostname==='res.cloudinary.com'&&/^\/[\w-]+\/image\/upload\/[\w/%.~-]+$/.test(u.pathname));
 }catch{return false;}
}
export async function uploadPhoto(data,signal){
 if(!storageReady)throw Error('Фотохранилище ещё не подключено.');
 const controller=new AbortController(),cancel=()=>controller.abort();
 if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(cancel,60000);
 try{
  const body=new FormData();body.append('file',data);body.append('upload_preset',photoStorage.uploadPreset);
  const response=await fetch('https://api.cloudinary.com/v1_1/'+encodeURIComponent(photoStorage.cloudName)+'/image/upload',{method:'POST',body,signal:controller.signal});
  if(!response.ok)throw Error('Фотохранилище не приняло снимок. Попробуйте позже.');
  const result=await response.json(),url=result.secure_url;
  if(!isPhotoUrl(url)||new URL(url).hostname!=='res.cloudinary.com'||new URL(url).pathname.split('/')[1]!==photoStorage.cloudName)throw Error('Фотохранилище вернуло неверную ссылку.');
  await verifyPhoto(url,controller.signal);return url;
 }catch(error){if(controller.signal.aborted)throw Error(signal?.aborted?'Загрузка отменена.':'Время загрузки истекло. Попробуйте ещё раз.');throw error;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
function verifyPhoto(url,signal){return new Promise((resolve,reject)=>{
 const image=new Image();image.crossOrigin='anonymous';
 const cleanup=()=>{image.onload=image.onerror=null;signal.removeEventListener('abort',abort);};
 const abort=()=>{cleanup();image.src='';reject(Error('Загрузка отменена.'));};
 image.onload=()=>{cleanup();resolve();};image.onerror=()=>{cleanup();reject(Error('Фото не открывается. Попробуйте загрузить снова.'));};
 if(signal.aborted)return abort();signal.addEventListener('abort',abort,{once:true});image.src=url;
});}
