import test from 'node:test';import assert from 'node:assert/strict';
import {validate,O} from '../lib/ff-schema.js';import {resolveRoute,branchVisible,BRANCH_FIELDS} from '../lib/ff-routing.js';
test('Residential leads the list; inactive branches never survive save or resume normalization',()=>{
 assert.equal(O.asset_type[0],'Residential');assert.equal(O.asset_type.filter(a=>a==='Residential').length,1);
 const a={asset_type:'Land with Planning',residential_type:'House',site_current_use:'Bare land',funding_build:'Yes',planning_status:'Full',planning_references:'SYNTHETIC-PLAN',consent_implemented:'No',planning_expiry:'2027-12-31'};
 let c=validate(a,false,true).clean;assert.equal(c.residential_type,undefined);assert.equal(c.planning_references,a.planning_references);assert.equal(c.resolved_route,'development_finance');
 c=validate(JSON.parse(JSON.stringify(c)),false,true).clean;assert.equal(c.planning_expiry,'2027-12-31');
 c=validate({...c,asset_type:'General Commercial'},false,true).clean;assert.equal(c.planning_references,undefined);assert.equal(c.site_current_use,undefined);assert.equal(c.residential_type,undefined);
 c=validate({...a,planning_status:'None'},false,true).clean;assert.equal(c.planning_references,undefined);assert.equal(c.planning_expiry,undefined);
 assert.equal(validate({security_postcode:'sw6 5aa'},false,true).clean.security_postcode,'SW6 5AA');
});
test('Land, habitable dwelling, build funding and general product routes match recovered map',()=>{
 for(const [a,route] of [[{asset_type:'Land with No Planning',site_current_use:'Bare land',funding_build:'No'},'pa_land'],[{asset_type:'Farm',site_current_use:'Habitable dwelling in use',funding_build:'No'},'main_loan'],[{asset_type:'Land with Planning',site_current_use:'Bare land',funding_build:'Yes'},'development_finance'],[{asset_type:'Land with Planning'},'senior_desk'],[{purpose:'Development exit'},'development_exit_finance'],[{purpose:'Auction purchase'},'auction_finance'],[{purpose:'Acquisition finance — larger / corporate transaction'},'acquisition_finance'],[{charge_position:'Equitable charge / speed-loan route'},'speed_loan']])assert.equal(resolveRoute(a),route);
 const farm=BRANCH_FIELDS.find(f=>f.key==='farm_operation');assert.equal(branchVisible(farm,{asset_type:'Residential',includes_farmland:'Yes'}),true);
});
