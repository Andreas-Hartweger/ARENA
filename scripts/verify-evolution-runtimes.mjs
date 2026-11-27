import { digest, environment } from './evolution-runtime.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
const { runtimeProbe } = await import('../tests/training/runtimeProbe.ts');
const directory = '.npm-cache/evolution-runtime';
mkdirSync(directory, { recursive: true });
const headers = {},
  expected = runtimeProbe((header) => {
    const hash = digest(header);
    headers[header] = hash;
    return hash;
  });
writeFileSync(
  join(directory, 'expected.json'),
  JSON.stringify({ headers, expected, environment: environment() }),
);
writeFileSync(
  join(directory, 'compare.html'),
  `<!doctype html><meta charset="utf-8"><title>ARENA runtime comparison</title><pre>Prüfung läuft</pre><script type="module">
import {runtimeProbe} from '/tests/training/runtimeProbe.ts';
const output=document.querySelector('pre');
try {
 const {expected,headers,environment}=await (await fetch('./expected.json')).json();
 const actual=runtimeProbe(header=>{if(!Object.hasOwn(headers,header))throw Error('Unknown contract');return headers[header];});
 const results={};let passed=true;
 for(const key of Object.keys(expected)){
  if(Array.isArray(expected[key])){
   const a=expected[key],b=actual[key],abs=a.length===b.length?Math.max(...a.map((v,i)=>Math.abs(v-b[i]))):Infinity;
   const tolerance=key==='uniform'?0:1e-9;
   results[key]={length:b.length,maxAbs:abs,tolerance};if(!(abs<=tolerance))passed=false;
  }else {results[key]={node:expected[key],browser:actual[key]};if(expected[key]!==actual[key])passed=false;}
 }
 output.textContent=JSON.stringify({passed,results,sha:environment.sha,node:environment.node,browser:navigator.userAgent},null,2);
} catch(error){output.textContent=String(error);}</script>`,
);
process.stdout.write(
  'Open /.npm-cache/evolution-runtime/compare.html on the local Vite development server.\n',
);
