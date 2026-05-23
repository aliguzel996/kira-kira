import './styles.css';

const canvas = document.querySelector('#previewCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const imageInput = document.querySelector('#imageInput');
const powerInput = document.querySelector('#powerInput');
const cutoffInput = document.querySelector('#cutoffInput');
const contrastInput = document.querySelector('#contrastInput');
const bladeInput = document.querySelector('#bladeInput');
const bladeLengthInput = document.querySelector('#bladeLengthInput');
const bladePowerInput = document.querySelector('#bladePowerInput');
const bladeSharpnessInput = document.querySelector('#bladeSharpnessInput');
const coreSpreadInput = document.querySelector('#coreSpreadInput');
const coreBlurInput = document.querySelector('#coreBlurInput');
const bokehInput = document.querySelector('#bokehInput');
const bokehSpreadInput = document.querySelector('#bokehSpreadInput');
const bokehBlurInput = document.querySelector('#bokehBlurInput');
const blendModeInput = document.querySelector('#blendModeInput');
const blendLayerInput = document.querySelector('#blendLayerInput');
const blendOpacityInput = document.querySelector('#blendOpacityInput');
const compareButton = document.querySelector('#compareButton');
const saveButton = document.querySelector('#saveButton');
const emptyState = document.querySelector('#emptyState');
const stage = document.querySelector('.stage');

const sourceCanvas = document.createElement('canvas');
const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
const glowCanvas = document.createElement('canvas');
const glowCtx = glowCanvas.getContext('2d');
const blendCanvas = document.createElement('canvas');
const blendCtx = blendCanvas.getContext('2d', { alpha: false });

let image = null;
let imageBitmapUrl = '';
let sparklePoints = [];
let glitterPoints = [];
let drawBox = { x: 0, y: 0, width: 0, height: 0 };
let isComparingOriginal = false;

const DPR_LIMIT = 2;

function resizeCanvas() {
  const rect = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}

function fitRect(srcWidth, srcHeight, dstWidth, dstHeight) {
  const scale = Math.min(dstWidth / srcWidth, dstHeight / srcHeight);
  const width = srcWidth * scale;
  const height = srcHeight * scale;
  return {
    x: (dstWidth - width) / 2,
    y: (dstHeight - height) / 2,
    width,
    height,
  };
}

function drawOriginalImage() {
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, drawBox.x, drawBox.y, drawBox.width, drawBox.height);
}

function syncBlendCanvas() {
  if (blendCanvas.width !== canvas.width || blendCanvas.height !== canvas.height) {
    blendCanvas.width = canvas.width;
    blendCanvas.height = canvas.height;
  }
}

