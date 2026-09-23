const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../public/1c85-v4.html'),'utf8');
function fn(name){const start=html.indexOf('function '+name+'(');assert.ok(start>=0);return html.slice(start,html.indexOf('\n}',start)+2);}
test('release quote component routes AP to its workflow and normal quotes to payment',()=>{
  const c={skLogoImg:()=>''};vm.createContext(c);vm.runInContext(fn('offerHtml'),c);
  const q={sk:'Поддержка',svc:'autoassistant',req:true,svcName:'Автопомощник',svcPrice:'2 450',price:'5 385',type:'Перестраховочный пул'};
  assert.match(c.offerHtml(q,5,false),/onclick="apChooseQuote\(5\)"/);
  assert.doesNotMatch(c.offerHtml(q,5,false),/onclick="osagoPay/);
  assert.match(c.offerHtml({...q,svc:'off',req:false},0,false),/onclick="osagoPay/);
  assert.ok(html.indexOf('apCaptureQuote();',html.indexOf('function osagoCalc()'))<html.indexOf('ocalcStop();',html.indexOf('function osagoCalc()')));
});
test('release OSAGO and health issuance preserve existing process indexes',()=>{
  const original={n:'Existing AP'},pending={policyIdx:0};
  const c={CLIENTS:[original],SUP:[pending],OSAGO_PENDING:{base:'5990',sk:'Test',addon:{name:'НС при ДТП',price:800}},OSAGO_DRAFT:{name:'Holder',obj:'Car',plate:'TEST'},apQuoteSnapshot:{startDate:'23.09.2026',endDate:'22.09.2027'},HL:{prod:'tick',term:'year',start:'2026-09-23',holder:'Health holder',selPrice:1200,sel:'Test'},HL_TERMS:{year:['Год',12]},hlFmt:String,hlDateRu:()=> '23.09.2026',hlEndRu:()=> '22.09.2027'};
  vm.createContext(c);vm.runInContext(fn('osagoBirth')+'\n'+fn('hlBirth'),c);
  const i=c.osagoBirth('ok');assert.equal(i,1);assert.equal(c.CLIENTS[0],original);assert.equal(pending.policyIdx,0);assert.equal(c.CLIENTS[i].paymentConfirmed,true);assert.equal(c.CLIENTS[i].addon.paid,true);
  const j=c.hlBirth('ok');assert.equal(j,2);assert.equal(c.CLIENTS[0],original);assert.equal(pending.policyIdx,0);assert.equal(c.CLIENTS[j].startDate,'23.09.2026');
  const k=c.osagoBirth('pay');assert.equal(c.CLIENTS[k].paymentConfirmed,false);assert.equal(c.CLIENTS[k].addon,undefined);
});
test('main styling is active while local processes and AP assets remain',()=>{
  assert.doesNotMatch(html,/<link[^>]*approved-design\.css/);
  for(const asset of ['autoassistant.js','autoassistant.css','process-integration.css'])assert.ok(html.includes(asset));
  for(const name of ['screenHealth','screenMortgage','screenProfile','openChange','openLoss','openCancel','openContract'])assert.ok(html.includes('function '+name+'('),name);
  assert.match(html,/if\(!c.autoassistant\) docs=/);
  assert.doesNotMatch(html,/^<<<<<<<|^=======|^>>>>>>>/m);
});
test('AP reads drivers from the release form including separate licence rows',()=>{
  const inputs={oDLn:'Первый',oDFn:'Водитель',oDMn:'Тестович',oDLicS:'1111',oDLicN:'222222',oDExp:'2010-01-01',oD2Ln:'Второй',oD2Fn:'Водитель',oD2Mn:'Тестович',oD2LicS:'3333',oD2LicN:'444444',oD2Exp:'2012-01-01'};
  const driverSection={querySelector:q=>q==='.osec__title'?{textContent:'Водители'}:null,querySelectorAll:q=>q==='input[id]'?Object.entries(inputs).map(([id,value])=>({id,value})):[]};
  const root={querySelectorAll:()=>[driverSection],querySelector:()=>null};
  const c={document:{getElementById:id=>id==='osagoScreen'?root:{value:inputs[id]||''}}};
  vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/autoassistant.js'),'utf8'),c);c.apCaptureQuote();
  assert.equal(c.apQuoteSnapshot.drivers.length,2);
  assert.equal(c.apQuoteSnapshot.drivers[0].licenseNumber,'1111 222222');
  assert.equal(c.apQuoteSnapshot.drivers[1].experienceSince,'2012-01-01');
  assert.equal(c.apQuoteSnapshot.drivers[1].fullName,'Второй Водитель Тестович');
});
