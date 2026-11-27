import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('D14 research contracts', () => {
  it('binds the package matrix to immutable definitions and enforces quota and lease boundaries across two connections', () => {
    const directory = mkdtempSync(join(tmpdir(), 'arena-ledger-'));
    try {
      const result = execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `
        import assert from 'node:assert/strict';
        import {slots,experiment,interaction,matrixHash} from './scripts/research/manifest.mjs';
        import {ResearchLedger,campaign} from './scripts/research/ledger.mjs';
        import {digest} from './scripts/evolution-runtime.mjs';
        const {preflight}=await import('./src/runtime/runConfig.ts');
        const {Genome}=await import('./src/training/genome.ts');
        const compiled=slots.map(s=>experiment(s.ExperimentID,'test',1,8,s.ConfigID.startsWith('Finalist ')?'S03':undefined));
        assert.equal(compiled.length,122);
        assert.equal(compiled.reduce((sum,x)=>sum+x.definition.episodeBudget,0),1512448);
        for(const [config,count] of Object.entries({'B-evolution':8547,S33:4147,S34:9123,S35:18115,S36:81795,S37:8571,S38:8331,S39:8403})){
          const def=compiled.find(e=>e.definition.experimentId===config+'-42').definition;
          const {m}=preflight(def.draft,digest,8), genome=Genome.initialize(m,42,digest);
          assert.equal(m.count,count);assert.equal(genome.parameters().byteLength,count*8);
          assert.equal(genome.hash,Genome.initialize(m,42,digest).hash);
        }
        assert.throws(()=>compiled[0].definition.draft.hidden.push(100));
        assert.throws(()=>experiment('C02-101','test',1,8));
        const proposal={variants:['S01','S15'],hypothesis:'Small population with sparse mutation',seed:42,episodeBudget:8192};
        const combo=interaction('test',proposal,1,8);
        assert.equal(combo.definition.draft.options.n,32);
        assert.equal(combo.definition.draft.options.mutation.p,0.02);
        assert.equal(combo.hash,interaction('test',{...proposal,variants:['S15','S01']},1,8).hash);
        assert.throws(()=>interaction('test',{...proposal,variants:['S01','S02']},1,8));
        assert.throws(()=>interaction('test',{...proposal,variants:['S01','S99']},1,8));
        assert.throws(()=>interaction('test',{...proposal,episodeBudget:1e9},1,8));
        const total={ms:100,ticks:1000,episodes:100},training={ms:85,ticks:850,episodes:100};
        const spec=campaign('test',matrixHash,'a'.repeat(40),[{id:'local',total,training}]);
        const machines=[{id:'west',total,training,experiments:['S01-42']},{id:'east',total,training,experiments:['S01-43']}];
        const split=campaign('test',matrixHash,'a'.repeat(40),machines);
        assert.throws(()=>campaign('test',matrixHash,'a'.repeat(40),[machines[0],{...machines[1],experiments:['S01-42']}]));
        assert.throws(()=>campaign('test',matrixHash,'a'.repeat(40),machines.map(m=>({...m,total:{...total,ticks:3e9}}))));
        for(const [i,m] of machines.entries()){
          const local=new ResearchLedger(process.argv[1]+i,split,m.id);
          local.claim();local.reserve('job','research',{},training);
          assert.throws(()=>local.reserve('more','research',{},{ms:1,ticks:0,episodes:0}));
          local.settle('job',training);local.release();local.close();
        }
        assert.throws(()=>campaign('test',matrixHash,'a'.repeat(40),[{id:'local',total:{...total,ticks:6e9},training}]));
        const db=new ResearchLedger(process.argv[1],spec,'local'),other=new ResearchLedger(process.argv[1],spec,'local');
        db.claim(); assert.throws(()=>other.claim());
        db.manifest('B',compiled[0]); assert.deepEqual(db.readManifest('B'),compiled[0]); assert.throws(()=>db.manifest('B',compiled[1]));
        db.reserve('g','research',{generation:0},{ms:0,ticks:840,episodes:32});
        assert.throws(()=>db.reserve('overflow','research',{},{ms:0,ticks:11,episodes:0}));
        other.claim({recover:true}); assert.throws(()=>db.settle('g',{ms:0,ticks:1,episodes:1}));
        assert.deepEqual({...other.usage().charged},{ms:0,ticks:840,episodes:0});
        assert.throws(()=>other.reserve('g','research',{},{ms:1,ticks:1,episodes:0}));
        other.reserve('v','validation',{},{ms:1,ticks:160,episodes:0});
        assert.throws(()=>other.settle('v',{ms:1,ticks:161,episodes:0}));
        other.settle('v',{ms:1,ticks:159,episodes:0});
        other.release(); db.close(); other.close();
        console.log('passed');
      `,
          join(directory, 'state.sqlite'),
        ],
        { encoding: 'utf8' },
      );
      expect(result.trim()).toBe('passed');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
