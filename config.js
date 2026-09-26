// Public Firebase web configuration; no admin credentials.
export const firebaseConfig={apiKey:"AIzaSyB2X3o7KwYFkMfsskKoWpQYBrws8L-Mn9w",authDomain:"photo-gallery-18193.firebaseapp.com",projectId:"photo-gallery-18193",databaseURL:"https://photo-gallery-18193-default-rtdb.firebaseio.com",storageBucket:"photo-gallery-18193.firebasestorage.app",messagingSenderId:"329094770221",appId:"1:329094770221:web:b9d076f195f968668212a4"};
// Enabled after the owner confirmed publishing the isolated gallery rules.
export const cloudEnabled=true;
// Add the owner’s actual shop URL when supplied.
export const shopUrl="";

// Public Cloudinary unsigned-upload identifiers, never an API secret.
// Enable only after applying the URL validation in database.rules.fragment.json.
export const photoStorage={cloudName:"",uploadPreset:""};

// Prepared cloud. Activate only after owner claims it and gallery URL rules are applied.
export const pendingPhotoStorage={"cloudName":"neak9spw","uploadPreset":"photo_preview_5cc146127d19","claimDeadline":"2026-09-27T14:01:14Z"};