function applyBlend(width, height) {
  const blendMode = blendModeInput.value;
  const layerOrder = blendLayerInput.value;
  const blendOpacity = Number(blendOpacityInput.value) / 100;

  if (blendMode === 'source-over' && layerOrder === 'effect-over' && blendOpacity >= 1) return;

  syncBlendCanvas();
  blendCtx.setTransform(1, 0, 0, 1, 0, 0);
  blendCtx.globalAlpha = 1;
  blendCtx.globalCompositeOperation = 'source-over';
  blendCtx.filter = 'none';
  blendCtx.clearRect(0, 0, blendCanvas.width, blendCanvas.height);
  blendCtx.drawImage(canvas, 0, 0);

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  if (layerOrder === 'effect-over') {
    drawOriginalImage();
    ctx.globalCompositeOperation = blendMode;
    ctx.globalAlpha = blendOpacity;
    ctx.drawImage(blendCanvas, 0, 0, width, height);
  } else {
    ctx.drawImage(blendCanvas, 0, 0, width, height);
    ctx.globalCompositeOperation = blendMode;
    ctx.globalAlpha = blendOpacity;
    drawOriginalImage();
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function hash01(x, y, salt = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function colorStats(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const saturation = max > 0 ? (max - min) / max : 0;
  return { luma, saturation };
}

function glowColor(r, g, b, lift) {
  const { luma, saturation } = colorStats(r, g, b);
  const saturationBoost = 1.18 + saturation * 0.28;
  const whiteMix = 0.06 + lift * 0.06;
  const gain = 1.05 + lift * 0.16;
  const rr = (luma + (r - luma) * saturationBoost) * gain;
  const gg = (luma + (g - luma) * saturationBoost) * gain;
  const bb = (luma + (b - luma) * saturationBoost) * gain;
  return [
    clampByte(rr * (1 - whiteMix) + 255 * whiteMix),
    clampByte(gg * (1 - whiteMix) + 255 * whiteMix),
    clampByte(bb * (1 - whiteMix) + 255 * whiteMix),
  ];
}

function rgbString(color) {
  return color ? `${color[0]},${color[1]},${color[2]}` : '255,255,255';
}

function loadFile(file) {
  if (!file) return;
  if (imageBitmapUrl) URL.revokeObjectURL(imageBitmapUrl);
  imageBitmapUrl = URL.createObjectURL(file);

  const nextImage = new Image();
  nextImage.onload = () => {
    image = nextImage;
    emptyState.hidden = true;
    prepareSource();
    render();
  };
  nextImage.src = imageBitmapUrl;
}

function prepareSource() {
  if (!image) return;

  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  sourceCtx.clearRect(0, 0, width, height);
  sourceCtx.drawImage(image, 0, 0, width, height);
  detectSparkles();
}

function detectSparkles() {
  if (!image || !sourceCanvas.width || !sourceCanvas.height) return;

  const contrastAmount = Number(contrastInput.value) / 100;
  const positiveContrast = Math.max(0, contrastAmount);
  const negativeContrast = Math.max(0, -contrastAmount);
  const cutoff = Math.max(60, Math.min(245, Number(cutoffInput.value) + positiveContrast * 30 - negativeContrast * 24));
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const sourceImage = sourceCtx.getImageData(0, 0, width, height);
  const data = sourceImage.data;
  const glowImage = glowCtx.createImageData(width, height);
  const glowData = glowImage.data;
  const tile = Math.max(12, Math.floor(Math.min(width, height) / 52));
  const fleckStep = Math.max(3, Math.floor(Math.min(width, height) / 260));
  const candidates = [];
  const flecks = [];

  glowCanvas.width = width;
  glowCanvas.height = height;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const rawLift = Math.max(0, (luma - cutoff) / (255 - cutoff));
    const lift = positiveContrast > 0
      ? Math.pow(rawLift, 1 + positiveContrast * 0.85)
      : Math.pow(rawLift, 1 / (1 + negativeContrast * 0.75));
    if (lift > 0) {
      const { saturation } = colorStats(r, g, b);
      const lowSatPenalty = luma > 170 && saturation < 0.18
        ? 0.24 + saturation * 2.45
        : 1;
      const color = glowColor(r, g, b, lift);
      glowData[i] = color[0];
      glowData[i + 1] = color[1];
      glowData[i + 2] = color[2];
      glowData[i + 3] = Math.min(225, Math.round(Math.pow(lift, 1.55) * 255 * lowSatPenalty));
    }
  }

  glowCtx.putImageData(glowImage, 0, 0);

  for (let y = fleckStep; y < height - fleckStep; y += fleckStep) {
    for (let x = fleckStep; x < width - fleckStep; x += fleckStep) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
      const rawLift = Math.max(0, (luma - cutoff) / (255 - cutoff));
      const lift = positiveContrast > 0
        ? Math.pow(rawLift, 1 + positiveContrast * 0.55)
        : Math.pow(rawLift, 1 / (1 + negativeContrast * 0.65));
      const chance = Math.min(0.34, Math.pow(lift, 1.08) * (0.052 + negativeContrast * 0.018));

      if (lift > 0.035 && hash01(x, y, 5) < chance) {
        flecks.push({
          x: x / width,
          y: y / height,
          alpha: Math.min(0.82, 0.11 + lift * 0.62 + hash01(x, y, 6) * 0.16),
          size: 0.3 + hash01(x, y, 7) * 1.16 + lift * 0.78,
          color: glowColor(r, g, b, lift),
          tint: hash01(x, y, 8),
          angle: hash01(x, y, 9) * Math.PI,
          streak: hash01(x, y, 10) > 0.9,
        });
      }
    }
  }

  for (let y = tile; y < height - tile; y += tile) {
    for (let x = tile; x < width - tile; x += tile) {
      let brightest = 0;
      let average = 0;
      let samples = 0;
      let hotSamples = 0;
      let bx = x;
      let by = y;

      for (let yy = y - tile; yy <= y + tile; yy += Math.max(3, Math.floor(tile / 3))) {
        for (let xx = x - tile; xx <= x + tile; xx += Math.max(3, Math.floor(tile / 3))) {
          const idx = (yy * width + xx) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
          average += luma;
          samples += 1;
          if (luma > cutoff + 18) hotSamples += 1;
          if (luma > brightest) {
            brightest = luma;
            bx = xx;
            by = yy;
          }
        }
      }

      average /= Math.max(1, samples);
      const rawLift = (brightest - cutoff) / (255 - cutoff);
      const lift = positiveContrast > 0
        ? Math.pow(Math.max(0, rawLift), 1 + positiveContrast * 0.85)
        : Math.pow(Math.max(0, rawLift), 1 / (1 + negativeContrast * 0.75));
      const contrast = Math.max(0, brightest - average) / 255;
      const hotRatio = hotSamples / Math.max(1, samples);
      const broadPenalty = 1 - Math.min(0.72, Math.max(0, hotRatio - 0.18) * 1.55);
      const score = lift * (0.2 + Math.pow(contrast, 0.78) * (1.55 + positiveContrast * 0.85)) * broadPenalty;
      const bladeScore = lift * (0.28 + Math.pow(contrast, 0.62) * 1.35 + Math.max(0, brightest - 242) / 35);

      if (score > 0.19 || bladeScore > 0.34) {
        const colorIdx = (by * width + bx) * 4;
        const color = glowColor(data[colorIdx], data[colorIdx + 1], data[colorIdx + 2], lift);
        candidates.push({
          x: bx,
          y: by,
          luma: brightest / 255,
          score,
          bladeScore,
          color,
          size: 0.72 + Math.min(1, score) * 1.25 + hash01(bx, by, 1) * 0.34,
          angle: hash01(bx, by, 3) * Math.PI * 0.55,
        });
      }
    }
  }

  const minDistance = Math.max(tile * 2.35, Math.min(width, height) / 56);
  const kept = [];
  for (const point of candidates.sort((a, b) => Math.max(b.score, b.bladeScore * 0.88) - Math.max(a.score, a.bladeScore * 0.88))) {
    const tooClose = kept.some((other) => {
      const dx = point.x - other.x;
      const dy = point.y - other.y;
      return Math.hypot(dx, dy) < minDistance;
    });

    if (!tooClose) {
      kept.push(point);
      if (kept.length >= 68) break;
    }
  }

  sparklePoints = kept.map((point) => ({
    ...point,
    x: point.x / width,
    y: point.y / height,
  }));

  glitterPoints = flecks
    .sort((a, b) => b.alpha - a.alpha)
    .slice(0, 2400);
}

function drawGlow(x, y, radius, alpha, color = null) {
  const rgb = rgbString(color);
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${rgb},${alpha})`);
  gradient.addColorStop(0.18, `rgba(${rgb},${alpha * 0.54})`);
  gradient.addColorStop(0.48, `rgba(${rgb},${alpha * 0.16})`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawBokehDisc(x, y, radius, alpha, tint, blurAmount, squash, angle, sourceColor = null) {
  const warm = tint < 0.36;
  const cool = tint > 0.72;
  const color = sourceColor ? rgbString(sourceColor) : warm ? '255,231,188' : cool ? '202,224,255' : '255,255,255';
  const gradient = ctx.createRadialGradient(0, 0, radius * 0.08, 0, 0, radius);
  gradient.addColorStop(0, `rgba(${color},${alpha * 0.08})`);
  gradient.addColorStop(0.46, `rgba(${color},${alpha * 0.14})`);
  gradient.addColorStop(0.76, `rgba(${color},${alpha * 0.32})`);
  gradient.addColorStop(1, `rgba(${color},0)`);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.filter = `blur(${blurAmount}px)`;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius * squash, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = Math.max(0.35, radius * 0.018);
  ctx.strokeStyle = `rgba(${color},${alpha * 0.09})`;
  ctx.stroke();
  ctx.restore();
}

function drawBokehLayer(box, points, power, spread, blurAmount, rotate) {
  if (!points.length || power <= 0) return;

  const minSide = Math.min(box.width, box.height);
  const baseRadius = minSide * (0.015 + spread * 0.043);
  const reach = minSide * (0.012 + spread * 0.068);
  const count = Math.min(points.length, Math.round(6 + spread * 18 + power * 6));

  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.width, box.height);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';

  for (let index = 0; index < count; index += 1) {
    const point = points[index];
    const strength = Math.min(1, point.score);
    const copies = spread > 0.55 && strength > 0.26 ? 2 : 1;

    for (let copy = 0; copy < copies; copy += 1) {
      const seed = index * 13 + copy * 31;
      const direction = point.angle + rotate * 0.08 + hash01(index, seed, 20) * Math.PI * 2;
      const distance = reach * (0.16 + hash01(index, seed, 21) * 0.84);
      const x = box.x + point.x * box.width + Math.cos(direction) * distance;
      const y = box.y + point.y * box.height + Math.sin(direction) * distance;
      const radius = baseRadius * point.size * (0.62 + strength * 0.72 + hash01(index, seed, 22) * 0.46);
      const alpha = Math.min(0.18, (0.025 + strength * 0.085 + point.luma * 0.05) * power);
      const blurPx = Math.max(0.65, radius * (0.06 + blurAmount * 0.22));
      const squash = 0.82 + hash01(index, seed, 23) * 0.25;
      const tilt = hash01(index, seed, 24) * Math.PI;

      drawBokehDisc(x, y, radius, alpha, hash01(index, seed, 25), blurPx, squash, tilt, point.color);
    }
  }

  ctx.restore();
}

function drawNylonDiffusion(box, power, blurAmount) {
  const spacing = Math.max(28, Math.min(box.width, box.height) / 12);
  const alpha = Math.min(0.018, power * (0.003 + blurAmount * 0.007));
  const reach = box.width + box.height;

  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.width, box.height);
  ctx.clip();
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = 0.45;
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 1.8 + blurAmount * 3;

  for (const tilt of [-0.72, 0.72]) {
    ctx.save();
    ctx.translate(box.x + box.width / 2, box.y + box.height / 2);
    ctx.rotate(tilt);
    for (let x = -reach; x <= reach; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, -reach);
      ctx.lineTo(x, reach);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}

function drawGlitterFleck(x, y, size, alpha, tint, angle, streak, sourceColor = null) {
  const warm = tint < 0.38;
  const cool = tint > 0.74;
  const color = sourceColor ? rgbString(sourceColor) : warm ? '255,232,188' : cool ? '202,226,255' : '255,255,255';
  const radius = size * (streak ? 2.25 : 1.85);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, `rgba(${color},${alpha})`);
  gradient.addColorStop(0.2, `rgba(${color},${alpha * 0.48})`);
  gradient.addColorStop(0.58, `rgba(${color},${alpha * 0.1})`);
  gradient.addColorStop(1, `rgba(${color},0)`);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * (streak ? 1.65 : 1), radius * (streak ? 0.38 : 0.82), 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(${color},${alpha * 0.38})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.max(0.22, size * 0.28), Math.max(0.16, size * 0.2), 0, 0, Math.PI * 2);
  ctx.fill();

  if (streak) {
    const line = ctx.createLinearGradient(-radius * 1.8, 0, radius * 1.8, 0);
    line.addColorStop(0, 'rgba(255,255,255,0)');
    line.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.16})`);
    line.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = line;
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(-radius * 1.8, 0);
    ctx.lineTo(radius * 1.8, 0);
    ctx.stroke();
  }

  ctx.restore();
}

