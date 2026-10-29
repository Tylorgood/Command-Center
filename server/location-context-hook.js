'use strict';
const http=require('http');
const {requireAuth}=require('./auth');
const originalCreate=http.createServer.bind(http),originalWriteHead=http.ServerResponse.prototype.writeHead;
const MAX_BODY=8192;

http.ServerResponse.prototype.writeHead=function(statusCode,reason,headers){
  let h=typeof reason==='object'&&reason!==null?reason:headers;
  if(h){
    h={...h};
    for(const k of Object.keys(h)){
      if(k.toLowerCase()==='permissions-policy')h[k]=String(h[k]).replace('geolocation=()','geolocation=(self)');
      if(k.toLowerCase()==='content-security-policy'){
        let c=String(h[k]);
        if(!/frame-src\s/i.test(c))c=c.replace(/frame-ancestors\s+'none';?/i,"frame-src https://www.google.com https://maps.google.com; frame-ancestors 'none';");
        h[k]=c;
      }
    }
    if(typeof reason==='object'&&reason!==null)return originalWriteHead.call(this,statusCode,h);
    return originalWriteHead.call(this,statusCode,reason,h);
  }
  return originalWriteHead.apply(this,arguments);
};

function send(res,code,obj){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','permissions-policy':'geolocation=(self)'});res.end(JSON.stringify(obj));}
function read(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>MAX_BODY)reject(Object.assign(new Error('body_too_large'),{status:413}))});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(Object.assign(new Error('invalid_json'),{status:400}))}});req.on('error',reject)})}
function finite(v,min,max){const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?n:null}
async function getJson(url,headers={},timeout=9000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const r=await fetch(url,{headers:{accept:'application/json',...headers},signal:controller.signal});
    if(!r.ok)throw new Error(`upstream_${r.status}`);
    return await r.json();
  }finally{clearTimeout(timer)}
}
async function overpassJson(query){
  const endpoints=['https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter'];
  let lastErr=null;
  for(const base of endpoints){
    try{
      const url=base+'?data='+encodeURIComponent(query);
      return {data:await getJson(url,{'user-agent':'JARVIS-Personal-Command-Center/6.2'},12000),endpoint:base};
    }catch(e){lastErr=e}
  }
  throw lastErr||new Error('overpass_unavailable');
}
function weatherCode(code){const c=Number(code);if(c===0)return'Clear';if([1,2].includes(c))return'Partly cloudy';if(c===3)return'Cloudy';if([45,48].includes(c))return'Fog';if(c>=51&&c<=67)return'Rain';if(c>=71&&c<=77)return'Snow';if(c>=80&&c<=82)return'Showers';if(c>=95)return'Storms';return'Conditions'}
async function context(lat,lon){
  const weatherUrl=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
  const reverseUrl=`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=12&addressdetails=1`;
  const overpass=`[out:json][timeout:12];(
    nwr(around:10000,${lat},${lon})[amenity=cafe];
    nwr(around:10000,${lat},${lon})[shop=coffee];
    nwr(around:10000,${lat},${lon})[amenity=fuel];
    nwr(around:10000,${lat},${lon})[leisure=fitness_centre];
    nwr(around:10000,${lat},${lon})[leisure=sports_centre];
    nwr(around:10000,${lat},${lon})[sport=fitness];
    nwr(around:10000,${lat},${lon})[shop=fitness];
  );out center tags 120;`;

  const [w,r,n]=await Promise.allSettled([
    getJson(weatherUrl),
    getJson(reverseUrl,{'user-agent':'JARVIS-Personal-Command-Center/6.2'}),
    overpassJson(overpass)
  ]);
  const place=r.status==='fulfilled'?r.value:{},a=place.address||{};
  const name=a.city||a.town||a.village||a.suburb||a.county||'Current location';
  const cur=w.status==='fulfilled'?w.value.current:null,groups={gym:[],coffee:[],gas:[]};
  if(n.status==='fulfilled'){
    for(const x of n.value.data.elements||[]){
      const t=x.tags||{},label=t.name||t.brand||t.operator;
      if(!label)continue;
      const item={name:label,lat:x.lat??x.center?.lat,lon:x.lon??x.center?.lon,address:[t['addr:housenumber'],t['addr:street']].filter(Boolean).join(' ')||null};
      if(t.amenity==='cafe'||t.shop==='coffee')groups.coffee.push(item);
      else if(t.amenity==='fuel')groups.gas.push(item);
      else if(['fitness_centre','sports_centre'].includes(t.leisure)||t.sport==='fitness'||t.shop==='fitness')groups.gym.push(item);
    }
  }
  const rad=Math.PI/180,dist=p=>{if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon))return 999;const dlat=(p.lat-lat)*rad,dlon=(p.lon-lon)*rad,s=Math.sin(dlat/2)**2+Math.cos(lat*rad)*Math.cos(p.lat*rad)*Math.sin(dlon/2)**2;return 3958.8*2*Math.asin(Math.sqrt(s))};
  for(const k of Object.keys(groups)){
    const seen=new Set();
    groups[k]=groups[k].map(x=>({...x,distanceMiles:Number(dist(x).toFixed(1))}))
      .filter(x=>{const key=(x.name+'|'+x.lat+'|'+x.lon).toLowerCase();if(seen.has(key))return false;seen.add(key);return true})
      .sort((a,b)=>a.distanceMiles-b.distanceMiles).slice(0,8);
  }
  return{
    ok:true,verifiedAt:new Date().toISOString(),
    location:{name,region:a.state||null,country:a.country_code?.toUpperCase()||null,latitude:Number(lat.toFixed(5)),longitude:Number(lon.toFixed(5)),accuracySource:'device'},
    weather:cur?{temperature:cur.temperature_2m,feelsLike:cur.apparent_temperature,windMph:cur.wind_speed_10m,code:cur.weather_code,summary:weatherCode(cur.weather_code),observedAt:cur.time,source:'Open-Meteo'}:null,
    nearby:groups,
    sources:{reverseGeocode:r.status==='fulfilled'?'OpenStreetMap':'UNAVAILABLE',weather:w.status==='fulfilled'?'Open-Meteo':'UNAVAILABLE',nearby:n.status==='fulfilled'?`OpenStreetMap/Overpass · ${n.value.endpoint}`:'UNAVAILABLE'},
    diagnostics:{nearbyCounts:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])),nearbyError:n.status==='rejected'?String(n.reason?.message||'unavailable'):null}
  };
}
http.createServer=function(...args){
  const handler=args.pop();
  return originalCreate(...args,async(req,res)=>{
    try{
      const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
      if(u.pathname!=='/api/location-context')return handler(req,res);
      if(req.method!=='POST')return send(res,405,{error:'method_not_allowed'});
      const user=requireAuth(req,res);if(!user)return;
      const site=String(req.headers['sec-fetch-site']||'').toLowerCase();
      if(site==='cross-site')return send(res,403,{error:'cross_site_request_rejected'});
      const b=await read(req),lat=finite(b.latitude,-90,90),lon=finite(b.longitude,-180,180);
      if(lat==null||lon==null)return send(res,400,{error:'valid_coordinates_required'});
      return send(res,200,await context(lat,lon));
    }catch(e){
      console.error('location context failed',String(e.message||e).slice(0,180));
      if(!res.headersSent)return send(res,e.status||502,{error:'location_context_unavailable'});
    }
  });
};
module.exports={context};
