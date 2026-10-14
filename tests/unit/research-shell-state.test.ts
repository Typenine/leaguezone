import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const app=readFileSync('public/research/app.js','utf8');
const shell=readFileSync('public/research/app-shell.js','utf8');

describe('static research shell state',()=>{
  it('labels the bundled backup so offline or R2-outage data is never presented as current',()=>{
    expect(app).toContain("data._researchSource==='backup'?' · Backup copy'");
    expect(app).toContain('may not include the latest week');
  });
  it('never reads the private library on public research views before user action',()=>{
    expect(shell).toContain("if(mode==='unknown'&&item.type==='player'){");
  });
  it('discards in-memory account bookmarks after a back/forward cache restore',()=>{
    expect(shell).toMatch(/addEventListener\('pageshow',function\(event\)\{\s*if\(!event\.persisted\)return;\s*mode='unknown';items=\[\]/);
  });
});
