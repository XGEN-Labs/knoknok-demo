// User-selected avatar stays in this browser until they explicitly share the card.
export async function prepareAvatar(file) {
  if (!['image/png','image/jpeg','image/webp'].includes(file?.type)) throw new Error('請選擇 PNG、JPG 或 WebP 圖片。');
  if (file.size > 12 * 1024 * 1024) throw new Error('圖片太大，請選擇 12 MB 以下的圖片。');
  const url=URL.createObjectURL(file);
  try {
    const image=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('這張圖片無法讀取，換一張試試。'));image.src=url;});
    const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;
    const context=canvas.getContext('2d');
    const size=Math.min(image.naturalWidth,image.naturalHeight);
    if(!size||!context)throw new Error('這張圖片無法讀取，換一張試試。');
    context.drawImage(image,(image.naturalWidth-size)/2,(image.naturalHeight-size)/2,size,size,0,0,96,96);
    const result=canvas.toDataURL('image/webp',.72);
    if(result.length>16000)throw new Error('圖片細節太多，換張簡單一點的頭像吧。');
    return result;
  } finally {URL.revokeObjectURL(url);}
}
