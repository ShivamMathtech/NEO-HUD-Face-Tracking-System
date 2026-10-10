/* CommonJS exports shim for the unmodified MediaPipe vendor distribution. */
var exports = {};
importScripts('./vendor/vision_bundle.cjs');
let detector;
self.onmessage = async ({data}) => {
  try {
    if(data.type==='init'){
      const files=await exports.FilesetResolver.forVisionTasks('./vendor/wasm');
      detector=await exports.FaceDetector.createFromOptions(files,{
        baseOptions:{modelAssetPath:'./models/blaze_face_short_range.tflite',delegate:'CPU'},
        runningMode:'VIDEO',minDetectionConfidence:0.1,minSuppressionThreshold:0.3
      });
      self.postMessage({type:'ready'});
    } else if(data.type==='frame'){
      const start=performance.now();
      try{
        const result=detector.detectForVideo(data.bitmap,data.timestamp);
        const faces=result.detections.map(d=>({
          x:d.boundingBox.originX/data.width,y:d.boundingBox.originY/data.height,
          w:d.boundingBox.width/data.width,h:d.boundingBox.height/data.height,
          score:d.categories[0].score
        }));
        self.postMessage({type:'result',faces,ms:performance.now()-start,generation:data.generation});
      } finally {data.bitmap.close();}
    }
  }catch(error){self.postMessage({type:'error',message:error.message,generation:data.generation});}
};
