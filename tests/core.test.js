import test from 'node:test';
import assert from 'node:assert/strict';
import {History,getCorrections} from '../src/history.js';
import {summarize} from '../src/storage.js';
test('undo/redo preserves positions and count correction, divergent edits discard redo',()=>{
 const h=new History();const initial={objects:[{id:'a',source:'auto'}],offset:0};h.reset(initial);
 const next={objects:[{id:'b',source:'manual'}],offset:2};h.commit(next);next.offset=10;
 assert.equal(h.current.offset,2);h.undo();assert.equal(h.current.objects[0].id,'a');h.redo();assert.equal(h.current.objects[0].id,'b');
 h.undo();h.commit({...h.current,offset:-1});h.redo();assert.equal(h.current.offset,-1);assert.equal(h.states.length,2);
});
test('FP/FN come from object edits; count-only correction invalidates object truth',()=>{
 const auto=[{id:'a',source:'auto'},{id:'b',source:'auto'}];const c=getCorrections(auto,{objects:[auto[0],{id:'c',source:'manual'}],offset:1});
 assert.equal(c.falsePositives[0].id,'b');assert.equal(c.falseNegatives[0].id,'c');assert.equal(c.objectGroundTruthComplete,false);
 assert.equal(getCorrections(auto,{objects:auto,offset:0}).falsePositives.length,0);
});
test('exact count uses only confirmed analyzed real samples, no empty-set accuracy',()=>{
 assert.equal(summarize([]).exactCountAccuracy,null);
 const samples=[{verifiedByUser:true,automaticCount:12,groundTruthCount:12},{verifiedByUser:true,automaticCount:11,groundTruthCount:12},{verifiedByUser:true,automaticCount:12,groundTruthCount:12,isPractice:true},{verifiedByUser:true,automaticCount:null,groundTruthCount:12}];
 const s=summarize(samples);assert.equal(s.samples,2);assert.equal(s.exactCountAccuracy,.5);assert.equal(s.practice,1);
});
