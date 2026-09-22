const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/1c85-v4.html'),'utf8');
function between(a,b){return source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));}
function setup(p,st='ok'){
  const c={CLIENTS:[{p,st,o:p==='Ипотека'?'Недвижимость':p==='ОСАГО'?'ТС':'Здоровье',num:'123',n:'Тест',sk:'СК',price:'1000'}],contractIssued:false,PROC_STATUS:{},cases:[],clientCaseView:()=>null,skLogoImg:()=>'',docRow:n=>n,qrSvg:()=>'',procActiveReq:()=>'',ctile:(k)=>'ACTION:'+k,ccross:(i,n)=>n,toast(){}};
  c.procForPolicy=()=>c.cases;
  vm.createContext(c);
  vm.runInContext(between('function procEscape(','/* Поля по причинам')+between('function screenContract(i)','/* ===== прочие экраны'),c);
  return c;
}
test('health exposes only its loss path; mortgage has no car extras or foreign workflows',()=>{
  for(const p of ['Антиклещ','НС Спорт','Несч. случай','Ипотека']){
    const c=setup(p),html=c.screenContract(0);
    assert.doesNotMatch(html,/Предложите клиенту ещё|ACTION:change|ACTION:cancel|МиниКАСКО/);
    assert.equal(html.includes('ACTION:loss'),p!=='Ипотека');
    assert.equal(c.contractStartAllowed(0,'change'),false);
    assert.equal(c.contractStartAllowed(0,'cancel'),false);
    assert.equal(c.contractStartAllowed(0,'loss'),p!=='Ипотека');
  }
});
test('unfinished and cancelled contracts do not expose purchase or servicing actions',()=>{
  for(const st of ['draft','pay','wait','cancelled']){
    const c=setup('ОСАГО',st);
    assert.doesNotMatch(c.screenContract(0),/ACTION:|Предложите клиенту ещё|Квитанция об оплате|Скачать документы/);
    assert.equal(c.contractCanStart(0,'loss'),false);
  }
  const c=setup('ОСАГО');c.cases=[{kind:'cancel',cstatus:'done'}];
  assert.doesNotMatch(c.screenContract(0),/ACTION:|Предложите клиенту ещё/);
});
test('period, payment and purchased extras come only from explicit contract facts',()=>{
  const c=setup('ОСАГО');let html=c.screenContract(0);
  assert.doesNotMatch(html,/Итого, клиент оплатил|Полис МиниКАСКО|Квитанция об оплате|21.07.2027/);
  assert.match(html,/ACTION:change/);
  Object.assign(c.CLIENTS[0],{startDate:'01.01.2026',endDate:'31.12.2026',paymentConfirmed:true,addon:{name:'МиниКАСКО',num:'AD-1',price:500,paid:true}});
  html=c.screenContract(0);assert.match(html,/01.01.2026 — 31.12.2026/);assert.match(html,/Квитанция об оплате/);assert.match(html,/Полис МиниКАСКО/);
});
