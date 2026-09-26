# Фотокружка — примерочная

Интерактивная 3D-кружка, жёлтая ручка-сердце, волшебный подлёт фотографии, готовый видеопример объятия, независимые цвета кружки и ручки. Покупки и платежи здесь не предусмотрены.

## Что работает

- 3D-примерка и вращение, выбор цвета, загрузка своего фото.
- Галерея в браузере (IndexedDB), до 20 снимков, даты и удаление.
- Сохранение цветов с фотографией и повторная примерка.
- Подготовлен вход Google через существующий Firebase `photo-gallery-18193`.
- Реализована облачная галерея и публичные текстовые отзывы, но они **выключены**, пока не проверены правила доступа.
- Своя фотография не анимирует людей автоматически. Объятие есть только в готовом видеопримере.

Файлы снимков сохраняются как уменьшенные JPEG для примерки (до 1280 пикселей и 250 000 символов). Это не архив оригиналов для печати. В локальном режиме данные доступны только в том же браузере и исчезнут при очистке данных сайта. При входе появляется отдельная галерея аккаунта; гостевые фото не переносятся автоматически.

## Размещение

Статический сайт, сборка для запуска не нужна. Откройте `index.html` через HTTP-сервер: `python3 -m http.server 8000`. В GitHub Pages можно выбрать Deploy from a branch → main → /(root). Настройки размещения пока не изменены. Условия выбранного хостинга необходимо учитывать для конечного назначения сайта.

## Подключение Firebase без изменения «Ёлок-палок»

1. В Authentication → Settings → Authorized domains должен быть `derev-studio.github.io`. Google должен быть включён в Sign-in method.
2. Сначала сохраните текущие Realtime Database → Rules и проверьте их. Не заменяйте существующие правила целиком: другой сайт использует эту же базу.
3. Файл `database.rules.fragment.json` — **фрагмент** для добавления внутрь существующего объекта `rules`. Он выделяет `photoPreviewV1`, защищает фото по UID, разрешает публичное чтение отзывов и автору удаление своего отзыва. Лимит галереи — 20 фиксированных слотов, до 250 000 символов на снимок.
4. На корневом пути базы и на `photoPreviewV1` не должно быть разрешающего общего `.read` или `.write`. В Realtime Database дочернее правило не отменяет разрешение родителя. Если сейчас в корне стоит общий доступ, нужно сначала аккуратно перенести разрешения старого сайта на его собственные пути, сохранив его работу. Не включайте синхронизацию до этой проверки.
5. Проверьте в симуляторе/эмуляторе: гость и другой UID не читают/не изменяют галерею; владелец сохраняет и удаляет свой снимок; нельзя создать слот p20, отправить слишком большой снимок или изменить чужой отзыв. Правила не развёрнуты и ещё не проверены на реальном проекте.
6. Только после проверки поменяйте `cloudEnabled` на `true` в `config.js`.
7. Пришлите URL магазина или внесите его в `shopUrl` в `config.js`. Пока URL не задан, ссылка в магазин скрыта.

Существующая база других сайтов не читалась и не менялась. ImgBB в этой версии не используется: маленькие копии хранятся в закрытых записях Realtime Database после включения правил, а не по публичным ссылкам. Бесплатный лимит базы общий для всех сайтов проекта, это не безлимитное фотохранилище. Тариф проекта и остаток квоты нужно проверить в консоли. Платные функции не включались.

## Проверка

Локально проверены галерея, перезагрузка, повторная примерка, цвета, удаление и мобильная ширина. Реальный вход Google, межустройственная синхронизация и публикация отзывов требуют настроенного Firebase и проверяются после настройки. Публичные отзывы ограничены 500 символами; перед массовым запуском стоит добавить модерацию/защиту от спама.

## Исходники

`viewer.js` — Three.js, `viewer.bundle.js` — собранный браузерный файл; `app.js`, `app.css`, `config.js` — приложение. Для пересборки: `npm install`, затем `npm run build`. Бинарная модель `heart-mug.glb`, фотография и видеопример лежат отдельно для кеширования. Лицензия Three.js — `THREE-LICENSE.txt`.


