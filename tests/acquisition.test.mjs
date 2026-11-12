import test from 'node:test';import assert from 'node:assert/strict';
import {validate,normalisePurpose} from '../lib/ff-schema.js';
const expected='Acquisition finance — larger / corporate transaction';
test('Acquisition aliases persist and route identically after save/resume normalisation',()=>{
 for(const key of ['purpose','loanPurpose','loan_purpose'])for(const val of ['Acquisition Finance','acquisition_finance',expected]){
 const first=validate({[key]:val,asset_type:'Hotel'},false,false);assert.equal(first.clean.purpose,expected);assert.equal(first.clean.resolved_route,'acquisition_finance');assert.deepEqual(first.errors,{});
 assert.equal(validate(JSON.parse(JSON.stringify(first.clean)),false,false).clean.purpose,expected);
 }
});
test('Unknown purpose is not silently converted, and canonical edits take precedence',()=>{
 assert.equal(normalisePurpose('Unknown acquisition type'),'Unknown acquisition type');
 assert.ok(validate({purpose:'Unknown acquisition type'},false,false).errors.purpose);
 assert.equal(validate({purpose:'Property purchase',loanPurpose:'Acquisition Finance'},false,false).clean.purpose,'Property purchase');
 assert.equal(validate({purpose:'',loanPurpose:'Acquisition Finance'},true,false).errors.purpose,'Required');
});
