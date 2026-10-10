/** Short-lived spatial IDs, not biometric recognition. Normalized coordinates. */
export function iou(a, b) {
  const w=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
  const h=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  return Math.min(1,w*h / Math.max(1e-8,a.w*a.h+b.w*b.h-w*h));
}
export class FaceTracker {
  constructor(){this.reset();}
  reset(){this.tracks=[];this.nextId=1;}
  update(detections, now, smoothing=0.7){
    this.tracks=this.tracks.filter(t=>now-t.seen<750);
    const pairs=[];
    this.tracks.forEach(t=>detections.forEach((d,j)=>{
      const overlap=iou(t.raw,d), distance=Math.hypot(t.raw.x+t.raw.w/2-d.x-d.w/2,t.raw.y+t.raw.h/2-d.y-d.h/2);
      const ratio=Math.max(t.raw.w,d.w)/Math.max(.001,Math.min(t.raw.w,d.w));
      if(overlap>.08 || (distance<Math.max(.06,t.raw.w*.7) && ratio<1.8)) pairs.push({t,j,cost:1-overlap+distance});
    }));
    pairs.sort((a,b)=>a.cost-b.cost);
    const matched=new Set(), used=new Set();
    const apply=(t,d)=>{
      const prev=t.box, alpha=Math.max(.1,1-smoothing*.85);
      t.box=Object.fromEntries(['x','y','w','h'].map(k=>[k,prev[k]+alpha*(d[k]-prev[k])]));
      t.dx=(t.box.x+t.box.w/2)-(prev.x+prev.w/2); t.dy=(t.box.y+t.box.h/2)-(prev.y+prev.h/2);
      t.raw=d;t.score=d.score;t.seen=now;t.visible=true;
      t.history.push({x:t.box.x+t.box.w/2,y:t.box.y+t.box.h/2});if(t.history.length>90)t.history.shift();
    };
    this.tracks.forEach(t=>t.visible=false);
    for(const p of pairs){if(matched.has(p.t.id)||used.has(p.j))continue;apply(p.t,detections[p.j]);matched.add(p.t.id);used.add(p.j);}
    detections.forEach((d,j)=>{if(!used.has(j)){const t={id:this.nextId++,box:{...d},raw:d,score:d.score,seen:now,visible:true,dx:0,dy:0,history:[]};apply(t,d);this.tracks.push(t);}});
    return this.tracks.filter(t=>t.visible);
  }
}
