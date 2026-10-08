// غراس الخير — خادم التوقيع (Cloudflare Worker، وحدة ES)
// يتحقق من مُحقِّق كلمة المرور ويصدر رمز Firebase مخصّصاً بمطالبات الدور والنطاق.
// المتغيرات السرية: FIREBASE_SA (JSON حساب الخدمة) · SESSION_SECRET (32 حرفاً فأكثر) · BOOTSTRAP_SECRET (رمز التهيئة الأولى)
// مسارات التسجيل العامة: /v1/reg/verify · /v1/reg/submit؛ وللفريق /v1/reg/codes · /v1/reg/status
// إدارة الحسابات (للمدير): /v1/creds/put · /v1/creds/get · /v1/creds/delete
// اختيارية: ALLOWED_ORIGINS (مفصولة بفواصل أو *) · ORGS (معرّفات الجمعيات المسموحة) · FIREBASE_PROJECT
const te=new TextEncoder(),td=new TextDecoder();
const b64u=b=>{const u=new Uint8Array(b);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const b64uStr=s=>b64u(te.encode(s));
const unb64u=s=>Uint8Array.from(atob(String(s).replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((String(s).length+3)%4)),c=>c.charCodeAt(0));
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const unhex=s=>new Uint8Array((String(s).match(/../g)||[]).map(h=>parseInt(h,16)));
const ctEq=(a,b)=>{a=String(a);b=String(b);let d=a.length^b.length;const n=Math.max(a.length,b.length);for(let i=0;i<n;i++)d|=(a.charCodeAt(i)|0)^(b.charCodeAt(i)|0);return d===0};
const USER_RX=/^[a-z0-9._-]{2,32}(@[a-z0-9-]+(\.[a-z0-9-]+)+)?$/,ID_RX=/^[\w-]{8,64}$/,TOK_RX=/^g1\.[\w-]{8,40}\.[\w-]{16,600}$/;
const ROLES=new Set(['admin','officer','accountant','viewer','orphan']);
class HttpError extends Error{constructor(status,code,extra=null){super(code);this.status=status;this.code=code;this.extra=extra}}

let SA=null,GTOK=null;
async function sa(env){
  if(SA)return SA;
  let j;try{j=JSON.parse(env.FIREBASE_SA)}catch{throw new HttpError(500,'CONFIG')}
  const der=Uint8Array.from(atob(String(j.private_key||'').replace(/-----[^-]+-----/g,'').replace(/\s+/g,'')),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  SA={email:j.client_email,project:env.FIREBASE_PROJECT||j.project_id,key};return SA;
}
async function jwtRS(env,payload){const s=await sa(env),h=b64uStr(JSON.stringify({alg:'RS256',typ:'JWT'})),p=b64uStr(JSON.stringify(payload));return `${h}.${p}.${b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',s.key,te.encode(h+'.'+p)))}`}
async function gToken(env){
  if(GTOK&&GTOK.exp>Date.now()+60e3)return GTOK.v;
  const s=await sa(env),now=Math.floor(Date.now()/1000);
  const assertion=await jwtRS(env,{iss:s.email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const r=await fetch(env.OAUTH_URL||'https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  const j=await r.json().catch(()=>null);if(!r.ok||!j?.access_token)throw new HttpError(502,'GOOGLE_AUTH');
  GTOK={v:j.access_token,exp:Date.now()+(Number(j.expires_in)||3600)*1000};return GTOK.v;
}
async function fs(env,path,{method='GET',body,soft=false}={}){
  const s=await sa(env);
  const r=await fetch(`${env.FIRESTORE_URL||'https://firestore.googleapis.com/v1'}/projects/${s.project}/databases/(default)/documents${path}`,{method,headers:{Authorization:'Bearer '+await gToken(env),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  if(r.status===404&&method==='GET')return null;
  const j=await r.json().catch(()=>null);if(!r.ok){if(soft)return null;throw new HttpError(502,'FIRESTORE')}return j;
}
const P=(org,coll,id)=>`/orgs/${encodeURIComponent(org)}/${coll}/${encodeURIComponent(id)}`;
const N=(s,org,coll,id)=>`projects/${s.project}/databases/(default)/documents/orgs/${org}/${coll}/${id}`;
const commit=(env,writes)=>fs(env,':commit',{method:'POST',body:{writes}});
async function credsOf(env,org,uid){const d=await fs(env,P(org,'creds',uid));try{return d?JSON.parse(d.fields.d.stringValue):null}catch{return null}}
async function uidOf(env,org,u){const d=await fs(env,P(org,'usernames',u));return d?.fields?.uid?.stringValue||null}
const pub=c=>({id:c.id,username:c.username,displayName:c.displayName,role:c.role,orphanId:c.orphanId||null,orphanCode:c.orphanCode||'',active:c.active?1:0,mustChange:c.mustChange?1:0,ep:c.ep|0,cv:String(c.verifier||'').slice(-12),_hlc:c._hlc||''});
function credWrites(s,org,c,prevName=null){
  const w=[{update:{name:N(s,org,'creds',c.id),fields:{d:{stringValue:JSON.stringify(c)}}}},
    {update:{name:N(s,org,'usernames',c.username),fields:{uid:{stringValue:c.id}}}},
    {update:{name:N(s,org,'sessions',c.id),fields:{ep:{integerValue:String(c.ep|0)}}}},
    {update:{name:N(s,org,'users',c.id),fields:{d:{stringValue:JSON.stringify(pub(c))},h:{stringValue:c._hlc||''}}},updateTransforms:[{fieldPath:'ts',setToServerValue:'REQUEST_TIME'}]}];
  if(prevName&&prevName!==c.username)w.push({delete:N(s,org,'usernames',prevName)});
  return w;
}
const pulse=(s,org,n,field='users')=>({update:{name:N(s,org,'meta','pulse'),fields:{}},updateMask:{fieldPaths:[]},updateTransforms:[{fieldPath:field,increment:{integerValue:String(n)}}]});
// التسجيل العام: رموز مجزّأة في regTokens (للخادم وحده)، حجز 20 دقيقة، واستهلاك ذرّي بشرط زمن التحديث
const REG_RX=/^[0-9A-Z]{8}$/,H64=/^[0-9a-f]{64}$/,KINDS=['portrait','birthCert','guardianId'],OPT_KINDS=['guardianship','deathFather','deathMother'],RES_MS=20*60e3;
// المفتاح العام للتسجيل كما نشره مدير النظام
async function regKey(env,org){const d=await fs(env,P(org,'meta','regkey'));try{const k=JSON.parse(d?.fields?.d?.stringValue||'null');return k&&/^[0-9a-f]{12}$/.test(k.kid)&&/^[\w-]{43}$/.test(k.x)&&/^[\w-]{43}$/.test(k.y)?{kid:k.kid,x:k.x,y:k.y}:null}catch{return null}}
const sha=async v=>hex(await crypto.subtle.digest('SHA-256',te.encode(v)));
const regH=(org,code)=>sha(`reg|${org}|${code}`);
const normRC=v=>String(v||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).toUpperCase().replace(/[^0-9A-Z]/g,'');
const hlcNow=()=>Date.now().toString(36).padStart(9,'0')+'.0000.wk';
const iv=f=>Number(f?.integerValue||0);
const batch=async(env,names)=>(await fs(env,':batchGet',{method:'POST',body:{documents:names}})||[]).filter(x=>x.found).map(x=>x.found);
const str=(v,max)=>typeof v==='string'&&v.length<=max?v:'';
function cleanCred(x){
  if(!x||typeof x!=='object')throw new HttpError(400,'BAD_INPUT');
  const c={id:str(x.id,64),username:str(x.username,64).toLowerCase(),displayName:str(x.displayName,60)||str(x.username,64),role:str(x.role,12),orphanId:x.orphanId&&ID_RX.test(x.orphanId)?x.orphanId:null,orphanCode:str(x.orphanCode,20),active:x.active?1:0,mustChange:x.mustChange?1:0,ep:Math.max(0,Number(x.ep)|0),salt:str(x.salt,64),iter:Number(x.iter)|0,verifier:str(x.verifier,64),wrap:str(x.wrap,600),tempEnc:str(x.tempEnc,600),pwEnc:str(x.pwEnc,600),_hlc:str(x._hlc,48)};
  if(!ID_RX.test(c.id)||!USER_RX.test(c.username)||!ROLES.has(c.role)||!/^[\w-]{16,64}$/.test(c.salt)||c.iter<1e4||c.iter>5e6||!/^[0-9a-f]{64}$/.test(c.verifier)||!TOK_RX.test(c.wrap)||(c.tempEnc&&!TOK_RX.test(c.tempEnc))||(c.pwEnc&&!TOK_RX.test(c.pwEnc)))throw new HttpError(400,'BAD_CRED');
  return c;
}
async function hkey(env){if(!env.SESSION_SECRET||String(env.SESSION_SECRET).length<32)throw new HttpError(500,'CONFIG');return crypto.subtle.importKey('raw',te.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign'])}
async function signSession(env,p){const h=b64uStr('{"alg":"HS256","typ":"JWT"}'),b=b64uStr(JSON.stringify(p));return `${h}.${b}.${b64u(await crypto.subtle.sign('HMAC',await hkey(env),te.encode(h+'.'+b)))}`}
async function readSession(env,org,tok){
  const[h,b,sig]=String(tok||'').split('.');if(!sig)throw new HttpError(401,'NO_SESSION');
  if(!ctEq(b64u(await crypto.subtle.sign('HMAC',await hkey(env),te.encode(h+'.'+b))),sig))throw new HttpError(401,'BAD_SESSION');
  let p;try{p=JSON.parse(td.decode(unb64u(b)))}catch{throw new HttpError(401,'BAD_SESSION')}
  if(p.org!==org||!(p.exp>Date.now()/1000))throw new HttpError(401,'EXPIRED');
  const ses=await fs(env,P(org,'sessions',p.uid));
  if(!ses||Number(ses.fields?.ep?.integerValue||0)!==(p.ep|0)){
    // سبب الإنهاء: حساب موقوف أم محذوف أم إنهاء عادي
    const c=await credsOf(env,org,p.uid);
    if(!c)throw new HttpError(401,'DELETED');
    throw c.active?new HttpError(401,'ENDED'):new HttpError(403,'SUSPENDED');
  }
  return p;
}
async function customToken(env,org,c){const s=await sa(env),now=Math.floor(Date.now()/1000);return jwtRS(env,{iss:s.email,sub:s.email,aud:'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',iat:now,exp:now+3600,uid:c.id,claims:{org,role:c.mustChange?'must':c.role,oid:c.role==='orphan'?c.orphanId||'':'',ep:c.ep|0}})}
const grant=async(env,org,c)=>({user:pub(c),token:await customToken(env,org,c),session:await signSession(env,{uid:c.id,org,role:c.role,must:c.mustChange?1:0,ep:c.ep|0,exp:Math.floor(Date.now()/1000)+43200})});
const saveCred=async(env,org,c)=>{const s=await sa(env);await commit(env,[{update:{name:N(s,org,'creds',c.id),fields:{d:{stringValue:JSON.stringify(c)}}}}])};

const H={
  // ملح ثابت وهمي لغير الموجودين حتى لا تُكشف أسماء المستخدمين
  async '/v1/salt'(env,org,body){
    const u=String(body.username||'').toLowerCase().trim();if(!USER_RX.test(u))throw new HttpError(400,'BAD_INPUT');
    const id=await uidOf(env,org,u),c=id?await credsOf(env,org,id):null;if(c)return{salt:c.salt,iter:c.iter};
    return{salt:b64u(new Uint8Array(await crypto.subtle.sign('HMAC',await hkey(env),te.encode(`salt|${org}|${u}`))).slice(0,16)),iter:600000};
  },
  async '/v1/login'(env,org,body){
    const u=String(body.username||'').toLowerCase().trim(),auth=String(body.auth||'');
    if(!USER_RX.test(u)||!/^[0-9a-f]{64}$/.test(auth))throw new HttpError(400,'BAD_INPUT');
    const id=await uidOf(env,org,u),c=id?await credsOf(env,org,id):null,now=Date.now();
    const v=hex(await crypto.subtle.digest('SHA-256',unhex(auth)));
    if(!c)throw new HttpError(401,'BAD_CREDENTIALS');
    if((c.lockUntil||0)>now)throw new HttpError(429,'LOCKED');
    if(!ctEq(v,c.verifier)){c.failed=(c.failed|0)+1;c.lockUntil=c.failed>=5?now+Math.min(900e3,30e3*2**(c.failed-5)):0;await saveCred(env,org,c);throw new HttpError(401,'BAD_CREDENTIALS')}
    // رسالة الإيقاف لا تظهر إلا بعد التحقق من كلمة المرور حتى لا تُكشف الحسابات
    if(!c.active)throw new HttpError(403,'SUSPENDED');
    if(c.failed||c.lockUntil){c.failed=0;c.lockUntil=0;await saveCred(env,org,c)}
    const kc=await fs(env,P(org,'meta','keycheck'));
    return{...await grant(env,org,c),creds:{salt:c.salt,iter:c.iter,verifier:c.verifier,wrap:c.wrap},keycheck:kc?.fields?.d?.stringValue||''};
  },
  async '/v1/session'(env,org,body){const p=await readSession(env,org,body.session);return{ok:true,uid:p.uid}},
  // المدير يرفع بيانات دخول الفريق المحمية؛ الأحدث بالساعة المنطقية يفوز
  async '/v1/creds/put'(env,org,body){
    const p=await readSession(env,org,body.session);if(p.role!=='admin'||p.must)throw new HttpError(403,'FORBIDDEN');
    const list=Array.isArray(body.users)?body.users.slice(0,100):[],s=await sa(env),writes=[];let n=0;
    for(const raw of list){
      // تحديث الملف العام فقط (دون بيانات دخول) يُبقي بيانات الدخول المخزّنة
      if(raw&&!raw.verifier){
        const id=str(raw.id,64),old=ID_RX.test(id)?await credsOf(env,org,id):null;if(!old||String(old._hlc||'')>=str(raw._hlc,48))continue;
        const role=str(raw.role,12);if(!ROLES.has(role))throw new HttpError(400,'BAD_CRED');
        const c={...old,displayName:str(raw.displayName,60)||old.displayName,role,orphanId:role==='orphan'&&ID_RX.test(String(raw.orphanId||''))?raw.orphanId:null,orphanCode:str(raw.orphanCode,20),active:raw.active?1:0,ep:Math.max(old.ep|0,Number(raw.ep)|0),_hlc:str(raw._hlc,48)};
        writes.push(...credWrites(s,org,c));n++;continue;
      }
      const c=cleanCred(raw),old=await credsOf(env,org,c.id);
      if(old&&String(old._hlc||'')>String(c._hlc||''))continue;
      const other=await uidOf(env,org,c.username);if(other&&other!==c.id)throw new HttpError(409,'USERNAME_TAKEN');
      c.ep=Math.max(c.ep,old?.ep|0);c.failed=old?.failed|0;c.lockUntil=old?.lockUntil|0;
      writes.push(...credWrites(s,org,c,old?.username));n++;
    }
    if(n){writes.push(pulse(s,org,n));await commit(env,writes)}
    return{ok:true,count:n};
  },
  // المستخدم يعيّن كلمة مروره (بما فيها التغيير الإلزامي الأول)
  async '/v1/creds/self'(env,org,body){
    const p=await readSession(env,org,body.session),old=await credsOf(env,org,p.uid);if(!old)throw new HttpError(404,'NOT_FOUND');
    const x=cleanCred({...old,...(body.creds||{}),id:old.id,username:old.username,role:old.role,orphanId:old.orphanId,active:old.active,tempEnc:''});
    const c={...old,salt:x.salt,iter:x.iter,verifier:x.verifier,wrap:x.wrap,tempEnc:'',pwEnc:x.pwEnc||'',mustChange:0,_hlc:String(x._hlc)>String(old._hlc||'')?x._hlc:old._hlc};
    const s=await sa(env);await commit(env,[...credWrites(s,org,c),pulse(s,org,1)]);
    return grant(env,org,c);
  },
  async '/v1/creds/get'(env,org,body){
    const p=await readSession(env,org,body.session);if(p.role!=='admin'||p.must)throw new HttpError(403,'FORBIDDEN');
    const c=ID_RX.test(String(body.id||''))?await credsOf(env,org,body.id):null;if(!c)throw new HttpError(404,'NOT_FOUND');
    return{tempEnc:c.mustChange?c.tempEnc||'':'',pwEnc:c.mustChange?'':c.pwEnc||'',mustChange:c.mustChange?1:0};
  },
  // حذف حساب نهائياً (حساب الدخول فقط؛ ملف اليتيم وبياناته لا تُمسّ). يُترك قبر في users كي تحذفه أجهزة المدراء
  async '/v1/creds/delete'(env,org,body){
    const p=await readSession(env,org,body.session);if(p.role!=='admin'||p.must)throw new HttpError(403,'FORBIDDEN');
    const id=String(body.id||'');if(!ID_RX.test(id))throw new HttpError(400,'BAD_INPUT');
    if(id===p.uid)throw new HttpError(400,'SELF');
    const c=await credsOf(env,org,id),s=await sa(env);
    if(c&&c.role==='admin'&&c.active){
      // لا يُحذف آخر مدير فعّال: يُتحقق من وجود مدير آخر عبر قبور/ملفات users العامة
      const docs=await fs(env,`/orgs/${encodeURIComponent(org)}/users?pageSize=300`)||{},rows=(docs.documents||[]).map(d=>{try{return JSON.parse(d.fields?.d?.stringValue||'null')}catch{return null}}).filter(Boolean);
      if(!rows.some(r=>r.id!==id&&r.role==='admin'&&r.active))throw new HttpError(409,'LAST_ADMIN');
    }
    const w=[{delete:N(s,org,'creds',id)},{delete:N(s,org,'sessions',id)},
      {update:{name:N(s,org,'users',id),fields:{del:{booleanValue:true},h:{stringValue:hlcNow()}}},updateTransforms:[{fieldPath:'ts',setToServerValue:'REQUEST_TIME'}]},pulse(s,org,1)];
    if(c?.username)w.push({delete:N(s,org,'usernames',c.username)});
    await commit(env,w);
    return{ok:true};
  },
  // المدير أو مسؤول الحالات يفعّل رموزاً جديدة (تصل مجزّأة فقط) أو يلغيها
  async '/v1/reg/codes'(env,org,body){
    const p=await readSession(env,org,body.session);if(!['admin','officer'].includes(p.role)||p.must)throw new HttpError(403,'FORBIDDEN');
    const s=await sa(env),now=Date.now(),add=Array.isArray(body.add)?body.add.slice(0,200):[],rev=Array.isArray(body.revoke)?body.revoke.slice(0,200):[];
    for(const x of add)if(!H64.test(String(x?.h))||!(Number(x.exp)>now))throw new HttpError(400,'BAD_INPUT');
    for(const h of rev)if(!H64.test(String(h)))throw new HttpError(400,'BAD_INPUT');
    const names=[...add.map(x=>x.h),...rev].map(h=>N(s,org,'regTokens',h)),have=new Map((names.length?await batch(env,names):[]).map(d=>[d.name.split('/').pop(),d])),writes=[];
    for(const x of add)if(!have.has(x.h))writes.push({update:{name:N(s,org,'regTokens',x.h),fields:{st:{stringValue:'free'},exp:{integerValue:String(Math.trunc(Math.min(Number(x.exp),now+400*864e5)))},by:{stringValue:p.uid},at:{integerValue:String(now)}}},currentDocument:{exists:false}});
    for(const h of rev){const d=have.get(h);if(d&&d.fields?.st?.stringValue==='free')writes.push({update:{name:N(s,org,'regTokens',h),fields:{st:{stringValue:'revoked'}}},updateMask:{fieldPaths:['st']},currentDocument:{updateTime:d.updateTime}})}
    if(writes.length&&!(await fs(env,':commit',{method:'POST',body:{writes},soft:true})))throw new HttpError(409,'CONFLICT');
    return{ok:true,added:writes.filter(w=>w.currentDocument?.exists===false).length};
  },
  // حالة الرموز للفريق: متاح، محجوز الآن، مستخدم، ملغى
  async '/v1/reg/status'(env,org,body){
    const p=await readSession(env,org,body.session);if(!['admin','officer'].includes(p.role)||p.must)throw new HttpError(403,'FORBIDDEN');
    const hs=(Array.isArray(body.h)?body.h:[]).filter(x=>H64.test(String(x))).slice(0,200);if(!hs.length)return{s:{}};
    const s=await sa(env),out={};
    for(const d of await batch(env,hs.map(h=>N(s,org,'regTokens',h)))){const f=d.fields||{};out[d.name.split('/').pop()]={st:f.st?.stringValue||'',until:iv(f.until),exp:iv(f.exp),usedAt:iv(f.usedAt)}}
    return{s:out};
  },
  async '/v1/reg/verify'(env,org,body){
    const code=normRC(body.code);if(!REG_RX.test(code))throw new HttpError(400,'BAD_CODE');
    const h=await regH(org,code),d=await fs(env,P(org,'regTokens',h));if(!d)throw new HttpError(404,'BAD_CODE');
    const f=d.fields||{},st=f.st?.stringValue,now=Date.now(),prev=String(body.token||'');
    if(st==='used')throw new HttpError(409,'CODE_USED');
    if(st!=='free'||iv(f.exp)<now)throw new HttpError(410,'CODE_EXPIRED');
    const mine=/^[\w-]{20,64}$/.test(prev)&&f.res?.stringValue===await sha('rt|'+prev);
    if(!mine&&iv(f.until)>now)throw new HttpError(423,'CODE_BUSY',{until:iv(f.until)});
    // صاحب الحجز يستأنف ويُمدَّد حجزه؛ غيره يحصل على حجز جديد
    const s=await sa(env),t=mine?prev:b64u(crypto.getRandomValues(new Uint8Array(24))),until=now+RES_MS;
    const ok=await fs(env,':commit',{method:'POST',soft:true,body:{writes:[{update:{name:N(s,org,'regTokens',h),fields:{res:{stringValue:await sha('rt|'+t)},until:{integerValue:String(until)}}},updateMask:{fieldPaths:['res','until']},currentDocument:{updateTime:d.updateTime}}]}});
    if(!ok)throw new HttpError(423,'CODE_BUSY');
    return{token:t,until,k:await regKey(env,org)};
  },
  async '/v1/reg/submit'(env,org,body){
    const code=normRC(body.code),t=String(body.token||''),ev=body.env;
    if(!REG_RX.test(code)||!/^[\w-]{20,64}$/.test(t))throw new HttpError(400,'BAD_INPUT');
    if(!ev||typeof ev!=='object'||ev.v!==1||!/^[0-9a-f]{12}$/.test(String(ev.kid))||!/^[\w-]{40,48}$/.test(String(ev.e?.x))||!/^[\w-]{40,48}$/.test(String(ev.e?.y))||typeof ev.p!=='string'||ev.p.length>200000||!/^[\w-]+$/.test(ev.p))throw new HttpError(400,'BAD_INPUT');
    const ph={};for(const k of [...KINDS,...OPT_KINDS]){const v=String(body.photos?.[k]||'');if(!v&&OPT_KINDS.includes(k))continue;if(v.length<100||v.length>1.3e6||!/^[A-Za-z0-9+/]+=*$/.test(v))throw new HttpError(400,'BAD_PHOTO');ph[k]=v}
    if(Object.values(ph).reduce((a,v)=>a+v.length,0)>4.2e6)throw new HttpError(413,'TOO_LARGE');
    const h=await regH(org,code),d=await fs(env,P(org,'regTokens',h));if(!d)throw new HttpError(404,'BAD_CODE');
    const f=d.fields||{},st=f.st?.stringValue;
    if(st==='used')throw new HttpError(409,'CODE_USED');
    if(st!=='free'||iv(f.exp)<Date.now())throw new HttpError(410,'CODE_EXPIRED');
    if(f.res?.stringValue!==await sha('rt|'+t))throw new HttpError(409,'RESERVATION');
    const s=await sa(env),rid=crypto.randomUUID(),now=Date.now(),hl=hlcNow();
    const rec={id:rid,code:h,status:'pending',submittedAt:now,env:{v:1,kid:ev.kid,e:{x:ev.e.x,y:ev.e.y},p:ev.p},photos:Object.keys(ph),_hlc:hl,_at:now,_by:'portal'};
    const writes=[{update:{name:N(s,org,'regTokens',h),fields:{st:{stringValue:'used'},usedAt:{integerValue:String(now)},rid:{stringValue:rid}}},updateMask:{fieldPaths:['st','usedAt','rid','res','until']},currentDocument:{updateTime:d.updateTime}},
      {update:{name:N(s,org,'regRequests',rid),fields:{d:{stringValue:JSON.stringify(rec)},h:{stringValue:hl}}},updateTransforms:[{fieldPath:'ts',setToServerValue:'REQUEST_TIME'}]},
      ...Object.keys(ph).map(k=>({update:{name:N(s,org,'regMedia',`${rid}__${k}`),fields:{b:{bytesValue:ph[k]},rid:{stringValue:rid},k:{stringValue:k}}}})),pulse(s,org,1,'regRequests')];
    if(!(await fs(env,':commit',{method:'POST',body:{writes},soft:true}))){const again=await fs(env,P(org,'regTokens',h));throw new HttpError(409,again?.fields?.st?.stringValue==='used'?'CODE_USED':'RESERVATION')}
    return{ok:true,ref:rid.slice(0,8).toUpperCase()};
  },
  async '/v1/bootstrap'(env,org,body){
    if(!env.BOOTSTRAP_SECRET||!ctEq(String(body.secret||''),env.BOOTSTRAP_SECRET))throw new HttpError(403,'BAD_SECRET');
    if(await fs(env,P(org,'meta','keycheck')))throw new HttpError(409,'ALREADY');
    const c=cleanCred(body.admin),k=String(body.keycheck||'');if(c.role!=='admin'||!TOK_RX.test(k))throw new HttpError(400,'BAD_INPUT');
    const s=await sa(env);await commit(env,[...credWrites(s,org,{...c,mustChange:0,failed:0,lockUntil:0}),{update:{name:N(s,org,'meta','keycheck'),fields:{d:{stringValue:k}}}},pulse(s,org,1)]);
    return{ok:true};
  }
};
const HITS=new Map();
function throttle(ip,path){
  if(!/login|salt|bootstrap|reg\//.test(path))return;const k=ip+'|'+path,now=Date.now(),e=HITS.get(k)||{n:0,t:now};
  if(now-e.t>60e3){e.n=0;e.t=now}e.n++;HITS.set(k,e);if(HITS.size>5000)HITS.clear();
  if(e.n>30)throw new HttpError(429,'RATE');
}
export default{
  async fetch(req,env){
    const origin=req.headers.get('Origin')||'',allow=String(env.ALLOWED_ORIGINS||'*').split(',').map(s=>s.trim());
    const cors={'Access-Control-Allow-Origin':allow.includes('*')?'*':allow.includes(origin)?origin:'null','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400',Vary:'Origin'};
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    const J=(o,st=200)=>new Response(JSON.stringify(o),{status:st,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    try{
      if(req.method!=='POST')throw new HttpError(405,'METHOD');
      const path=new URL(req.url).pathname.replace(/^.*?(\/v1\/)/,'/v1/'),fn=H[path];if(!fn)throw new HttpError(404,'NOT_FOUND');
      if(Number(req.headers.get('Content-Length')||0)>(path==='/v1/reg/submit'?4.5e6:2e6))throw new HttpError(413,'TOO_LARGE');
      let body;try{body=await req.json()}catch{throw new HttpError(400,'BAD_JSON')}
      const org=String(body?.org||'');if(!/^[a-z0-9-]{2,32}$/.test(org)||(env.ORGS&&!String(env.ORGS).split(',').map(s=>s.trim()).includes(org)))throw new HttpError(403,'ORG');
      throttle(req.headers.get('CF-Connecting-IP')||'',path);
      return J(await fn(env,org,body));
    }catch(e){return e instanceof HttpError?J({error:e.code,...(e.extra||{})},e.status):J({error:'INTERNAL'},500)}
  }
};
