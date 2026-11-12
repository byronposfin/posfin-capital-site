import test from 'node:test';import assert from 'node:assert/strict';
import {validate} from '../lib/ff-schema.js';
import {assessLand,belowMinimum,validateLand,renderLandScorecard} from '../lib/ff-land.js';
const base={asset_type:'Land',property_value:200000,loan_amount:1,secured_lending:'No, it’s unencumbered',ownership_status:'I own it',price_paid:100000,purchase_date:'2020-01',other_encumbrances:'No',planning_status:'None',term_months:'6'};
test('security gate boundary, no loan floor, terms and server-derived suppression',()=>{
 for(const value of [0,150000,199999,200000,200001])assert.equal(belowMinimum({...base,property_value:value}),value<200000);
 for(const term of ['6','9','12','18','24'])assert.equal(validateLand({...base,term_months:term},true).errors.term_months,undefined);
 assert.ok(validateLand({...base,term_months:'36'},true).errors.term_months);
 assert.equal(validateLand(base,true).errors.loan_amount,undefined);
 const d=validate({...base,property_value:150000,no_chase:false},false).clean;assert.equal(d.no_chase,true);assert.equal(d.decline_reason,'Below minimum value');
 const fixed=validate({...d,property_value:200000},false).clean;assert.equal(fixed.no_chase,false);assert.equal(fixed.decline_reason,null);
});
test('unknown charges cannot score as exact zero; repeat normalisation preserves unknown',()=>{
 for(const balance of ['Not sure',null,'',undefined]){const a={...base,secured_lending:'Yes',charges:[{lender:'Test',balance,position:'First charge',titles:'TEST1',status:'Up to date',redemption:'Not sure'}]};const clean=validate(a,false).clean;assert.equal(clean.charges[0].balance,null);assert.equal(assessLand(clean).checks.find(x=>x[0]==='Charge disclosures')[1],false);assert.equal(validate(JSON.parse(JSON.stringify(clean)),false).clean.charges[0].balance,null);}
 for(const balance of ['-1','10-20'])assert.ok(validate({...base,secured_lending:'Yes',charges:[{balance}]},true).errors.charges);
});
test('no planning is not decline; hidden fields clear; forged score never survives',()=>{
 const a=validate({...base,planning_references:'stale',land_scorecard:{score:100,lender_ready:true},secured_lending:'No, it’s unencumbered',charges:[{balance:999}]},false).clean;
 assert.equal(a.no_chase,false);assert.equal(a.planning_references,undefined);assert.deepEqual(a.charges,[]);assert.equal(a.land_scorecard.lender_ready,false);assert.match(renderLandScorecard(a),/Independent valuation/);
});
test('carry-forward preserves gross request meaning instead of relabelling it net',()=>{
 const a=validate({...base,loan_basis:'Gross borrowing amount',purpose:'Business / working capital'},false).clean;
 assert.equal(a.loan_basis,'Gross borrowing amount');assert.equal(a.purpose,'Business / working capital');assert.match(renderLandScorecard(a),/Gross amount requested/);assert.doesNotMatch(renderLandScorecard(a),/Net cash requested/);
});