function strokeOpticBlade(length, alpha, bend, sharpness, chromaOffset = 0, color = '255,255,255') {
  const curve = Math.min(2.2, Math.max(0, bend));
  const tipY = length * curve * 0.14;
  const startX = -length * 0.14;
  const endX = length;
  const control1 = { x: length * 0.22, y: tipY * 0.55 + chromaOffset };
  const control2 = { x: length * 0.68, y: tipY * 0.2 + chromaOffset };
  const end = { x: endX, y: tipY * 0.06 + chromaOffset };
  const edgeAlpha = 0.06 + sharpness * 0.08;
  const centerAlpha = 0.55 + sharpness * 0.58;
  const gradient = ctx.createLinearGradient(startX, 0, endX, end.y);
  gradient.addColorStop(0, `rgba(${color},0)`);
  gradient.addColorStop(0.2, `rgba(${color},${alpha * edgeAlpha})`);
  gradient.addColorStop(0.48, `rgba(${color},${alpha * centerAlpha})`);
  gradient.addColorStop(0.78, `rgba(${color},${alpha * edgeAlpha * 1.25})`);
  gradient.addColorStop(1, `rgba(${color},0)`);

  ctx.strokeStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(startX, chromaOffset);
  ctx.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, end.x, end.y);
  ctx.stroke();
}

