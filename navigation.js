(() => {
  const menu = document.getElementById('site-menu');
  document.getElementById('open-menu').onclick = () => menu.showModal();
  document.getElementById('close-menu').onclick = () => menu.close();
  for (const id of ['open-gallery','open-comments','open-mockups']) document.getElementById(id).addEventListener('click', () => menu.close(), {capture:true});
  menu.addEventListener('click', e => { if(e.target === menu){ const r=menu.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)menu.close(); } });
})();
