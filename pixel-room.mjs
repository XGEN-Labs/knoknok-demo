// Preserve the original scene file; only its display is sampled onto the sprite grid.
export function initPixelRoom(scene) {
  const canvas = scene.querySelector('.pixel-room-raster');
  const source = scene.querySelector('.pixel-room-source');
  if (!canvas || !source || scene.dataset.pixelRoomInitialized) return;
  scene.dataset.pixelRoomInitialized = 'true';
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return;

  function draw() {
    if (!source.naturalWidth || !source.naturalHeight) return;
    const scale = Math.max(canvas.width / source.naturalWidth, canvas.height / source.naturalHeight);
    const width = source.naturalWidth * scale;
    const height = source.naturalHeight * scale;
    // Average each logical pixel once; CSS magnifies this fixed raster without smoothing.
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    scene.classList.add('is-pixel-ready');
  }

  if (source.complete) draw();
  else source.addEventListener('load', draw, { once: true });
}
