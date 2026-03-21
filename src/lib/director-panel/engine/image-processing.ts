/**
 * Client-side image processing using Canvas API.
 * No external dependencies — runs entirely in the browser.
 */

function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    // Proxy external URLs to avoid CORS issues with canvas
    const isExternal = url.startsWith('http') && !url.startsWith(window.location.origin);
    img.src = isExternal ? `/api/director-panel/proxy-image?url=${encodeURIComponent(url)}` : url;
  });
}

function canvasToDataUrl(canvas: HTMLCanvasElement, format = 'image/png', quality = 0.92): string {
  return canvas.toDataURL(format, quality);
}

// ─── Levels (brightness / contrast / saturation) ─────────────────────────────

export async function applyLevels(
  imageUrl: string,
  brightness: number,  // -100 to 100
  contrast: number,    // -100 to 100
  saturation: number   // -100 to 100
): Promise<string> {
  const img = await loadImage(imageUrl);
  const { canvas, ctx } = createCanvas(img.width, img.height);

  // Apply CSS filters via canvas
  const b = 1 + brightness / 100;
  const c = 1 + contrast / 100;
  const s = 1 + saturation / 100;
  ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s})`;
  ctx.drawImage(img, 0, 0);

  return canvasToDataUrl(canvas);
}

// ─── Crop ────────────────────────────────────────────────────────────────────

export async function applyCrop(
  imageUrl: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<string> {
  const img = await loadImage(imageUrl);
  const { canvas, ctx } = createCanvas(width, height);
  ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
  return canvasToDataUrl(canvas);
}

// ─── Resize ──────────────────────────────────────────────────────────────────

export async function applyResize(
  imageUrl: string,
  targetWidth: number,
  targetHeight: number,
  maintainAspect: boolean
): Promise<string> {
  const img = await loadImage(imageUrl);
  let w = targetWidth;
  let h = targetHeight;

  if (maintainAspect) {
    const ratio = Math.min(targetWidth / img.width, targetHeight / img.height);
    w = Math.round(img.width * ratio);
    h = Math.round(img.height * ratio);
  }

  const { canvas, ctx } = createCanvas(w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvasToDataUrl(canvas);
}

// ─── Blur ────────────────────────────────────────────────────────────────────

export async function applyBlur(
  imageUrl: string,
  radius: number,
  _type: string = 'gaussian'
): Promise<string> {
  const img = await loadImage(imageUrl);
  const { canvas, ctx } = createCanvas(img.width, img.height);
  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(img, 0, 0);
  return canvasToDataUrl(canvas);
}

// ─── Invert ──────────────────────────────────────────────────────────────────

export async function applyInvert(imageUrl: string): Promise<string> {
  const img = await loadImage(imageUrl);
  const { canvas, ctx } = createCanvas(img.width, img.height);
  ctx.filter = 'invert(1)';
  ctx.drawImage(img, 0, 0);
  return canvasToDataUrl(canvas);
}

// ─── Channels ────────────────────────────────────────────────────────────────

export async function extractChannel(
  imageUrl: string,
  channel: 'red' | 'green' | 'blue' | 'alpha' | 'all'
): Promise<string> {
  if (channel === 'all') {
    return imageUrl; // no-op
  }

  const img = await loadImage(imageUrl);
  const { canvas, ctx } = createCanvas(img.width, img.height);
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const d = imageData.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    switch (channel) {
      case 'red':   d[i] = r; d[i + 1] = 0; d[i + 2] = 0; break;
      case 'green': d[i] = 0; d[i + 1] = g; d[i + 2] = 0; break;
      case 'blue':  d[i] = 0; d[i + 1] = 0; d[i + 2] = b; break;
      case 'alpha': d[i] = d[i + 3]; d[i + 1] = d[i + 3]; d[i + 2] = d[i + 3]; d[i + 3] = 255; break;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToDataUrl(canvas);
}

// ─── Compositor (blend two images) ───────────────────────────────────────────

export async function composite(
  foregroundUrl: string,
  backgroundUrl: string,
  blendMode: string,
  opacity: number
): Promise<string> {
  const [fg, bg] = await Promise.all([loadImage(foregroundUrl), loadImage(backgroundUrl)]);
  const { canvas, ctx } = createCanvas(bg.width, bg.height);

  // Draw background
  ctx.drawImage(bg, 0, 0);

  // Draw foreground with blend mode
  ctx.globalCompositeOperation = (blendMode as GlobalCompositeOperation) || 'source-over';
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.drawImage(fg, 0, 0, bg.width, bg.height);

  return canvasToDataUrl(canvas);
}

// ─── Merge Alpha (foreground + mask) ─────────────────────────────────────────

export async function mergeAlpha(
  foregroundUrl: string,
  maskUrl: string
): Promise<string> {
  const [fg, mask] = await Promise.all([loadImage(foregroundUrl), loadImage(maskUrl)]);
  const { canvas, ctx } = createCanvas(fg.width, fg.height);

  // Draw foreground
  ctx.drawImage(fg, 0, 0);

  // Apply mask as alpha
  const fgData = ctx.getImageData(0, 0, fg.width, fg.height);

  const maskCanvas = createCanvas(fg.width, fg.height);
  maskCanvas.ctx.drawImage(mask, 0, 0, fg.width, fg.height);
  const maskData = maskCanvas.ctx.getImageData(0, 0, fg.width, fg.height);

  for (let i = 0; i < fgData.data.length; i += 4) {
    // Use mask brightness as alpha
    const maskBrightness = (maskData.data[i] + maskData.data[i + 1] + maskData.data[i + 2]) / 3;
    fgData.data[i + 3] = Math.round(maskBrightness);
  }

  ctx.putImageData(fgData, 0, 0);
  return canvasToDataUrl(canvas);
}

// ─── Matte Grow/Shrink ──────────────────────────────────────────────────────

export async function matteGrowShrink(
  maskUrl: string,
  amount: number // positive = grow, negative = shrink
): Promise<string> {
  const img = await loadImage(maskUrl);
  const { canvas, ctx } = createCanvas(img.width, img.height);
  ctx.drawImage(img, 0, 0);

  if (amount === 0) return canvasToDataUrl(canvas);

  // Simple dilate/erode by drawing at offsets
  const abs = Math.abs(amount);
  const result = createCanvas(img.width, img.height);

  if (amount > 0) {
    // Grow: draw the mask multiple times with offsets
    result.ctx.globalCompositeOperation = 'lighter';
    for (let dx = -abs; dx <= abs; dx++) {
      for (let dy = -abs; dy <= abs; dy++) {
        if (dx * dx + dy * dy <= abs * abs) {
          result.ctx.drawImage(canvas, dx, dy);
        }
      }
    }
  } else {
    // Shrink: invert, dilate, invert back using temp canvas
    const temp = document.createElement('canvas');
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tempCtx = temp.getContext('2d')!;
    tempCtx.filter = 'invert(1)';
    tempCtx.drawImage(canvas, 0, 0);
    // Dilate on temp
    for (let i = 0; i < abs; i++) {
      tempCtx.filter = `blur(${Math.ceil(abs)}px)`;
      tempCtx.drawImage(temp, 0, 0);
    }
    // Invert back to result
    result.ctx.filter = 'invert(1)';
    result.ctx.drawImage(temp, 0, 0);
    result.ctx.filter = 'none';
  }

  return canvasToDataUrl(result.canvas);
}

// ─── Extract Video Frame ─────────────────────────────────────────────────────

export async function extractVideoFrame(
  videoUrl: string,
  frameIndex: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';

    video.onloadedmetadata = () => {
      const fps = 30; // assume 30fps
      const time = frameIndex / fps;
      video.currentTime = Math.min(time, video.duration - 0.01);
    };

    video.onseeked = () => {
      const { canvas, ctx } = createCanvas(video.videoWidth, video.videoHeight);
      ctx.drawImage(video, 0, 0);
      resolve(canvasToDataUrl(canvas));
      video.remove();
    };

    video.onerror = () => reject(new Error('Failed to load video'));
    video.src = videoUrl;
  });
}

export async function renderTextOverlay(
  imageUrl: string,
  opts: {
    text: string;
    fontSize: number;
    fontColor: string;
    fontWeight: string;
    position: string;
    background: string;
    padding: number;
  },
): Promise<string> {
  const img = await loadImage(imageUrl);
  const { canvas, ctx } = createCanvas(img.width, img.height);
  ctx.drawImage(img, 0, 0);

  const font = `${opts.fontWeight} ${opts.fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.font = font;

  const lines = opts.text.split('\n');
  const lineHeight = opts.fontSize * 1.3;
  const metrics = lines.map((line) => ctx.measureText(line));
  const maxWidth = Math.max(...metrics.map((m) => m.width));
  const totalHeight = lines.length * lineHeight;
  const pad = opts.padding;

  // Calculate position
  let x = pad;
  let y = pad;
  const boxW = maxWidth + pad * 2;
  const boxH = totalHeight + pad * 2;

  if (opts.position.includes('center') && !opts.position.includes('top') && !opts.position.includes('bottom')) {
    x = (img.width - boxW) / 2;
    y = (img.height - boxH) / 2;
  } else {
    if (opts.position.includes('right')) x = img.width - boxW - pad;
    else if (opts.position.includes('center')) x = (img.width - boxW) / 2;

    if (opts.position.includes('bottom')) y = img.height - boxH - pad;
    else if (opts.position.includes('center') && opts.position.includes('top')) y = pad;
  }

  // Draw background
  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 8);
    ctx.fill();
  }

  // Draw text
  ctx.fillStyle = opts.fontColor;
  ctx.font = font;
  ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    const textX = x + pad;
    const textY = y + pad + i * lineHeight;
    ctx.fillText(lines[i], textX, textY);
  }

  return canvasToDataUrl(canvas);
}
