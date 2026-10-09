#!/usr/bin/env node
'use strict';
// Executed only by the offline GitHub research publisher. Never by the server
// or visiting browsers. This output is frozen as an immutable weekly record.
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(__dirname,'../public/research/data');
const base=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const observedAt=process.argv[3];
const O=require('../public/research/opportunities.js');
const M=require('../public/research/metrics.js');
function attach(kind) {
  const file=path.join(dir,kind,base.year+'.json');
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if (data.schema!==1 || data.year!==base.year ||
      data.throughWeek!==base.throughWeek || data.baseUpdated!==base.updated) {
    throw Error('Refusing to capture receipts from stale '+kind+' source');
  }
  if (kind==='usage') M.attachUsage(base.players,data);
  else M.attachRedzone(base.players,data);
}
attach('usage');attach('redzone');
const signals=O.radar(base,'half').map(s=>({...s,modelVersion:'radar-v1'}));
const record={
  schema:1,year:base.year,throughWeek:base.throughWeek,recordedAt:observedAt,
  modelVersion:'radar-v1',format:'half',
  sourceUpdated:base.updated,signals
};
process.stdout.write(JSON.stringify(record)+'\n');
