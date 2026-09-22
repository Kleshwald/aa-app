const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/1c85-v4.html'),'utf8');
function part(a,b){return source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));}
function setup(){
  const ctx={CLIENTS:[{p:'ОСАГО',num:'123',n:'Тест',sk:'СК'}],render(){},toast(){},supRerender(){},supUpdateBadge(){},procApply(){},procIsLoss(){return false;},document:{getElementById(){return {checked:ctx.checked};}},checked:false};
  ctx.item={id:'1',kind:'cancel',cstatus:'in_work'};
  ctx.supFind=()=>ctx.item;
  ctx.procCreateCase=(idx,kind,payload)=>{ctx.payload=payload;ctx.count=(ctx.count||0)+1;return '1';};
  vm.createContext(ctx);
  vm.runInContext([
    part('var CANCEL_REASONS=','/* Возврат части премии'),
    part('function procEscape(','/* Поля по причинам'),
    part('var cancelIdx=','var lossIdx='),
    part('function procSetStatus(','function procGenNo('),
    part('function procCancelDone(','function procReject('),
    part('function cancelSupportSet(','function lossSortFiles(')
  ].join('\n'),ctx);
  return ctx;
}
test('two steps, six reasons, draft survives Back; one submission without fabricated refund',()=>{
  const c=setup();assert.equal(c.CANCEL_REASONS.length,6);
  assert.equal(c.cancelNext(),false);assert.equal(c.cancelSubmit(),false);
  c.cancelClaimant='Представитель страхователя';c.cancelPick('theft');
  assert.equal(c.cancelNext(),true);c.cancelComment='Комментарий';
  c.cancelStep=1;c.cancelNext();assert.equal(c.cancelComment,'Комментарий');
  assert.match(c.screenCancel(),/Не определена/);assert.doesNotMatch(c.screenCancel(),/14 календарных|≈/);
  assert.equal(c.cancelSubmit(),true);assert.equal(c.cancelSubmit(),false);assert.equal(c.count,1);
  assert.equal(c.payload.claimant,'Представитель страхователя');assert.equal(c.payload.cancelData.reason,'Угон автомобиля');
  assert.equal(c.payload.refund,undefined);
});
test('completion requires explicit returned-money confirmation and rejects repeats',()=>{
  const c=setup();assert.equal(c.procSetStatus('1','done','support'),false);
  assert.equal(c.procCancelDone('1'),false);
  c.checked=true;assert.equal(c.procCancelDone('1'),true);
  assert.equal(c.item.cstatus,'done');assert.equal(c.item.refundConfirmed,true);
  assert.equal(c.procCancelDone('1'),false);
});
test('unknown and zero refund differ; confirmed case cannot be edited',()=>{
  const c=setup();c.cancelSupportSet('1','refund','');assert.equal(c.item.refund,null);
  c.cancelSupportSet('1','refund','0');assert.equal(c.item.refund,0);
  c.cancelSupportSet('1','refund','1200,50');assert.equal(c.item.refund,1200.5);
  c.item.refundConfirmed=true;c.cancelSupportSet('1','refund','3');assert.equal(c.item.refund,1200.5);
});
