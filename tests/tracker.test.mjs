import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FaceTracker,iou} from '../web/tracker.mjs';
const face=(x,score=.9)=>({x,y:.2,w:.2,h:.25,score});
test('overlap: same box, separated boxes',()=>{assert.equal(iou(face(.1),face(.1)),1);assert.equal(iou(face(.1),face(.7)),0);});
test('moving face keeps its ID; smoothing reduces jitter',()=>{const t=new FaceTracker();t.update([face(.1)],0);const [f]=t.update([face(.12)],33,.7);assert.equal(f.id,1);assert.ok(f.box.x>.1&&f.box.x<.12);});
test('two detections cannot share one ID',()=>{const t=new FaceTracker();t.update([face(.1),face(.6)],0);const tracks=t.update([face(.61),face(.11)],33);assert.equal(tracks.length,2);assert.equal(new Set(tracks.map(f=>f.id)).size,2);assert.equal(tracks.find(f=>f.id===1).raw.x,.11);});
test('brief miss preserves identity but does not draw a stale face',()=>{const t=new FaceTracker();t.update([face(.1)],0);assert.equal(t.update([],100).length,0);assert.equal(t.update([face(.1)],200)[0].id,1);});
test('expired track gets a new ID and reset starts a new session',()=>{const t=new FaceTracker();t.update([face(.1)],0);assert.equal(t.update([face(.1)],900)[0].id,2);t.reset();assert.equal(t.update([face(.1)],1000)[0].id,1);});