## Обновление 3: крупные фотографии и общая галерея

Исправлен пролёт фотографии сквозь поверхность кружки. Анимированная сетка проверяет зазор относительно керамики на каждом кадре и остаётся тем же слоем после посадки; смены изображения или исчезновения в конце нет. Этот слой входит в объект кружки и вращается вместе с ним. В начале полёта фотография показана крупно.

После загрузки и по нажатию на миниатюру открывается крупный просмотр. Кнопка «Примерить с волшебством» запускает анимацию своего снимка. На мобильном экране карточки занимают всю ширину.

«Отзывы» переименованы в «Галерею работ». Можно оставить текст или добровольно прикрепить общедоступное фото. Используется официальный загрузчик ImgBB https://imgbb.com/plugin в изолированном iframe без доступа к Firebase-сессии. API-ключи не публикуются. Снимок загружается пользователем в окно ImgBB, затем ссылка добавляется к публикации. В Firebase хранится обычная Markdown-ссылка и подпись в существующем поле comments.text (вместе до 500 символов), поэтому новые правила базы не требуются. Поддерживаются только HTTPS-изображения с i.ibb.co; HTML от посетителей не исполняется. Старые текстовые отзывы сохраняются.

Личные уменьшенные копии в «Мои фото» по-прежнему хранятся в закрытой галерее Firebase. Их нельзя автоматически переносить на ImgBB, сохраняя обещание приватности. Публикация выполняется отдельно и добровольно. Удаление записи из общей галереи удаляет ссылку/подпись; удалять сам файл на ImgBB нужно средствами ImgBB. Сервис внешнего хранения и его доступность зависят от ImgBB; реальные загрузки пользователей в ходе разработки не выполнялись.

### Direct photo storage (prepared, account setup required)

The v5 uploader uses a native file picker and Cloudinary's unsigned image upload API.
No ImgBB frame or third-party upload widget is loaded. New photo bytes are never
written to Firebase: until storage is configured, new personal photos remain in
IndexedDB under the current account/browser. Existing cloud photos remain readable;
there is no automatic migration or publication. Uploaded files are accessible to
anyone with their URL; listing a work publicly still requires an explicit publication.

To enable:
1. Use the owner's Cloudinary Free account and create an **unsigned** upload preset
   dedicated to this site. Restrict accepted formats to jpg/png/webp/avif, file size
   to 5 MB, and use random unique filenames. Do not enable overwrite. Set a dedicated
   folder such as `photo-preview`. Unsigned presets are public upload capabilities;
   monitor quota and delete unwanted files in the account console.
2. In the existing Firebase rules, update **only** the `photoPreviewV1` subtree from
   `database.rules.fragment.json`. Do not replace the full shared database rules with
   `database.rules.transition.json` (historical setup snapshot).
3. Set `photoStorage.cloudName` and `photoStorage.uploadPreset` in `config.js`.
   These identifiers are public. Never put API secrets into this repository.
4. Run `npm ci && npm run build`, then test a real upload, a publication, reload,
   and personal-gallery reload using the owner's test account on desktop and phone.

Cloudinary Free has a shared credit allowance for storage, delivery and processing,
not unlimited storage. Deleting a gallery entry removes its metadata/local copy;
provider files must be managed separately by the owner. Originals should be kept.

Current connection: owner cloud `i1lysqxk`, existing unsigned preset `kaktus`. Real upload and image delivery (HTTP 200 with CORS) verified. Preset settings are unchanged. Public image attachment is enabled. Personal photos upload to Cloudinary, but their link index stays in this browser while `galleryLinkSyncEnabled=false`. After applying only the isolated gallery URL rules, enable that flag to restore account synchronization.

2026-09-26: owner confirmed the isolated Firebase URL rules were published. `galleryLinkSyncEnabled=true`: new signed-in gallery additions sync metadata and Cloudinary links to Firebase. Earlier browser-only items are not migrated automatically; use Save mug colors on an existing selected Cloudinary-backed item to sync it. Anonymous guest images remain browser-local. No live authenticated cross-device test has been performed by the agent.
