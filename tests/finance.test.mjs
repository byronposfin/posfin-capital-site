import test from 'node:test';import assert from 'node:assert/strict';
import {money,calculate,renderScorecard} from '../lib/ff-finance.js';import {validate} from '../lib/ff-schema.js';
const base={loan_amount:200000,property_value:700000,first_charge_balance:100000,arrears:'Yes',first_charge_arrears_amount:5000,arrears_included_in_balance:'Balance includes arrears',second_charges:'Yes',second_charge_balance:40000,charge_position:'Second charge — current mortgage stays in place',redemption_structure:'Add on top of requested amount',legal_buffer:'2000',contingency_buffer:'0'};
test('45k redemptions on top / within 200k; legal and contingency separate',()=>{
 let c=calculate(base);assert.equal(c.mandatory,45000);assert.equal(c.cash,200000);assert.equal(c.facility,247000);assert.equal(c.retainedFirst,95000);
 c=calculate({...base,redemption_structure:'Deduct within requested amount',contingency_buffer:'5000'});assert.equal(c.cash,155000);assert.equal(c.facility,207000);assert.equal(c.mandatory,45000);
 c=calculate({...base,contingency_buffer:'10000'});assert.equal(c.facility,257000);
});
test('arrears inside/outside mortgage counted once, first mortgage replacement explicit',()=>{
 assert.equal(calculate({...base,arrears_included_in_balance:'Balance excludes arrears'}).retainedFirst,100000);
 let c=calculate({...base,charge_position:'First charge — replacing/clearing the current lender'});assert.equal(c.mandatory,140000);assert.equal(c.retainedFirst,0);
 c=calculate({...base,charge_position:'First charge — replacing/clearing the current lender',arrears_included_in_balance:'Balance excludes arrears'});assert.equal(c.mandatory,145000);
});
test('strict money: explicit zero, unknown, malformed and negative remain distinct',()=>{
 for(const v of [0,'0','£0','0.00'])assert.equal(money(v),0);
 for(const v of [null,undefined,'','TBC','Not sure'])assert.equal(money(v),null);
 for(const v of [-1,'-100','40-50k','1,2,3','1e3',Infinity,'£5,000.10'])assert.ok(Number.isNaN(money(v)),String(v));
 assert.equal(money('£40,000'),40000);
});
test('unknown debts stay unresolved over validation + JSON + repeat; no false facility or LTV',()=>{
 for(const value of [null,'','Not sure','TBC']){
 const a={...base,second_charge_balance:value};let clean=validate(a,false,false).clean;clean=validate(JSON.parse(JSON.stringify(clean)),false,false).clean;
 assert.equal(clean.second_charge_balance,null);const c=calculate(clean);assert.equal(c.mandatory,null);assert.equal(c.facility,null);assert.equal(c.ltv,null);assert.match(renderScorecard(clean),/To confirm/);
 }
 assert.equal(calculate({...base,arrears_included_in_balance:'Not sure'}).ltv,null);
 assert.equal(calculate({...base,redemption_structure:'Not sure — discuss on call'}).cash,null);
});
test('confirmed no second charge clears stale debt; no arrears clears stale amount',()=>{
 const c=validate({...base,second_charges:'No',second_charge_balance:40000,second_charge_provider:'Stale',arrears:'No',first_charge_arrears_amount:5000},false,false).clean;
 assert.equal(c.second_charge_balance,0);assert.equal(c.second_charge_provider,undefined);assert.equal(c.first_charge_arrears_amount,0);
});
test('negative/range debt rejected, not silently converted; insufficient requested amount unresolved',()=>{
 for(const n of ['-5000','40000-50000'])assert.ok(validate({...base,second_charge_balance:n},false,false).errors.second_charge_balance);
 const c=calculate({...base,loan_amount:20000,redemption_structure:'Deduct within requested amount'});assert.equal(c.cash,null);assert.equal(c.facility,null);
});
