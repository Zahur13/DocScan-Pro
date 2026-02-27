import type { FilterSettings } from '../store/documentStore';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

function applySharpen(imageData: ImageData, amount: number): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data);
  const k = amount;
  const kernel = [0, -k, 0, -k, 1 + 4 * k, -k, 0, -k, 0];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let val = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            val += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        output[(y * width + x) * 4 + c] = Math.min(255, Math.max(0, val));
      }
    }
  }

  return new ImageData(output, width, height);
}

export const processImage = async (
  original: string,
  filters: FilterSettings
): Promise<string> => {
  const img = await loadImage(original);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const rad = (filters.rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  canvas.width = Math.round(img.width * cos + img.height * sin);
  canvas.height = Math.round(img.width * sin + img.height * cos);

  ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) grayscale(${filters.grayscale}%)`;

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();

  if (filters.sharpness > 0) {
    ctx.filter = 'none';
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const sharpened = applySharpen(imageData, filters.sharpness / 100);
    ctx.putImageData(sharpened, 0, 0);
  }

  return canvas.toDataURL('image/png');
};

// Filter presets
export const presets: Record<string, Partial<FilterSettings>> = {
  original: {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    sharpness: 0,
    grayscale: 0,
    rotation: 0,
  },
  auto: {
    brightness: 110,
    contrast: 120,
    saturation: 110,
    sharpness: 30,
    grayscale: 0,
  },
  document: {
    brightness: 115,
    contrast: 150,
    saturation: 0,
    sharpness: 50,
    grayscale: 100,
  },
  'b&w': {
    brightness: 105,
    contrast: 130,
    saturation: 0,
    sharpness: 20,
    grayscale: 100,
  },
  vivid: {
    brightness: 105,
    contrast: 115,
    saturation: 150,
    sharpness: 20,
    grayscale: 0,
  },
  clarity: {
    brightness: 100,
    contrast: 135,
    saturation: 100,
    sharpness: 60,
    grayscale: 0,
  },
  brighten: {
    brightness: 130,
    contrast: 110,
    saturation: 105,
    sharpness: 10,
    grayscale: 0,
  },
  shadow: {
    brightness: 125,
    contrast: 115,
    saturation: 95,
    sharpness: 15,
    grayscale: 0,
  },
};

// Export functions — single images per page
export const exportToPDF = async (images: string[], filename = 'document.pdf') => {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  for (let i = 0; i < images.length; i++) {
    if (i > 0) pdf.addPage();
    const img = await loadImage(images[i]);
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const ratio = img.width / img.height;
    const pageRatio = pw / ph;
    let w: number, h: number, x: number, y: number;

    if (ratio > pageRatio) {
      w = pw - 10;
      h = w / ratio;
      x = 5;
      y = (ph - h) / 2;
    } else {
      h = ph - 10;
      w = h * ratio;
      x = (pw - w) / 2;
      y = 5;
    }

    pdf.addImage(images[i], 'PNG', x, y, w, h);
  }

  pdf.save(filename);
};

// Export with front & back side by side on the same page (landscape)
export const exportToPDFSideBySide = async (
  pairs: { front: string | null; back: string | null; name: string }[],
  filename = 'document.pdf'
) => {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const gap = 6;
  const halfW = (pw - margin * 2 - gap) / 2;
  const usableH = ph - margin * 2 - 10; // 10mm for label

  let isFirstPage = true;

  for (const pair of pairs) {
    if (!pair.front && !pair.back) continue;

    if (!isFirstPage) pdf.addPage();
    isFirstPage = false;

    // Document name label
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text(pair.name, pw / 2, margin + 2, { align: 'center' });

    const labelOffset = 8;

    // Draw front image on left half
    if (pair.front) {
      const img = await loadImage(pair.front);
      const ratio = img.width / img.height;
      let w: number, h: number;

      if (ratio > halfW / usableH) {
        w = halfW;
        h = w / ratio;
      } else {
        h = usableH;
        w = h * ratio;
      }

      const x = margin + (halfW - w) / 2;
      const y = margin + labelOffset + (usableH - h) / 2;
      pdf.addImage(pair.front, 'PNG', x, y, w, h);

      // "Front" label
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text('FRONT', margin + halfW / 2, ph - margin + 2, { align: 'center' });
    }

    // Draw back image on right half
    if (pair.back) {
      const img = await loadImage(pair.back);
      const ratio = img.width / img.height;
      let w: number, h: number;

      if (ratio > halfW / usableH) {
        w = halfW;
        h = w / ratio;
      } else {
        h = usableH;
        w = h * ratio;
      }

      const x = margin + halfW + gap + (halfW - w) / 2;
      const y = margin + labelOffset + (usableH - h) / 2;
      pdf.addImage(pair.back, 'PNG', x, y, w, h);

      // "Back" label
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text('BACK', margin + halfW + gap + halfW / 2, ph - margin + 2, { align: 'center' });
    }

    // Center divider line
    if (pair.front && pair.back) {
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.3);
      pdf.line(
        margin + halfW + gap / 2,
        margin + labelOffset,
        margin + halfW + gap / 2,
        ph - margin
      );
    }
  }

  pdf.save(filename);
};

export const exportAsImage = (dataUrl: string, filename: string) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const dataUrlToBlob = (dataUrl: string): Blob => {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)![1];
  const bstr = atob(parts[1]);
  const u8 = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
  return new Blob([u8], { type: mime });
};

export const exportAsZip = async (
  images: { name: string; dataUrl: string }[],
  filename = 'documents.zip'
) => {
  const zip = new JSZip();
  images.forEach(({ name, dataUrl }) => {
    const blob = dataUrlToBlob(dataUrl);
    zip.file(name, blob);
  });
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, filename);
};

export const convertToFormat = async (
  src: string,
  format: 'png' | 'jpeg',
  quality = 0.92
): Promise<string> => {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL(`image/${format}`, quality);
};

// Compose front & back images side by side into a single canvas image
export const composeSideBySide = async (
  front: string | null,
  back: string | null,
  options?: { width?: number; height?: number }
): Promise<string> => {
  const frontImg = front ? await loadImage(front) : null;
  const backImg = back ? await loadImage(back) : null;

  if (!frontImg && !backImg) throw new Error('No images to compose');

  // Determine target dimensions for each half
  const gap = 20; // px gap between images

  if (options?.width && options?.height) {
    // Use custom dimensions for each image
    const imgW = options.width;
    const imgH = options.height;
    const hasBoth = frontImg && backImg;
    const canvasW = hasBoth ? imgW * 2 + gap : imgW;
    const canvasH = imgH;

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    if (frontImg) {
      ctx.drawImage(frontImg, 0, 0, imgW, imgH);
    }
    if (backImg) {
      const xOffset = frontImg ? imgW + gap : 0;
      ctx.drawImage(backImg, xOffset, 0, imgW, imgH);
    }

    return canvas.toDataURL('image/png');
  }

  // Auto-size: fit both images to the same height
  const fW = frontImg?.width ?? 0;
  const fH = frontImg?.height ?? 0;
  const bW = backImg?.width ?? 0;
  const bH = backImg?.height ?? 0;

  const maxH = Math.max(fH, bH);
  const fScale = maxH / (fH || 1);
  const bScale = maxH / (bH || 1);
  const scaledFW = Math.round(fW * fScale);
  const scaledBW = Math.round(bW * bScale);

  const hasBoth = frontImg && backImg;
  const canvasW = (frontImg ? scaledFW : 0) + (backImg ? scaledBW : 0) + (hasBoth ? gap : 0);
  const canvasH = maxH;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);

  let xOffset = 0;
  if (frontImg) {
    ctx.drawImage(frontImg, 0, 0, scaledFW, maxH);
    xOffset = scaledFW + gap;
  }
  if (backImg) {
    ctx.drawImage(backImg, xOffset, 0, scaledBW, maxH);
  }

  return canvas.toDataURL('image/png');
};

// Resize a single image to custom dimensions
export const resizeImage = async (
  src: string,
  width: number,
  height: number
): Promise<string> => {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/png');
};

export const getFilterStyle = (filters: FilterSettings) => ({
  filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) grayscale(${filters.grayscale}%)`,
  transform: `rotate(${filters.rotation}deg)`,
});