function drawBladeSet(radius, alpha, bladeCount, bend, blur, sourceColor = null, visibility = 1, sharpness = 0.58) {
  const segment = bladeCount === 1 ? Math.PI * 2 : (Math.PI * 2) / bladeCount;
  const length = radius * (bladeCount === 1 ? 1.42 : 1.04);
  const softAlpha = alpha * (bladeCount === 1 ? 0.78 : 0.54) * (0.58 + visibility * 0.84);
  const bladeColor = rgbString(sourceColor);
  const softBlur = Math.max(0.12, blur * (1.1 - sharpness * 0.62));
  const hazeBlur = softBlur * (1.22 + (1 - sharpness) * 0.75);
  const lineBoost = 0.72 + visibility * 0.62;

  for (let index = 0; index < bladeCount; index += 1) {
    ctx.save();
    ctx.rotate(index * segment);

    ctx.lineCap = 'round';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = hazeBlur * 7.8;
    ctx.filter = `blur(${Math.max(0.28, hazeBlur * 0.15)}px)`;
    ctx.lineWidth = (bladeCount === 1 ? 2.4 : 1.5) * (1.08 - sharpness * 0.2);
    ctx.globalAlpha = (0.28 + visibility * 0.16) * lineBoost;
    strokeOpticBlade(length, softAlpha, bend, sharpness, 0, bladeColor);

    ctx.shadowBlur = softBlur * 3.1;
    ctx.filter = `blur(${Math.max(0.08, softBlur * (0.08 - sharpness * 0.04))}px)`;
    ctx.lineWidth = (bladeCount === 1 ? 0.92 : 0.62) * (0.78 + sharpness * 0.5);
    ctx.globalAlpha = (0.42 + sharpness * 0.28) * lineBoost;
    strokeOpticBlade(length, softAlpha * (0.86 + sharpness * 0.22), bend, sharpness, 0, bladeColor);

    ctx.shadowBlur = softBlur * 1.25;
    ctx.filter = sharpness > 0.74 ? 'none' : `blur(${Math.max(0.03, softBlur * 0.035)}px)`;
    ctx.lineWidth = Math.max(0.28, (bladeCount === 1 ? 0.44 : 0.34) * (0.65 + sharpness * 0.78));
    ctx.globalAlpha = sharpness * (0.14 + visibility * 0.18);
    strokeOpticBlade(length * 0.98, softAlpha * 0.9, bend, sharpness, 0, bladeColor);

    ctx.globalAlpha = 0.07 + visibility * 0.045;
    ctx.filter = `blur(${Math.max(0.24, softBlur * 0.08)}px)`;
    ctx.lineWidth = 0.32;
    ctx.shadowBlur = softBlur * 1.4;
    strokeOpticBlade(length, softAlpha * 0.32, bend, sharpness, -0.9, '255,142,96');
    strokeOpticBlade(length, softAlpha * 0.32, bend, sharpness, 0.9, '122,206,255');
    ctx.restore();
  }
}

