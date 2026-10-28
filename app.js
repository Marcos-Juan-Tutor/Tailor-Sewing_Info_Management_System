(function(){
"use strict";
var STATUSES=["New","Measured","Sewing","Fitting","Ready","Picked up"];
var TYPES=["Dress","Uniform","Suit / Formal","Alteration","Curtains","Bedding","Other"];
var BODY_TYPES=["Dress","Uniform","Suit / Formal","Alteration"];
var BODY_FIELDS=["Neck","Shoulder","Chest / Bust","Waist","Hip","Sleeve length","Back length","Inseam","Outseam","Height"];
var HOME_FIELDS=["Width","Height / Drop","Fullness","Hem / Rod pocket","Panels"];
var FILTERS=[["active","Active"],["soon","Due in 7 days"],["done","Picked up"],["cancelled","Cancelled"],["all","All"]];

var $=function(s){return document.querySelector(s)};
var els={app:$("#app"),list:$("#list"),detail:$("#detail"),chips:$("#chips"),q:$("#q"),foot:$("#foot"),cur:$("#cur"),toast:$("#toast")};
var S={orders:new Map(),sel:null,filter:"active",query:"",currency:"$",store:null,ready:false,armed:false};
var timers={},inflight={},chains={},gone={};

function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function num(v){var n=parseFloat(v);return isFinite(n)?n:0}
function money(n){return S.currency+n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
function todayStr(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function dayDiff(s){if(!s)return null;var a=new Date(s+"T00:00:00"),b=new Date(todayStr()+"T00:00:00");return Math.round((a-b)/864e5)}
function canon(o){return JSON.stringify(o,function(k,v){if(v&&typeof v==="object"&&!Array.isArray(v)){var r={};Object.keys(v).sort().forEach(function(x){r[x]=v[x]});return r}return v})}
function clone(o){return JSON.parse(JSON.stringify(o))}
function toast(msg){els.toast.textContent=msg;els.toast.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(function(){els.toast.hidden=true},2600)}

/* ---------- order helpers ---------- */
function template(type){return (BODY_TYPES.indexOf(type)>=0?BODY_FIELDS:HOME_FIELDS).map(function(l){return {label:l,value:""}})}
function nextNo(){var m=0;S.orders.forEach(function(o){var n=parseInt(String(o.no||"").replace(/\D/g,""),10);if(n>m)m=n});return "T-"+String(m+1).padStart(4,"0")}
function blank(){
  return {id:"o"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),no:nextNo(),createdAt:todayStr(),updatedAt:Date.now(),
    status:"New",cancelled:false,cancelledAt:"",customer:{name:"",phone:"",email:"",address:""},
    type:"Dress",item:"",due:"",unit:"cm",measures:template("Dress"),adjustments:"",materials:[],fee:0,deposit:0};
}
function matTotal(o){return (o.materials||[]).reduce(function(a,m){return a+num(m.cost)},0)}
function totals(o){var mt=matTotal(o),t=num(o.fee)+mt;return {mat:mt,total:t,bal:t-num(o.deposit)}}
function isDone(o){return o.status==="Picked up"}
function cur(){return S.orders.get(S.sel)}

/* ---------- persistence ---------- */
/* All reads and writes go to the PHP endpoints in /api (MySQL behind them). */
var API={orders:"api/orders.php",settings:"api/settings.php"};
function request(url,opts){
  opts=opts||{};
  if(opts.body&&typeof opts.body!=="string"){opts.body=JSON.stringify(opts.body);opts.headers={"Content-Type":"application/json"}}
  return fetch(url,opts).then(function(r){
    return r.json().catch(function(){return {}}).then(function(j){
      if(!r.ok)throw new Error(j.error||("Request failed ("+r.status+")"));
      return j;
    });
  });
}
function apiStore(){
  return {
    loadOrders:function(){return request(API.orders)},
    loadSettings:function(){return request(API.settings)},
    saveOrder:function(o){return request(API.orders,{method:"POST",body:o})},
    removeOrder:function(id){return request(API.orders+"?id="+encodeURIComponent(id),{method:"DELETE"})},
    saveSettings:function(s){return request(API.settings,{method:"POST",body:s})}
  };
}
function busy(id){return !!timers[id]||(inflight[id]||0)>0}
function queueSave(id){
  var o=S.orders.get(id);if(!o||!S.store)return;
  var snap=clone(o);inflight[id]=(inflight[id]||0)+1;
  chains[id]=(chains[id]||Promise.resolve()).then(function(){return S.store.saveOrder(snap)})
    .then(function(saved){
      /* The server may assign a different order number if two were created at once. */
      var cur2=S.orders.get(id);
      if(saved&&cur2&&saved.no&&saved.no!==cur2.no){cur2.no=saved.no;renderList();if(S.sel===id&&!timers[id])renderDetail()}
    })
    .catch(function(err){toast("Could not save: "+(err&&err.message?err.message:"check your connection"))})
    .then(function(){inflight[id]--});
}
function schedule(id,now){
  clearTimeout(timers[id]);
  if(now){delete timers[id];queueSave(id);return}
  timers[id]=setTimeout(function(){delete timers[id];queueSave(id)},550);
}
function removeOrder(id){
  clearTimeout(timers[id]);delete timers[id];
  S.orders.delete(id);gone[id]=true;
  chains[id]=(chains[id]||Promise.resolve()).then(function(){return S.store.removeOrder(id)})
    .catch(function(){toast("Could not delete the order")})
    .then(function(){delete gone[id]});
}
function onOrders(list){
  var next=new Map(),before=cur()?canon(cur()):null,selId=S.sel;
  list.forEach(function(o){if(!gone[o.id])next.set(o.id,o)});
  S.orders.forEach(function(o,id){if(busy(id))next.set(id,o)});
  S.orders=next;S.ready=true;
  if(selId&&!S.orders.has(selId)){S.sel=null;els.app.dataset.view="list";renderDetail()}
  else if(selId&&before!==canon(cur())&&!busy(selId))renderDetail();
  renderList();
}

/* ---------- list ---------- */
function matches(o){
  var q=S.query.trim().toLowerCase();
  if(q){var hay=[o.no,o.customer.name,o.customer.phone,o.customer.email,o.item,o.type].join(" ").toLowerCase();if(hay.indexOf(q)<0)return false}
  var d=dayDiff(o.due);
  switch(S.filter){
    case "active":return !o.cancelled&&!isDone(o);
    case "soon":return !o.cancelled&&!isDone(o)&&d!==null&&d<=7;
    case "done":return !o.cancelled&&isDone(o);
    case "cancelled":return !!o.cancelled;
    default:return true;
  }
}
function rank(o){return o.cancelled?2:isDone(o)?1:0}
function dueLabel(o){
  if(!o.due)return {t:"No due date",late:false};
  var d=dayDiff(o.due);
  if(o.cancelled||isDone(o))return {t:o.due,late:false};
  if(d<0)return {t:"Overdue "+(-d)+(d===-1?" day":" days"),late:true};
  if(d===0)return {t:"Due today",late:false};
  if(d===1)return {t:"Due tomorrow",late:false};
  if(d<=14)return {t:"Due in "+d+" days",late:false};
  return {t:"Due "+o.due,late:false};
}
function pillFor(o){
  if(o.cancelled)return '<span class="pill" style="--c:var(--s-cancel)">Cancelled</span>';
  var c=o.status==="New"?"var(--s-new)":o.status==="Ready"?"var(--s-ready)":isDone(o)?"var(--s-done)":"var(--s-work)";
  return '<span class="pill" style="--c:'+c+'">'+esc(o.status)+'</span>';
}
function renderChips(){
  els.chips.innerHTML=FILTERS.map(function(f){return '<button class="chip" type="button" data-filter="'+f[0]+'" aria-pressed="'+(S.filter===f[0])+'">'+f[1]+'</button>'}).join("");
}
function renderList(){
  var all=Array.from(S.orders.values());
  var rows=all.filter(matches).sort(function(a,b){
    var r=rank(a)-rank(b);if(r)return r;
    var da=a.due||"9999",db=b.due||"9999";
    if(da!==db)return da<db?-1:1;
    return (b.updatedAt||0)-(a.updatedAt||0);
  });
  if(!rows.length){
    els.list.innerHTML='<li class="empty">'+(!S.ready?"Loading orders…":all.length?"No orders match this filter.":"No orders yet. Press “New order” to write down the first one.")+'</li>';
  }else{
    els.list.innerHTML=rows.map(function(o){
      var dl=dueLabel(o),t=totals(o);
      return '<li><button class="row'+(o.cancelled?" is-cancelled":"")+'" type="button" data-open="'+esc(o.id)+'" aria-current="'+(o.id===S.sel)+'">'+
        '<div class="row-1"><span class="row-name">'+esc(o.customer.name||"Unnamed customer")+(o.sample?'<span class="tag">Sample</span>':"")+'</span><span class="row-no">'+esc(o.no)+'</span></div>'+
        '<div class="row-2">'+esc(o.item||o.type)+(o.item?" · "+esc(o.type):"")+'</div>'+
        '<div class="row-3">'+pillFor(o)+'<span class="due'+(dl.late?" late":"")+'">'+esc(dl.t)+'</span></div></button></li>';
    }).join("");
  }
  var n=all.filter(function(o){return !o.cancelled&&!isDone(o)}).length;
  els.foot.textContent=(S.ready?(n+" active of "+all.length+" orders · saved automatically"):"Loading order book…");
}

/* ---------- detail ---------- */
function field(label,path,val,opts){
  opts=opts||{};
  return '<label class="f'+(opts.full?" full":"")+'">'+label+
    (opts.area?'<textarea data-f="'+path+'" rows="'+(opts.rows||3)+'" placeholder="'+esc(opts.ph||"")+'">'+esc(val)+'</textarea>'
    :'<input data-f="'+path+'" type="'+(opts.type||"text")+'" value="'+esc(val)+'" placeholder="'+esc(opts.ph||"")+'"'+(opts.inputmode?' inputmode="'+opts.inputmode+'"':"")+(opts.step?' step="'+opts.step+'"':"")+'>')+'</label>';
}
function renderDetail(){
  var o=cur();
  if(!o){
    els.detail.innerHTML='<div class="placeholder"><div class="tape" aria-hidden="true"></div><b>Pick an order or start a new one</b><span>Each order keeps the customer, measurements, adjustments, materials, price and due date on one sheet.</span></div>';
    return;
  }
  S.armed=false;
  var stIdx=STATUSES.indexOf(o.status),t=totals(o);
  var steps=STATUSES.map(function(s,i){return '<button type="button" class="step'+(i<stIdx?" done":"")+(i===stIdx?" now":"")+'" data-act="status" data-v="'+s+'" aria-pressed="'+(i===stIdx)+'">'+s+'</button>'}).join("");
  var mrows=o.measures.map(function(m,i){
    return '<div class="mrow"><input class="lab" data-arr="measures" data-i="'+i+'" data-k="label" value="'+esc(m.label)+'" aria-label="Measurement name">'+
      '<input class="val" data-arr="measures" data-i="'+i+'" data-k="value" data-num="1" inputmode="decimal" value="'+esc(m.value)+'" placeholder="'+o.unit+'" aria-label="'+esc(m.label)+' in '+o.unit+'">'+
      '<button class="x" type="button" data-act="rm-measure" data-i="'+i+'" aria-label="Remove '+esc(m.label)+'">×</button></div>';
  }).join("");
  var mats=o.materials.map(function(m,i){
    return '<div class="mat"><input data-arr="materials" data-i="'+i+'" data-k="name" value="'+esc(m.name)+'" placeholder="e.g. Cotton twill, navy" aria-label="Material">'+
      '<input class="num" data-arr="materials" data-i="'+i+'" data-k="qty" value="'+esc(m.qty)+'" placeholder="2 m" aria-label="Quantity">'+
      '<input class="num" data-arr="materials" data-i="'+i+'" data-k="cost" data-num="1" type="number" min="0" step="any" inputmode="decimal" value="'+(num(m.cost)?num(m.cost):"")+'" placeholder="0.00" aria-label="Cost">'+
      '<button class="x" type="button" data-act="rm-mat" data-i="'+i+'" aria-label="Remove material">×</button></div>';
  }).join("");
  els.detail.innerHTML='<div class="sheet'+(o.cancelled?" cancelled":"")+'">'+
    '<div class="dhead"><button class="btn small back" type="button" data-act="back">← Orders</button><span class="no">'+esc(o.no)+' · received '+esc(o.createdAt)+'</span><span class="sp"></span>'+
      '<button class="switch" type="button" role="switch" aria-checked="'+o.cancelled+'" data-act="toggle-cancel"><span class="track"></span>Cancelled by customer</button></div>'+
    (o.cancelled?'<div class="banner">Cancelled by the customer'+(o.cancelledAt?" on "+esc(o.cancelledAt):"")+'. Switch it off to reopen the order.</div>':"")+
    '<section><h2>Customer</h2><div class="grid">'+
      field("Name","customer.name",o.customer.name,{full:true,ph:"Full name"})+
      field("Phone","customer.phone",o.customer.phone,{type:"tel",ph:"Mobile number"})+
      field("Email","customer.email",o.customer.email,{type:"email",ph:"Optional"})+
      field("Address","customer.address",o.customer.address,{full:true,area:true,rows:2,ph:"Street, city"})+
    '</div></section>'+
    '<section><h2>Item</h2><div class="grid">'+
      '<label class="f full">Item<input class="title-in" data-f="item" value="'+esc(o.item)+'" placeholder="e.g. Graduation gown, 2 school uniform sets, living room curtains"></label>'+
      '<label class="f">Type of tailoring<select data-f="type" id="typeSel">'+TYPES.map(function(x){return '<option'+(x===o.type?" selected":"")+'>'+x+'</option>'}).join("")+'</select></label>'+
      field("Due date","due",o.due,{type:"date"})+
    '</div></section>'+
    '<section><h2>Progress</h2><div class="steps">'+steps+'</div></section>'+
    '<section><div class="sec-h"><h2>Measurements</h2><div class="seg" role="group" aria-label="Unit">'+
      '<button type="button" data-act="unit" data-v="cm" aria-pressed="'+(o.unit==="cm")+'">cm</button><button type="button" data-act="unit" data-v="in" aria-pressed="'+(o.unit==="in")+'">in</button></div></div>'+
      '<div class="mrows">'+(mrows||'<span style="color:var(--muted)">No measurements yet.</span>')+'</div>'+
      '<div class="btnrow"><button class="btn small" type="button" data-act="add-measure">+ Add measurement</button>'+
      '<button class="btn small ghost" type="button" data-act="fill">Use standard '+(BODY_TYPES.indexOf(o.type)>=0?"body":"window and home")+' fields</button></div></section>'+
    '<section><h2>Adjustment requests</h2>'+field("","adjustments",o.adjustments,{full:true,area:true,rows:4,ph:"Shorten hem by 2 cm, add pockets, loosen waist, lining colour…"}).replace('class="f full"','class="f"')+'</section>'+
    '<section><h2>Materials needed</h2>'+(o.materials.length?'<div class="mat mat-h"><span>Material</span><span style="text-align:right">Qty</span><span style="text-align:right">Cost</span><span></span></div>':"")+mats+
      '<div class="btnrow"><button class="btn small" type="button" data-act="add-mat">+ Add material</button></div></section>'+
    '<section><h2>Price</h2><div class="money">'+
      '<label class="f">Tailoring fee<input data-f="fee" type="number" min="0" step="any" inputmode="decimal" value="'+(num(o.fee)?num(o.fee):"")+'" placeholder="0.00"></label>'+
      '<label class="f">Deposit paid<input data-f="deposit" type="number" min="0" step="any" inputmode="decimal" value="'+(num(o.deposit)?num(o.deposit):"")+'" placeholder="0.00"></label>'+
      '<div class="sum"><div><span>Tailoring fee</span><span id="t-fee">'+money(num(o.fee))+'</span></div><div><span>Materials</span><span id="t-mat">'+money(t.mat)+'</span></div>'+
      '<div><span>Total</span><span id="t-total">'+money(t.total)+'</span></div><div><span>Deposit paid</span><span id="t-dep">−'+money(num(o.deposit))+'</span></div>'+
      '<div class="bal"><span>Balance due</span><span id="t-bal">'+money(t.bal)+'</span></div></div></div></section>'+
    '<div><button class="btn danger" type="button" data-act="delete" id="delBtn">Delete order</button></div></div>';
}
function updateTotals(){
  var o=cur();if(!o)return;var t=totals(o),g=function(i){return document.getElementById(i)};
  if(!g("t-bal"))return;
  g("t-fee").textContent=money(num(o.fee));g("t-mat").textContent=money(t.mat);g("t-total").textContent=money(t.total);
  g("t-dep").textContent="−"+money(num(o.deposit));g("t-bal").textContent=money(t.bal);
}
function setPath(o,path,v){var p=path.split("."),x=o;for(var i=0;i<p.length-1;i++)x=x[p[i]];x[p[p.length-1]]=v}
function touch(o,now){o.updatedAt=Date.now();schedule(o.id,now);renderList()}

/* ---------- events ---------- */
els.detail.addEventListener("input",function(e){
  var t=e.target,o=cur();if(!o)return;
  if(t.dataset.f){
    var v=t.type==="number"?num(t.value):t.value;
    setPath(o,t.dataset.f,v);
    if(t.dataset.f==="type"){
      if(o.measures.every(function(m){return !String(m.value).trim()})){o.measures=template(o.type);touch(o);renderDetail();return}
      touch(o);renderDetail();return;
    }
    touch(o);updateTotals();
  }else if(t.dataset.arr){
    var row=o[t.dataset.arr][+t.dataset.i];if(!row)return;
    row[t.dataset.k]=t.dataset.num&&t.type==="number"?num(t.value):t.value;
    touch(o);updateTotals();
  }
});
els.detail.addEventListener("click",function(e){
  var b=e.target.closest("[data-act]");if(!b)return;
  var o=cur(),a=b.dataset.act;if(!o&&a!=="back")return;
  if(a==="back"){els.app.dataset.view="list";return}
  if(a==="status"){o.status=b.dataset.v;touch(o,true);renderDetail();return}
  if(a==="toggle-cancel"){o.cancelled=!o.cancelled;o.cancelledAt=o.cancelled?todayStr():"";touch(o,true);renderDetail();return}
  if(a==="unit"){
    var u=b.dataset.v;if(u===o.unit)return;
    var k=u==="in"?1/2.54:2.54;
    o.measures.forEach(function(m){if(/panel/i.test(m.label))return;var n=parseFloat(m.value);if(isFinite(n))m.value=String(Math.round(n*k*10)/10)});
    o.unit=u;touch(o,true);renderDetail();return;
  }
  if(a==="add-measure"){o.measures.push({label:"",value:""});touch(o);renderDetail();var ls=els.detail.querySelectorAll(".mrow .lab");if(ls.length)ls[ls.length-1].focus();return}
  if(a==="rm-measure"){o.measures.splice(+b.dataset.i,1);touch(o,true);renderDetail();return}
  if(a==="fill"){
    var have=o.measures.map(function(m){return m.label.toLowerCase()});
    template(o.type).forEach(function(m){if(have.indexOf(m.label.toLowerCase())<0)o.measures.push(m)});
    touch(o,true);renderDetail();return;
  }
  if(a==="add-mat"){o.materials.push({name:"",qty:"",cost:0});touch(o);renderDetail();var ms=els.detail.querySelectorAll('.mat input[data-k="name"]');if(ms.length)ms[ms.length-1].focus();return}
  if(a==="rm-mat"){o.materials.splice(+b.dataset.i,1);touch(o,true);renderDetail();return}
  if(a==="delete"){
    if(!S.armed){S.armed=true;b.textContent="Press again to delete";b.classList.add("armed");setTimeout(function(){if(S.armed&&document.body.contains(b)){S.armed=false;b.textContent="Delete order";b.classList.remove("armed")}},3500);return}
    var id=o.id;S.sel=null;removeOrder(id);els.app.dataset.view="list";renderDetail();renderList();toast("Order deleted");
  }
});
els.list.addEventListener("click",function(e){
  var b=e.target.closest("[data-open]");if(!b)return;
  S.sel=b.dataset.open;els.app.dataset.view="detail";renderDetail();renderList();els.detail.scrollTop=0;
});
els.chips.addEventListener("click",function(e){var b=e.target.closest("[data-filter]");if(!b)return;S.filter=b.dataset.filter;renderChips();renderList()});
els.q.addEventListener("input",function(){S.query=els.q.value;renderList()});
$("#newBtn").addEventListener("click",function(){
  if(!S.store){toast("Still loading, try again in a moment");return}
  var o=blank();S.orders.set(o.id,o);S.sel=o.id;S.filter=S.filter==="cancelled"||S.filter==="done"?"active":S.filter;
  schedule(o.id,true);renderChips();renderDetail();renderList();els.app.dataset.view="detail";
  var f=els.detail.querySelector('[data-f="customer.name"]');if(f)f.focus();
});
els.cur.addEventListener("input",function(){
  S.currency=els.cur.value||"$";updateTotals();renderList();
  clearTimeout(els.cur.t);els.cur.t=setTimeout(function(){if(S.store)S.store.saveSettings({currency:S.currency}).catch(function(){})},600);
});
$("#exportBtn").addEventListener("click",async function(){
  var rows=Array.from(S.orders.values());if(!rows.length){toast("No orders to export yet");return}
  var q=function(v){return '"'+String(v==null?"":v).replace(/"/g,'""')+'"'};
  var head=["Order","Received","Due","Status","Cancelled","Customer","Phone","Email","Address","Type","Item","Unit","Measurements","Adjustments","Materials","Fee","Materials cost","Total","Deposit","Balance"];
  var lines=[head.map(q).join(",")];
  rows.sort(function(a,b){return String(a.no).localeCompare(String(b.no))}).forEach(function(o){
    var t=totals(o);
    lines.push([o.no,o.createdAt,o.due,o.status,o.cancelled?"Yes":"No",o.customer.name,o.customer.phone,o.customer.email,o.customer.address,o.type,o.item,o.unit,
      o.measures.filter(function(m){return m.label||m.value}).map(function(m){return m.label+" "+m.value}).join("; "),o.adjustments,
      o.materials.map(function(m){return m.name+(m.qty?" ("+m.qty+")":"")+(num(m.cost)?" "+num(m.cost):"")}).join("; "),
      num(o.fee),t.mat,t.total,num(o.deposit),t.bal].map(q).join(","));
  });
  /* A leading BOM makes Excel read the file as UTF-8. */
  var blob=new Blob(["﻿"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="tailor-orders-"+todayStr()+".csv";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(a.href)},1000);
  toast("Orders exported");
});

/* ---------- start ---------- */
function applySettings(s){
  if(s&&s.currency&&document.activeElement!==els.cur){S.currency=s.currency;els.cur.value=s.currency;updateTotals();renderList()}
}
function refresh(){
  return S.store.loadOrders().then(onOrders).catch(function(err){
    els.foot.textContent="Could not load orders. "+(err&&err.message?err.message:"");
    if(!S.ready){S.ready=true;renderList()}
  });
}
renderChips();renderList();renderDetail();
S.store=apiStore();
S.store.loadSettings().then(applySettings).catch(function(){});
refresh();
/* Pick up changes made on another device or tab. */
setInterval(function(){if(!document.hidden)refresh()},30000);
document.addEventListener("visibilitychange",function(){if(!document.hidden&&S.store)refresh()});
})();
