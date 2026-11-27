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
        import {slots,experiment,matrixHash} from './scripts/research/manifest.mjs';
        import {ResearchLedger,campaign} from './scripts/research/ledger.mjs';
        const compiled=slots.map(s=>experiment(s.ExperimentID,'test',1,8,s.ConfigID.startsWith('Finalist ')?'S03':undefined));
        assert.equal(compiled.length,122);
        assert.equal(compiled.reduce((sum,x)=>sum+x.definition.episodeBudget,0),1512448);
        assert.throws(()=>compiled[0].definition.draft.hidden.push(100));
        assert.throws(()=>experiment('C02-101','test',1,8));
        const total={ms:100,ticks:1000,episodes:100},training={ms:85,ticks:850,episodes:100};
        const spec=campaign('test',matrixHash,'a'.repeat(40),[{id:'local',total,training}]);
        assert.throws(()=>campaign('test',matrixHash,'a'.repeat(40),[{id:'local',total:{...total,ticks:6e9},training}]));
        const db=new ResearchLedger(process.argv[1],spec,'local'),other=new ResearchLedger(process.argv[1],spec,'local');
        db.claim(); assert.throws(()=>other.claim());
        db.manifest('B',compiled[0]); assert.throws(()=>db.manifest('B',compiled[1]));
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
