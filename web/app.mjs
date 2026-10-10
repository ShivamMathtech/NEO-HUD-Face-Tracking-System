import {FaceTracker} from './tracker.mjs';
const $=id=>document.getElementById(id), video=$('video'), display=$('display'), ctx=display.getContext('2d');
const tracker=new FaceTracker();
const state={ready:false,busy:false,generation:0,source:null,stream:null,url:null,faces:[],target:null,acquire:true,ms:0,latency:0,fps:0,lastSent:0,lastVideo:-1,sentAt:0,results:[],rows:[],recording:null,recordChunks:[],lastRow:0,ended:false};
let worker,noticeTimer,sourceRequest=0,starting=false;
const val=id=>Number($(id).value), pad=n=>String(n).padStart(2,'0');
function notice(message,error=false){clearTimeout(noticeTimer);$('notice').textContent=message;$('notice').hidden=false;$('notice').classList.toggle('error',error);noticeTimer=setTimeout(()=>$('notice').hidden=true,error?12000:5000);}
function setText(id,text){if($(id).textContent!==String(text))$(id).textContent=text;}
function initWorker(){
  state.ready=false;state.busy=false;setText('modelStatus','Loading…');
  worker=new Worker('./detector.worker.js');
  const startup=setTimeout(()=>{if(!state.ready){worker.terminate();setText('modelStatus','Error');notice('Model initialization timed out. Reload the page in Chrome or Edge and check that the ZIP was fully extracted.',true);}},30000);
  worker.onmessage=({data})=>{
    if(data.type==='ready'){clearTimeout(startup);state.ready=true;setText('modelStatus','Loaded');setText('modelHint','Local model loaded • CPU inference • No uploads');return;}
    state.busy=false;
    if(data.type==='error'){clearTimeout(startup);state.ready=false;setText('modelStatus','Error');setText('modelHint','Model error — check the message below');notice('Face detection: '+data.message+'. Reload to retry.',true);return;}
    if(data.type!=='result'||data.generation!==state.generation)return;
    state.ms=data.ms;state.latency=performance.now()-state.sentAt;
    const now=performance.now();state.results.push(now);state.results=state.results.filter(t=>now-t<1500);
    state.fps=state.results.length>1?(state.results.length-1)*1000/(now-state.results[0]):0;
    state.faces=tracker.update(data.faces.filter(d=>d.score>=val('confidence')),now,val('smoothing'));
    if(state.target!==null&&!tracker.tracks.some(t=>t.id===state.target))state.target=null;
    if(state.acquire&&!$('manual').checked&&state.target===null&&state.faces.length){state.target=state.faces.reduce((a,b)=>a.box.w*a.box.h>b.box.w*b.box.h?a:b).id;}
    const target=targetFace();
    if(target&&now-state.lastRow>100){
      state.lastRow=now;const b=target.box;
      state.rows.push([new Date().toISOString(),state.source==='file'?video.currentTime.toFixed(3):'',target.id,target.score.toFixed(4),Math.round((b.x+b.w/2)*video.videoWidth),Math.round((b.y+b.h/2)*video.videoHeight),Math.round(b.w*video.videoWidth),Math.round(b.h*video.videoHeight),data.ms.toFixed(2)]);
      if(state.rows.length>18000)state.rows.shift();
    }
    updateTelemetry();
  };
  worker.onerror=event=>{clearTimeout(startup);state.ready=false;state.busy=false;setText('modelStatus','Error');notice('Detection worker could not start. Use the included launcher, not file://. '+event.message,true);};
  worker.postMessage({type:'init'});
}
function targetFace(){return state.faces.find(t=>t.id===state.target);}
function resetTracking(){tracker.reset();state.faces=[];state.target=null;state.results=[];state.fps=0;state.ms=0;state.latency=0;state.lastVideo=-1;state.lastRow=0;}
function stopSource(){
  sourceRequest++;stopRecording();state.generation++;video.pause();
  if(state.stream)state.stream.getTracks().forEach(t=>t.stop());
  state.stream=null;video.srcObject=null;video.removeAttribute('src');video.load();
  if(state.url)URL.revokeObjectURL(state.url);state.url=null;state.source=null;state.ended=false;resetTracking();
  $('emptyState').hidden=false;$('videoControls').hidden=true;setText('cameraStatus','Disconnected');$('cameraBtn').querySelector('span:last-child').textContent='Start Camera';setText('dimensions','NO SOURCE');updateTelemetry();
}
async function listCameras(){
  if(!navigator.mediaDevices?.enumerateDevices)return;
  const current=$('cameraSelect').value;
  const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
  if(!devices.length)return;
  $('cameraSelect').replaceChildren(...devices.map((d,i)=>{const o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||`Webcam (${i})`;return o;}));
  if([...$('cameraSelect').options].some(o=>o.value===current))$('cameraSelect').value=current;
}
function sourceStarted(kind){
  state.source=kind;state.acquire=true;state.ended=false;state.rows=[];resetTracking();
  $('emptyState').hidden=true;$('videoControls').hidden=kind!=='file';
  setText('dimensions',`${video.videoWidth} × ${video.videoHeight}`);setText('cameraStatus',kind==='camera'?'Connected':'Video File');
  $('cameraBtn').querySelector('span:last-child').textContent=kind==='camera'?'Stop Camera':'Start Camera';
  updateTelemetry();
}
async function startCamera(){
  if(starting)return;
  if(state.source==='camera'){stopSource();return;}
  if(!navigator.mediaDevices?.getUserMedia){notice('Camera access requires localhost or HTTPS. Start the app with START_WINDOWS.bat.',true);return;}
  starting=true;$('cameraBtn').disabled=true;stopSource();const request=sourceRequest;
  try{
    const device=$('cameraSelect').value;
    const stream=await navigator.mediaDevices.getUserMedia({video:{...(device?{deviceId:{exact:device}}:{}),width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:60}},audio:false});
    if(request!==sourceRequest){stream.getTracks().forEach(t=>t.stop());return;}
    state.stream=stream;video.srcObject=stream;await video.play();
    if(request!==sourceRequest)return;
    sourceStarted('camera');await listCameras();
    stream.getVideoTracks()[0].addEventListener('ended',()=>{if(state.stream===stream){stopSource();notice('Camera disconnected. Reconnect it and start the camera again.',true);}});
  }catch(error){if(request===sourceRequest){stopSource();const reasons={NotAllowedError:'Camera permission was denied. Allow Camera for localhost in the browser address bar.',NotFoundError:'No camera found. Connect a webcam or open a video file.',NotReadableError:'Camera is busy. Close other camera apps and try again.',OverconstrainedError:'The selected camera is unavailable. Choose another camera.'};notice(reasons[error.name]||error.message,true);}}
  finally{starting=false;$('cameraBtn').disabled=false;}
}
async function openFile(file){
  if(!file)return;stopSource();const request=sourceRequest;
  state.url=URL.createObjectURL(file);video.src=state.url;video.loop=$('loop').checked;video.playbackRate=val('speed');
  try{await video.play();if(request!==sourceRequest)return;sourceStarted('file');notice('Video loaded. Playback and detection are local to this browser.');}
  catch(error){if(request===sourceRequest){stopSource();notice('Cannot play this video. Use an H.264 MP4 or VP8/VP9 WebM file supported by your browser.',true);}}
}
function updateTelemetry(){
  const target=targetFace(), paused=state.source==='file'&&video.paused;
  const label=!state.source?'STANDBY':state.ended?'ENDED':paused?'PAUSED':!state.ready?'MODEL ERROR':target?'LOCKED':state.target!==null?'LOST':!state.acquire?'RELEASED':$('manual').checked?'SELECT FACE':'SEARCHING';
  setText('trackingState','● '+label);$('trackingState').style.color=target?'var(--green)':'var(--muted)';
  const fps=state.source&&!paused&&state.ready?state.fps.toFixed(1):'—',ms=state.source&&state.ms?state.ms.toFixed(0)+' ms':'—';
  setText('viewFps',fps);setText('infoFps',fps);setText('footerFps',fps+' FPS');setText('processingTime',ms);setText('footerMs',ms);setText('viewLatency',state.source&&state.latency?state.latency.toFixed(0)+' ms':'—');
  if(target){const b=target.box,x=Math.round((b.x+b.w/2)*video.videoWidth),y=Math.round((b.y+b.h/2)*video.videoHeight);
    setText('targetId',pad(target.id));setText('targetConfidence',target.score.toFixed(2));setText('facePosition',`(${x}, ${y})`);setText('centerOffset',`(${Math.round(x-video.videoWidth/2)}, ${Math.round(y-video.videoHeight/2)})`);
    const dx=target.dx*video.videoWidth,dy=target.dy*video.videoHeight;setText('direction',Math.hypot(dx,dy)<2?'➜ Stable':Math.abs(dx)>Math.abs(dy)?dx>0?'→ Right':'← Left':dy>0?'↓ Down':'↑ Up');
  }else{for(const id of ['targetId','targetConfidence','facePosition','centerOffset','direction'])setText(id,'—');}
}
function canvasSize(canvas){
  const {width,height}=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,1.5),w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const c=canvas.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);return {c,w:width,h:height};
}
function mapping(w,h){
  const vw=video.videoWidth||1280,vh=video.videoHeight||720,s=($('fill').checked?Math.max:Math.min)(w/vw,h/vh);
  return {x:(w-vw*s)/2,y:(h-vh*s)/2,w:vw*s,h:vh*s,mirror:state.source==='camera'&&$('mirror').checked};
}
function screenBox(b,m){return {x:m.x+(m.mirror?1-b.x-b.w:b.x)*m.w,y:m.y+b.y*m.h,w:b.w*m.w,h:b.h*m.h};}
function paintBox(c,t,m,selected){
  const b=screenBox(t.box,m),color=selected?'#00ffaa':'#00bfe9',corner=Math.max(10,Math.min(40,b.w*.16));
  c.save();c.strokeStyle=color;c.fillStyle=color;c.lineWidth=1;c.globalAlpha=selected?1:.7;c.strokeRect(b.x,b.y,b.w,b.h);
  c.lineWidth=selected?5:2;if(selected){c.shadowColor=color;c.shadowBlur=12;}
  c.beginPath();for(const [x,y,sx,sy] of [[b.x,b.y,1,1],[b.x+b.w,b.y,-1,1],[b.x,b.y+b.h,1,-1],[b.x+b.w,b.y+b.h,-1,-1]]){c.moveTo(x+sx*corner,y);c.lineTo(x,y);c.lineTo(x,y+sy*corner);}c.stroke();c.shadowBlur=0;
  const cx=b.x+b.w/2,cy=b.y+b.h/2;c.lineWidth=2;c.beginPath();c.moveTo(cx-17,cy);c.lineTo(cx+17,cy);c.moveTo(cx,cy-17);c.lineTo(cx,cy+17);c.stroke();
  const text=`ID: ${pad(t.id)}   ${t.score.toFixed(2)}`;c.font='600 18px Segoe UI, sans-serif';const tw=c.measureText(text).width+24,lx=Math.min(Math.max(4,cx-tw/2),Math.max(4,display.clientWidth-tw-4)),ly=Math.max(78,b.y-50);
  c.fillStyle='#00201ed9';c.fillRect(lx,ly,tw,36);c.lineWidth=1;c.strokeRect(lx,ly,tw,36);c.fillStyle=color;c.fillText(text,lx+12,ly+25);
  if($('showTrail').checked&&selected&&t.history.length>1){c.lineWidth=1.5;c.beginPath();t.history.forEach((p,i)=>{const x=m.x+(m.mirror?1-p.x:p.x)*m.w,y=m.y+p.y*m.h;i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();}
  c.restore();
}
function paintRuler(c,w,h){
  const y=h-90,left=w*.2,right=w*.8,cx=w/2,step=(right-left)/8;
  c.save();c.strokeStyle='#00efaa';c.fillStyle='#a4e5f8';c.lineWidth=1;c.beginPath();c.moveTo(left-20,y);c.lineTo(right+20,y);
  for(let i=-4;i<=4;i++){const x=cx+i*step;c.moveTo(x,y-18);c.lineTo(x,y+18);if(i>-4&&i<4){c.font='14px Segoe UI';c.textAlign='center';c.fillText(i>0?'+'+(i*10):String(i*10),x,y+34);}if(i<4)for(let j=1;j<4;j++){c.moveTo(x+j*step/4,y-6);c.lineTo(x+j*step/4,y+5);}}
  c.stroke();const target=targetFace(),offset=target?(target.box.x+target.box.w/2-.5)*(state.source==='camera'&&$('mirror').checked?-1:1):0,px=cx+Math.max(-.4,Math.min(.4,offset))*step*10;c.fillStyle='#00efaa';c.beginPath();c.moveTo(px,y-31);c.lineTo(px-8,y-16);c.lineTo(px+8,y-16);c.closePath();c.fill();c.restore();
}
function paintRadar(){
  const {c,w,h}=canvasSize($('radar')),cx=w/2,cy=h/2,r=Math.max(5,Math.min(w,h)/2-9);c.clearRect(0,0,w,h);c.strokeStyle='#086248';c.lineWidth=.7;
  for(let i=1;i<=3;i++){c.beginPath();c.arc(cx,cy,r*i/3,0,Math.PI*2);c.stroke();}c.strokeStyle='#08768d';c.beginPath();c.arc(cx,cy,r+6,0,Math.PI*2);c.stroke();c.strokeStyle='#00dda4';c.beginPath();c.moveTo(cx-r-6,cy);c.lineTo(cx+r+6,cy);c.moveTo(cx,cy-r-6);c.lineTo(cx,cy+r+6);c.stroke();
  c.fillStyle='#00efaa';c.shadowColor='#00efaa';c.shadowBlur=12;c.beginPath();c.moveTo(cx,cy-10);c.lineTo(cx+7,cy);c.lineTo(cx,cy+10);c.lineTo(cx-7,cy);c.closePath();c.fill();c.shadowBlur=0;
  for(const t of state.faces){const b=t.box,x=(b.x+b.w/2-.5)*1.7*r,y=(b.y+b.h/2-.5)*1.7*r;c.fillStyle=t.id===state.target?'#ff393e':'#00bfe9';c.beginPath();c.arc(cx+x,cy+y,5,0,Math.PI*2);c.fill();}
}
function paintTrail(){
  const {c,w,h}=canvasSize($('trail'));c.clearRect(0,0,w,h);const pad=17,iw=w-pad*2,ih=h-22;c.strokeStyle='#082d3a';c.lineWidth=.6;
  for(let i=0;i<=8;i++){const x=pad+iw*i/8;c.beginPath();c.moveTo(x,9);c.lineTo(x,9+ih);c.stroke();}
  for(let i=0;i<=4;i++){const y=9+ih*i/4;c.beginPath();c.moveTo(pad,y);c.lineTo(w-pad,y);c.stroke();}
  const target=targetFace();if(!target)return;c.strokeStyle='#00efa6';c.fillStyle='#00efa6';c.lineWidth=1.7;c.beginPath();target.history.forEach((p,i)=>{const x=pad+p.x*iw,y=9+p.y*ih;i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();
  target.history.forEach((p,i)=>{if(i%8!==0&&i!==target.history.length-1)return;c.beginPath();c.arc(pad+p.x*iw,9+p.y*ih,3,0,Math.PI*2);c.fill();});
}
async function sendFrame(now){
  if(!state.ready||state.busy||!state.source||video.paused||video.seeking||video.readyState<2||document.hidden||now-state.lastSent<1000/val('maxFps')||video.currentTime===state.lastVideo)return;
  state.busy=true;state.lastSent=now;state.sentAt=performance.now();state.lastVideo=video.currentTime;const generation=state.generation;
  const width=Math.min(val('resolution'),video.videoWidth),height=Math.max(1,Math.round(width*video.videoHeight/video.videoWidth));
  try{
    const bitmap=await createImageBitmap(video,{resizeWidth:width,resizeHeight:height,resizeQuality:'low'});
    if(generation!==state.generation){bitmap.close();state.busy=false;return;}
    worker.postMessage({type:'frame',bitmap,width,height,timestamp:performance.now(),generation},[bitmap]);
  }catch(error){state.busy=false;notice('Cannot read this video frame: '+error.message,true);}
}
let lastPanels=0;
function render(now){
  const {w,h}=canvasSize(display);ctx.fillStyle='#061019';ctx.fillRect(0,0,w,h);
  if(state.source&&video.readyState>=2){const m=mapping(w,h);ctx.save();if(m.mirror){ctx.translate(w,0);ctx.scale(-1,1);}ctx.drawImage(video,m.x,m.y,m.w,m.h);ctx.restore();
    const visible=$('mode').value==='multi'||$('manual').checked||!targetFace()?state.faces:state.faces.filter(t=>t.id===state.target);
    visible.forEach(t=>paintBox(ctx,t,m,t.id===state.target));paintRuler(ctx,w,h);
  }else{ctx.strokeStyle='#06303b';ctx.lineWidth=.5;for(let x=0;x<w;x+=45){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=45){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}paintRuler(ctx,w,h);}
  sendFrame(now);
  if(state.busy&&now-state.sentAt>15000){state.busy=false;state.ready=false;worker.terminate();setText('modelStatus','Error');notice('Inference timed out. Reload the page to restart the detector.',true);}
  if(now-lastPanels>90){lastPanels=now;paintRadar();paintTrail();if(state.source==='file')updatePlayback();}
  requestAnimationFrame(render);
}
function updatePlayback(){
  const fmt=s=>`${Math.floor((s||0)/60)}:${pad(Math.floor((s||0)%60))}`;
  $('seek').value=Number.isFinite(video.duration)&&video.duration?String(video.currentTime/video.duration*1000):'0';
  paintRange('seek');
  setText('videoTime',fmt(video.currentTime)+' / '+fmt(Number.isFinite(video.duration)?video.duration:0));setText('playPause',video.paused?'▶':'Ⅱ');$('playPause').setAttribute('aria-label',video.paused?'Play video':'Pause video');
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
const filename=()=>new Date().toISOString().replace(/[:.]/g,'-');
function stopRecording(){if(state.recording&&state.recording.state!=='inactive')state.recording.stop();}
function toggleRecording(){
  if(state.recording){stopRecording();return;}
  if(!state.source||video.readyState<2){notice('Start a camera or video before recording.');return;}
  if(!window.MediaRecorder||!display.captureStream){notice('This browser does not support recording. Use desktop Chrome or Edge.',true);return;}
  const type=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  if(!type){notice('WebM recording is unavailable in this browser.',true);return;}
  const stream=display.captureStream(30);let bytes=0;state.recordChunks=[];
  try{
    const rec=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:4500000});state.recording=rec;
    rec.ondataavailable=e=>{if(e.data.size){state.recordChunks.push(e.data);bytes+=e.data.size;if(bytes>256*1024*1024){stopRecording();notice('Recording saved at the 256 MB memory limit. Start a new segment to continue.');}}};
    rec.onstop=()=>{download(new Blob(state.recordChunks,{type}),'neo-hud-'+filename()+'.webm');state.recordChunks=[];state.recording=null;stream.getTracks().forEach(t=>t.stop());setText('recordStatus','OFF');$('recordBtn').querySelector('span').textContent='RECORD';$('recordDot').classList.remove('recording');$('recordBtn').classList.remove('active');notice('Recording saved to your browser downloads.');};
    rec.onerror=()=>{notice('Recording failed. Try a lower processing resolution.',true);stopRecording();};
    rec.start(1000);setText('recordStatus','ON');$('recordBtn').querySelector('span').textContent='STOP REC';$('recordDot').classList.add('recording');$('recordBtn').classList.add('active');
  }catch(error){stream.getTracks().forEach(t=>t.stop());state.recording=null;notice('Recording error: '+error.message,true);}
}
$('cameraBtn').onclick=startCamera;
$('stopBtn').onclick=()=>{stopSource();notice('Source stopped and camera released.');};
$('openBtn').onclick=()=>$('fileInput').click();
$('fileInput').onchange=event=>{openFile(event.target.files[0]);event.target.value='';};
$('cameraSelect').onchange=()=>{if(state.source==='camera'){stopSource();startCamera();}};
$('acquireBtn').onclick=()=>{state.acquire=true;state.target=null;updateTelemetry();notice(!state.source?'Start a camera or open a video first.':$('manual').checked?'Click a detected face to select it.':'Acquiring the largest visible face…');};
$('trackTab').onclick=()=>$('acquireBtn').click();
$('releaseBtn').onclick=()=>{state.target=null;state.acquire=false;updateTelemetry();};
$('manual').onchange=()=>{state.target=null;state.acquire=true;updateTelemetry();if($('manual').checked)notice('Click inside a cyan face box to lock onto it.');};
$('mode').onchange=()=>{state.target=null;state.acquire=true;};
display.onclick=e=>{if(!$('manual').checked)return;const rect=display.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,m=mapping(rect.width,rect.height);
  const face=state.faces.filter(t=>{const b=screenBox(t.box,m);return x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;}).sort((a,b)=>a.box.w*a.box.h-b.box.w*b.box.h)[0];
  if(face){state.target=face.id;state.acquire=true;updateTelemetry();}else notice('Click inside a detected face box.');
};
for(const id of ['smoothing','confidence','maxFps']){$(id).oninput=()=>{setText(id+'Value',String(val(id)));paintRange(id);savePreferences();};}
function paintRange(id){const el=$(id);el.style.setProperty('--range-fill',((Number(el.value)-Number(el.min))/(Number(el.max)-Number(el.min))*100)+'%');}
function savePreferences(){try{localStorage.setItem('neo-hud-prefs',JSON.stringify(Object.fromEntries(['smoothing','confidence','resolution','maxFps','mirror','showTrail','fill'].map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value]))));}catch{}}
try{const prefs=JSON.parse(localStorage.getItem('neo-hud-prefs')||'{}');for(const id of ['smoothing','confidence','resolution','maxFps','mirror','showTrail','fill']){if(prefs[id]!==undefined){if($(id).type==='checkbox')$(id).checked=Boolean(prefs[id]);else $(id).value=prefs[id];}}}catch{}
for(const id of ['smoothing','confidence','maxFps']){setText(id+'Value',String(val(id)));paintRange(id);}
for(const id of ['resolution','mirror','showTrail','fill'])$(id).onchange=savePreferences;
$('recordBtn').onclick=toggleRecording;
$('settingsBtn').onclick=()=>$('settingsDialog').showModal();
$('snapshotBtn').onclick=()=>{if(!state.source){notice('Start a source before saving a snapshot.');$('settingsDialog').close();return;}display.toBlob(blob=>{if(blob)download(blob,'neo-hud-'+filename()+'.png');},'image/png');};
$('exportBtn').onclick=()=>{if(!state.rows.length){$('settingsDialog').close();notice('Track a face first to collect tracking data.');return;}const header=['timestamp_utc','video_seconds','track_id','confidence','center_x_px','center_y_px','width_px','height_px','inference_ms'];download(new Blob([[header,...state.rows].map(row=>row.join(',')).join('\n')],{type:'text/csv'}),'neo-hud-tracks-'+filename()+'.csv');};
$('compactBtn').onclick=()=>document.body.classList.toggle('compact');
$('fullscreenBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notice('Fullscreen is unavailable in this browser.');}};
$('playPause').onclick=async()=>{if(video.paused){state.ended=false;try{await video.play();}catch(e){notice(e.message,true);}}else video.pause();updateTelemetry();};
$('seek').oninput=()=>{if(Number.isFinite(video.duration))video.currentTime=val('seek')/1000*video.duration;};
$('speed').onchange=()=>video.playbackRate=val('speed');$('loop').onchange=()=>video.loop=$('loop').checked;
video.addEventListener('seeking',()=>{state.generation++;resetTracking();updateTelemetry();});
video.addEventListener('ended',()=>{state.ended=true;stopRecording();updateTelemetry();notice('Video ended. Press Play to replay or open another file.');});
video.addEventListener('pause',updateTelemetry);video.addEventListener('play',()=>{state.ended=false;updateTelemetry();});
video.addEventListener('error',()=>{if(state.source){stopSource();notice('Video decoding failed. Try an H.264 MP4 or VP8/VP9 WebM file.',true);}});
document.addEventListener('visibilitychange',()=>{state.results=[];state.lastVideo=-1;});
window.addEventListener('beforeunload',()=>{state.stream?.getTracks().forEach(t=>t.stop());worker?.terminate();});
navigator.mediaDevices?.addEventListener('devicechange',()=>listCameras().catch(()=>{}));
initWorker();listCameras().catch(()=>{});updateTelemetry();requestAnimationFrame(render);