function drawSparkle(x, y, size, alpha, angle, bladeCount, bladeLength, bladeBend, coreSpread, coreBlur, sourceColor = null, bladeVisibility = 1, bladeSharpness = 0.58) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const bladeFade = Math.max(0.34, 0.98 - coreBlur * 0.12 - Math.max(0, coreSpread - 1.0) * 0.1);
  drawBladeSet(
    size * bladeLength,
    alpha * (0.92 + bladeVisibility * 0.38) * bladeFade,
    bladeCount,
    bladeBend,
    size * (0.36 + coreBlur * 0.42),
    sourceColor,
    bladeVisibility,
    bladeSharpness,
  );

  ctx.shadowBlur = size * (0.08 + coreBlur * 0.34);
  const blurFade = Math.min(1, coreBlur / 2.2);
  const spreadFade = Math.min(1, Math.max(0, coreSpread - 0.2) / 2);
  const coreRadius = Math.max(1.1, size * (0.18 + coreSpread * 0.38));
  const coreBoost = bladeCount === 1 ? 0.62 : 0.96;
  const coreFade = Math.max(0.16, 0.62 - blurFade * 0.34 - spreadFade * 0.2);
  const coreAlpha = alpha * coreBoost * coreFade;
  const coreColor = rgbString(sourceColor);
  const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius * (2.8 + coreBlur * 1.6));
  coreGradient.addColorStop(0, `rgba(${coreColor},${coreAlpha})`);
  coreGradient.addColorStop(0.34, `rgba(${coreColor},${coreAlpha * 0.4})`);
  coreGradient.addColorStop(1, `rgba(${coreColor},0)`);

  ctx.save();
  ctx.filter = `blur(${size * coreBlur * 0.18}px)`;
  ctx.fillStyle = coreGradient;
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius * (2.8 + coreBlur * 1.6), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function render() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  if (!image) return;

  drawBox = fitRect(image.naturalWidth, image.naturalHeight, width, height);
  drawOriginalImage();

  if (isComparingOriginal) {
    return;
  }

  const power = Number(powerInput.value) / 100;
  const cutoffValue = Number(cutoffInput.value);
  const rotate = 0;
  const bladeCount = Number(bladeInput.value);
  const bladeLengthSlider = (Number(bladeLengthInput.value) - 40) / 180;
  const bladeLength = 0.4 + Math.pow(Math.max(0, Math.min(1, bladeLengthSlider)), 0.86) * 1.7;
  const bladeVisibility = Math.pow(Number(bladePowerInput.value) / 100, 0.82);
  const bladeSharpness = Math.pow(Number(bladeSharpnessInput.value) / 100, 0.72);
  const bladeBend = 0.7;
  const spreadSlider = (Number(coreSpreadInput.value) - 20) / 200;
  const blurSlider = Number(coreBlurInput.value) / 220;
  const coreSpread = 0.35 + Math.pow(Math.max(0, Math.min(1, spreadSlider)), 0.85) * 1.35;
  const coreBlur = Math.pow(Math.max(0, Math.min(1, blurSlider)), 0.9) * 1.8;
  const bokehSpread = Math.pow(Number(bokehSpreadInput.value) / 220, 0.85);
  const bokehBlur = Math.pow(Number(bokehBlurInput.value) / 220, 0.9);
  const baseSize = Math.max(6, Math.min(drawBox.width, drawBox.height) / 125);

  ctx.globalCompositeOperation = 'screen';
  ctx.save();
  const bloomUnit = Math.max(2, Math.min(drawBox.width, drawBox.height) / 140);
  ctx.globalAlpha = 0.12 + power * 0.34;
  ctx.filter = `blur(${bloomUnit * (2.15 + coreBlur * 1.38)}px)`;
  ctx.drawImage(glowCanvas, drawBox.x, drawBox.y, drawBox.width, drawBox.height);
  ctx.globalAlpha = 0.22 + power * 0.58;
  ctx.filter = `blur(${bloomUnit * (0.72 + coreBlur * 1.02)}px)`;
  ctx.drawImage(glowCanvas, drawBox.x, drawBox.y, drawBox.width, drawBox.height);
  ctx.filter = 'none';
  ctx.globalAlpha = 0.052 + power * 0.14;
  ctx.drawImage(glowCanvas, drawBox.x, drawBox.y, drawBox.width, drawBox.height);
  ctx.restore();

  drawNylonDiffusion(drawBox, power, coreBlur);

  if (bokehInput.checked) {
    drawBokehLayer(drawBox, sparklePoints, power, bokehSpread, bokehBlur, rotate);
  }

  for (const point of glitterPoints) {
    drawGlitterFleck(
      drawBox.x + point.x * drawBox.width,
      drawBox.y + point.y * drawBox.height,
      point.size * (0.72 + coreBlur * 0.24),
      point.alpha * power * 1.08,
      point.tint,
      point.angle + rotate * 0.35,
      point.streak,
      point.color,
    );
  }

  const lowCutoffPenalty = 1 - Math.min(0.28, Math.max(0, 150 - cutoffValue) / 330);
  const bladeLimit = Math.max(2, Math.round((3 + power * (9 + bladeVisibility * 9)) * lowCutoffPenalty));
  const bladeThreshold = 0.21 + Math.max(0, 132 - cutoffValue) / 1200 + (1 - power) * 0.08 - bladeVisibility * 0.075;

  for (const [index, point] of sparklePoints.entries()) {
    const strength = Math.min(1, point.score);
    const bladeStrength = Math.min(1.25, point.bladeScore || point.score);
    const size = baseSize * point.size * (0.92 + strength * 1.05);
    const alpha = Math.min(0.32, (0.04 + point.luma * 0.24 + strength * 0.13) * power);
    drawGlow(
      drawBox.x + point.x * drawBox.width,
      drawBox.y + point.y * drawBox.height,
      size * (2.25 + strength * 1.15) * (0.85 + Math.min(coreSpread, 1.7) * 0.18),
      alpha * 0.24 * Math.min(coreSpread, 1.55),
      point.color,
    );

    if (index < bladeLimit && bladeStrength > bladeThreshold && point.luma > 0.72 && alpha > 0.045) {
      drawSparkle(
        drawBox.x + point.x * drawBox.width,
        drawBox.y + point.y * drawBox.height,
        size * (0.96 + bladeStrength * 0.38),
        Math.min(0.56, alpha * (0.9 + bladeStrength * 0.7) * (0.74 + bladeVisibility * 0.68)),
        point.angle + rotate,
        bladeCount,
        bladeLength,
        bladeBend,
        coreSpread,
        coreBlur,
        point.color,
        bladeVisibility,
        bladeSharpness,
      );
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  applyBlend(width, height);
}

imageInput.addEventListener('change', (event) => {
  loadFile(event.target.files?.[0]);
});

for (const eventName of ['dragenter', 'dragover']) {
  stage.addEventListener(eventName, (event) => {
    event.preventDefault();
    stage.classList.add('is-dragging');
  });
}

for (const eventName of ['dragleave', 'drop']) {
  stage.addEventListener(eventName, (event) => {
    event.preventDefault();
    stage.classList.remove('is-dragging');
  });
}

stage.addEventListener('drop', (event) => {
  loadFile(event.dataTransfer?.files?.[0]);
});

powerInput.addEventListener('input', render);
bladeInput.addEventListener('input', render);
bladeLengthInput.addEventListener('input', render);
bladePowerInput.addEventListener('input', render);
bladeSharpnessInput.addEventListener('input', render);
coreSpreadInput.addEventListener('input', render);
coreBlurInput.addEventListener('input', render);
bokehInput.addEventListener('change', render);
bokehSpreadInput.addEventListener('input', render);
bokehBlurInput.addEventListener('input', render);
blendModeInput.addEventListener('change', render);
blendLayerInput.addEventListener('change', render);
blendOpacityInput.addEventListener('input', render);
contrastInput.addEventListener('input', () => {
  detectSparkles();
  render();
});
cutoffInput.addEventListener('input', () => {
  detectSparkles();
  render();
});

function setCompareOriginal(value) {
  if (isComparingOriginal === value) return;
  isComparingOriginal = value;
  compareButton.classList.toggle('is-active', value);
  compareButton.setAttribute('aria-pressed', value ? 'true' : 'false');
  render();
}

compareButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  compareButton.setPointerCapture?.(event.pointerId);
  setCompareOriginal(true);
});

for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  compareButton.addEventListener(eventName, () => setCompareOriginal(false));
}

compareButton.addEventListener('keydown', (event) => {
  if (event.key !== ' ' && event.key !== 'Enter') return;
  event.preventDefault();
  setCompareOriginal(true);
});

compareButton.addEventListener('keyup', (event) => {
  if (event.key !== ' ' && event.key !== 'Enter') return;
  event.preventDefault();
  setCompareOriginal(false);
});

saveButton.addEventListener('click', () => {
  if (!image) return;
  const link = document.createElement('a');
  link.download = 'effect.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
