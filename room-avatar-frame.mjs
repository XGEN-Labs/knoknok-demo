// Capture only the character crop from the already decoded, paused room.
// This stays in memory; no download, upload, media rewrite or per-frame canvas.
export function captureRoomAvatarFrame(source, {width, height, crop} = {}, doc = source?.ownerDocument) {
  if (!source || !doc || !(width > 0 && height > 0) || !crop || !['x','y','width','height'].every(key=>Number.isFinite(crop[key])) || crop.width <= 0 || crop.height !== crop.width) return null;
  const video = source.tagName?.toLowerCase() === 'video';
  if (video && (source.readyState < 2 || source.seeking)) return null;
  const nativeWidth = video ? source.videoWidth : source.naturalWidth;
  const nativeHeight = video ? source.videoHeight : source.naturalHeight;
  if (!(nativeWidth > 0 && nativeHeight > 0) || crop.x < 0 || crop.y < 0 || crop.x + crop.width > width || crop.y + crop.height > height) return null;
  try {
    const canvas=doc.createElement('canvas'),size=Math.min(512,Math.ceil(crop.width));
    canvas.width=canvas.height=size;
    const context=canvas.getContext('2d');if(!context)return null;
    context.drawImage(source,crop.x*nativeWidth/width,crop.y*nativeHeight/height,crop.width*nativeWidth/width,crop.height*nativeHeight/height,0,0,size,size);
    return {src:canvas.toDataURL('image/png'),width:size,height:size,crop:{x:0,y:0,width:size,height:size}};
  } catch {return null;}
}
