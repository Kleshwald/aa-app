const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../public/1c85-v4.html'), 'utf8');
function setup() {
  const ctx = vm.createContext({
    PROL: [{kind:'osago', n:'Иванов', plate:'А123ВС', license:'1234'}],
    prolEmptyDemo:false, prolPreviousTab:'osago', prolTab:'health',
    prolNsis:{fio:'Иванов',plate:'',license:'',searched:true},
    prolCloseMenu(){}, render(){}, document:{getElementById(){return {focus(){}};}},
  });
  vm.runInContext(html.slice(html.indexOf('function prolHasPolicies(){'), html.indexOf('function prolCloseMenu(')), ctx);
  ctx.prolNsisForm = () => 'NSIS';
  ctx.prolListForm = () => 'POLICIES';
  return ctx;
}
test('preview keeps only NSIS, preserves search data and restores previous tab', () => {
  const c = setup();
  c.prolToggleEmpty();
  const out = c.screenProlongation();
  assert.match(out, /Полисы для пролонгации скоро появятся/);
  assert.equal((out.match(/role="tab"/g)||[]).length, 0);
  assert.match(out, /role="region" aria-label="Поиск по базе НСИС"/);
  assert.match(out, /class="prol-preview-menu" popover/);
  assert.doesNotMatch(out, /class="prol-demo"|class="chip-note"/);
  assert.equal(c.prolNsisRows().length, 1);
  assert.equal(c.PROL.length, 1);
  c.prolSwitch('osago');
  assert.equal(c.prolTab,'nsis');
  c.prolToggleEmpty();
  assert.equal(c.prolTab,'health');
  assert.equal((c.screenProlongation().match(/role="tab"/g)||[]).length, 3);
});
test('genuinely empty renewal source automatically shows NSIS', () => {
  const c = setup(); c.PROL=[];
  assert.match(c.screenProlongation(), /Полисы для пролонгации скоро появятся/);
  assert.equal(c.prolTab,'nsis');
});
test('filters do not control availability; monthly health alone is not a renewal portfolio', () => {
  const c = setup(); c.prolState={health:{q:'не найдено',from:'2099-01-01'}};
  assert.equal(c.prolHasPolicies(),true);
  c.PROL=[{kind:'health',annual:false}];
  assert.equal(c.prolHasPolicies(),false);
  c.PROL[0].annual=true;
  assert.equal(c.prolHasPolicies(),true);
});
