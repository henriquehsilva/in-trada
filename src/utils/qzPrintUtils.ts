import qz from 'qz-tray';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { buildQrValue } from './qrcode';
import type { ComponenteEditor, ModeloCracha } from '../models/types';

/* ===================== Printer type detection ===================== */

const THERMAL_KEYWORDS = [
  'zebra', 'eltron', 'dymo', 'tsc', 'honeywell', 'datamax', 'citizen',
  'sato', 'godex', 'argox', 'postek', 'gainscha', 'bixolon', 'star',
  'brother', 'ql-', 'td-', 'tz/', 'rd/', 'qtt',  // Brother QL/TD series
];
const RECEIPT_KEYWORDS = ['epson', 'bixolon', 'star', 'citizen', 'pos', 'receipt'];

export type PrinterCategory = 'thermal-label' | 'thermal-receipt' | 'laser' | 'inkjet' | 'unknown';

export function detectPrinterCategory(printerName: string): PrinterCategory {
  const lower = printerName.toLowerCase();
  const isThermal = THERMAL_KEYWORDS.some((kw) => lower.includes(kw));
  if (!isThermal) return 'unknown';
  const isReceipt = RECEIPT_KEYWORDS.some((kw) => lower.includes(kw));
  if (isReceipt) return 'thermal-receipt';
  return 'thermal-label';
}

/* ===================== Print config builder ===================== */

export interface PrintConfigOptions {
  printerName: string;
  larguraCm: number;
  alturaCm: number;
  rodado: boolean;
  isThermalLabel?: boolean;
}

export function buildPrintConfig(opts: PrintConfigOptions) {
  const { printerName, larguraCm, alturaCm, rodado, isThermalLabel } = opts;
  const pageW = rodado ? alturaCm : larguraCm;
  const pageH = rodado ? larguraCm : alturaCm;

  const base: Record<string, any> = {
    size: { width: pageW, height: pageH },
    units: 'cm',
    rasterize: true,
    colorType: 'color',
    scaleContent: true,
  };

  if (isThermalLabel) {
    base.density = 8;
    base.orientation = 'portrait';
  }

  return qz.configs.create(printerName, base);
}

/* ===================== Canvas barcode (no CDN) ===================== */

export function renderBarcodeToCanvas(
  value: string,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  try {
    JsBarcode(canvas, String(value), {
      format: 'CODE128',
      width: 2,
      height: height || 40,
      displayValue: false,
      margin: 0,
    });
  } catch {
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
    }
  }
  return canvas;
}

export function barcodeToBase64(value: string, width: number, height: number): string {
  const canvas = renderBarcodeToCanvas(value, width, height);
  return canvas.toDataURL('image/png').split(',')[1];
}

/* ===================== HTML generation (non-rotated) ===================== */

const STD_FONTS = new Set([
  'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Tahoma',
  'Trebuchet MS', 'sans-serif', 'serif', 'monospace',
]);

function getUsedFontFamilies(componentes: ComponenteEditor[]): string[] {
  const set = new Set<string>();
  for (const c of componentes) {
    const fam = (c as any).propriedades?.estilos?.fonte;
    if (fam && typeof fam === 'string') set.add(fam);
  }
  return Array.from(set);
}

function buildFontFaceCSS(usedFamilies: string[]): string {
  const LS_KEY = 'editorCrachas.customFonts';
  const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}') as Record<string, string>;
  const faces: string[] = [];
  for (const fam of usedFamilies) {
    if (STD_FONTS.has(fam)) continue;
    const dataUrl = saved[fam];
    if (!dataUrl) continue;
    const fmt = dataUrl.includes('font/otf') || /\.otf/i.test(dataUrl) ? 'opentype' : 'truetype';
    faces.push(`
@font-face{
  font-family:'${fam}';
  src:url('${dataUrl}') format('${fmt}');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face{
  font-family:'${fam}';
  src:url('${dataUrl}') format('${fmt}');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}`);
  }
  return faces.join('\n');
}

export function buildPrintHTML(opts: {
  componentes: ComponenteEditor[];
  participante: Record<string, any>;
  qrCache: Record<string, string>;
  barcodeValue: string;
  pageLarguraPx: number;
  pageAlturaPx: number;
  larguraPx: number;
  alturaPx: number;
  rodado: boolean;
  barcodeBase64?: string;
}): string {
  const {
    componentes, participante, qrCache, barcodeValue,
    pageLarguraPx, pageAlturaPx, larguraPx, alturaPx, rodado, barcodeBase64,
  } = opts;

  const usedFamilies = getUsedFontFamilies(componentes);
  const fontFaceCSS = buildFontFaceCSS(usedFamilies);

  const htmlComponente = componentes
    .map((comp) => {
      const props: any = comp.propriedades || {};
      const estilos: any = props.estilos || {};
      const valor = props.campoVinculado
        ? (participante as any)[props.campoVinculado] ?? ''
        : (props.texto ?? '');

      const baseStyle = `
        position:absolute; top:${props.y}px; left:${props.x}px;
        width:${props.largura}px; height:${props.altura}px;
        display:flex; align-items:center; justify-content:center; overflow:hidden;
        ${estilos?.tamanhoFonte ? `font-size:${estilos.tamanhoFonte}px;` : ''}
        ${estilos?.negrito ? 'font-weight:700;' : 'font-weight:400;'}
        ${estilos?.alinhamento ? `text-align:${estilos.alinhamento};` : ''}
        ${estilos?.corFonte ? `color:${estilos.corFonte};` : ''}
        ${estilos?.corFundo ? `background-color:${estilos.corFundo};` : ''}
        ${estilos?.raio ? `border-radius:${estilos.raio}px;` : ''}
        line-height:1.1; white-space:pre-wrap;
        ${estilos?.fonte ? `font-family:'${String(estilos.fonte)}', ${STD_FONTS.has(estilos.fonte) ? estilos.fonte : 'sans-serif'};` : ''}
      `;

      if (comp.tipo === 'qrcode') {
        return `<div style="${baseStyle}"><img src="${qrCache[comp.id]}" width="${props.largura}" height="${props.altura}" /></div>`;
      }

      if (comp.tipo === 'barcode') {
        if (barcodeBase64) {
          return `<div style="${baseStyle}"><img src="data:image/png;base64,${barcodeBase64}" width="${props.largura}" height="${props.altura}" /></div>`;
        }
        return `<div style="${baseStyle}"><svg id="barcode-${comp.id}"
            jsbarcode-value="${String(barcodeValue)}"
            jsbarcode-format="CODE128"
            jsbarcode-width="2"
            jsbarcode-height="${props.altura || 40}"
            jsbarcode-displayvalue="false"></svg></div>`;
      }

      return `<div style="${baseStyle}">${valor}</div>`;
    })
    .join('');

  const barcodeScript = barcodeBase64
    ? ''
    : `<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>`;

  const barcodeInit = barcodeBase64
    ? ''
    : `if (typeof JsBarcode !== 'undefined') { JsBarcode("svg[id^='barcode-']").init(); }`;

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Imprimir Crachá</title>
    ${barcodeScript}
    <style>
      @page { size: ${pageLarguraPx}px ${pageAlturaPx}px; margin: 0; }
      html, body { margin: 0; padding: 0; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      ${fontFaceCSS}
    </style>
  </head>
  <body>
    <div id="page" style="position:relative; width:${pageLarguraPx}px; height:${pageAlturaPx}px; overflow:hidden;">
      <div id="root" style="position:absolute; top:0; left:0; width:${larguraPx}px; height:${alturaPx}px; ${rodado ? 'transform-origin: top left; transform: rotate(-90deg) translateX(-100%);' : ''}">
        ${htmlComponente}
      </div>
    </div>
    <script>
      (async function(){
        try {
          if (document.fonts && document.fonts.ready) { await document.fonts.ready; }
          await new Promise(r => setTimeout(r, 150));
          ${barcodeInit}
          await new Promise(r => setTimeout(r, 80));
          window.print();
          setTimeout(() => window.close(), 350);
        } catch(e) {
          console.error('print error', e);
          window.print();
          setTimeout(() => window.close(), 500);
        }
      })();
    </script>
  </body>
</html>`;
}

/* ===================== Canvas rendering (for rotated / pixel) ===================== */

async function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function registrarFonteCustomizadaSeNecessario(familia?: string) {
  if (!familia || STD_FONTS.has(familia)) return;
  const fontsSet = (document as any).fonts;
  if (fontsSet && Array.from(fontsSet).some((f: any) => f.family === familia)) return;
  try {
    const saved = JSON.parse(localStorage.getItem('editorCrachas.customFonts') || '{}') as Record<string, string>;
    const dataUrl = saved[familia];
    if (!dataUrl) return;
    const font = new FontFace(familia, `url(${dataUrl})`);
    await font.load();
    fontsSet.add(font);
  } catch {}
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, texto: string, maxWidth: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of String(texto).split('\n')) {
    const palavras = paragrafo.split(' ');
    let linhaAtual = '';
    for (const palavra of palavras) {
      const tentativa = linhaAtual ? `${linhaAtual} ${palavra}` : palavra;
      if (linhaAtual && ctx.measureText(tentativa).width > maxWidth) {
        linhas.push(linhaAtual);
        linhaAtual = palavra;
      } else {
        linhaAtual = tentativa;
      }
    }
    linhas.push(linhaAtual);
  }
  return linhas;
}

async function desenharComponenteNoCanvas(
  ctx: CanvasRenderingContext2D,
  comp: ComponenteEditor,
  valor: string,
  qrDataUrl: string | undefined,
  barcodeValue: string,
  barcodeBase64?: string,
) {
  const props: any = comp.propriedades || {};
  const estilos: any = props.estilos || {};
  const x = props.x || 0;
  const y = props.y || 0;
  const w = props.largura || 0;
  const h = props.altura || 0;

  if (estilos?.corFundo) {
    ctx.fillStyle = estilos.corFundo;
    const raio = estilos.raio || 0;
    if (raio && typeof (ctx as any).roundRect === 'function') {
      ctx.beginPath();
      (ctx as any).roundRect(x, y, w, h, raio);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, w, h);
    }
  }

  if (comp.tipo === 'qrcode') {
    if (qrDataUrl) {
      const img = await loadImageEl(qrDataUrl);
      ctx.drawImage(img, x, y, w, h);
    }
    return;
  }

  if (comp.tipo === 'barcode') {
    if (barcodeBase64) {
      const img = await loadImageEl(`data:image/png;base64,${barcodeBase64}`);
      ctx.drawImage(img, x, y, w, h);
    } else {
      const barcodeCanvas = renderBarcodeToCanvas(barcodeValue, w, h || 40);
      ctx.drawImage(barcodeCanvas, x, y, w, h);
    }
    return;
  }

  if (!valor) return;
  await registrarFonteCustomizadaSeNecessario(estilos?.fonte);
  const tamanhoFonte = estilos?.tamanhoFonte || 14;
  const peso = estilos?.negrito ? '700' : '400';
  const familia = estilos?.fonte
    ? `'${estilos.fonte}', ${STD_FONTS.has(estilos.fonte) ? estilos.fonte : 'sans-serif'}`
    : 'sans-serif';
  ctx.font = `${peso} ${tamanhoFonte}px ${familia}`;
  ctx.fillStyle = estilos?.corFonte || '#000000';
  const alinhamento: CanvasTextAlign = estilos?.alinhamento || 'left';
  ctx.textAlign = alinhamento;
  ctx.textBaseline = 'middle';

  const lineHeight = tamanhoFonte * 1.1;
  const linhas = wrapCanvasText(ctx, String(valor), w);
  const totalH = linhas.length * lineHeight;
  let linhaY = y + h / 2 - totalH / 2 + lineHeight / 2;
  const linhaX = alinhamento === 'center' ? x + w / 2 : alinhamento === 'right' ? x + w : x;
  for (const linha of linhas) {
    ctx.fillText(linha, linhaX, linhaY, w);
    linhaY += lineHeight;
  }
}

export async function renderBadgeToCanvas(
  componentes: ComponenteEditor[],
  larguraPx: number,
  alturaPx: number,
  participante: Record<string, any>,
  qrCache: Record<string, string>,
  barcodeValue: string,
  barcodeBase64?: string,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = larguraPx;
  canvas.height = alturaPx;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, larguraPx, alturaPx);

  for (const comp of componentes) {
    const props: any = comp.propriedades || {};
    const valor = props.campoVinculado ? (participante as any)[props.campoVinculado] ?? '' : (props.texto ?? '');
    await desenharComponenteNoCanvas(ctx, comp, String(valor ?? ''), qrCache[comp.id], barcodeValue, barcodeBase64);
  }
  return canvas;
}

export function rotateCanvas90CW(source: HTMLCanvasElement): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const dest = document.createElement('canvas');
  dest.width = h;
  dest.height = w;
  const ctx = dest.getContext('2d')!;
  ctx.translate(h, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(source, 0, 0, w, h);
  return dest;
}

/* ===================== QR pre-generation ===================== */

export async function preGenerateQRCodes(
  componentes: ComponenteEditor[],
  participante: Record<string, any>,
  barcodeValue: string,
): Promise<Record<string, string>> {
  const cache: Record<string, string> = {};
  for (const comp of componentes) {
    if (comp.tipo === 'qrcode') {
      const p: any = comp.propriedades || {};
      const qrValor = buildQrValue(participante, p.camposQrCode, p.separadorQrCode) || String(barcodeValue);
      cache[comp.id] = await QRCode.toDataURL(qrValor);
    }
  }
  return cache;
}

/* ===================== Unified print dispatch ===================== */

export interface PrintBadgeOptions {
  modelo: ModeloCracha;
  participante: Record<string, any>;
  printerName: string;
  qzConnected: boolean;
}

export async function printBadge(opts: PrintBadgeOptions): Promise<{ method: string }> {
  const { modelo, participante, printerName, qzConnected } = opts;

  const barcodeValue = (participante as any)?.codigoCliente || (participante as any)?.id || '';
  const qrCache = await preGenerateQRCodes(modelo.componentes, participante, barcodeValue);
  const barcodeBase64 = barcodeToBase64(barcodeValue, 200, 40);

  const larguraCm = modelo.larguraCm || 8;
  const alturaCm = modelo.alturaCm || 3;
  const cmToPx = (cm: number) => Math.round((cm / 2.54) * 203);
  const largura = cmToPx(larguraCm);
  const altura = cmToPx(alturaCm);

  const rodado = !!modelo.imprimirRodado;
  const pageLarguraPx = rodado ? altura : largura;
  const pageAlturaPx = rodado ? largura : altura;
  const pageLarguraCm = rodado ? alturaCm : larguraCm;
  const pageAlturaCm = rodado ? larguraCm : alturaCm;

  const category = detectPrinterCategory(printerName);
  const isThermalLabel = category === 'thermal-label';

  if (qzConnected && printerName) {
    const config = buildPrintConfig({
      printerName,
      larguraCm,
      alturaCm,
      rodado,
      isThermalLabel,
    });

    console.log('[QZ][print]', {
      printerName, category, rodado,
      larguraCm, alturaCm, pageLarguraCm, pageAlturaCm,
    });

    if (rodado) {
      const baseCanvas = await renderBadgeToCanvas(
        modelo.componentes, largura, altura, participante, qrCache, barcodeValue, barcodeBase64,
      );
      const rotatedCanvas = rotateCanvas90CW(baseCanvas);
      const base64 = rotatedCanvas.toDataURL('image/png').split(',')[1];
      await qz.print(config, [{ type: 'pixel', format: 'image', flavor: 'base64', data: base64 }]);
      return { method: 'canvas-rotated' };
    }

    const html = buildPrintHTML({
      componentes: modelo.componentes,
      participante,
      qrCache,
      barcodeValue,
      pageLarguraPx,
      pageAlturaPx,
      larguraPx: largura,
      alturaPx: altura,
      rodado: false,
      barcodeBase64,
    });

    await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
    return { method: 'html' };
  }

  // Fallback: browser print window
  const html = buildPrintHTML({
    componentes: modelo.componentes,
    participante,
    qrCache,
    barcodeValue,
    pageLarguraPx,
    pageAlturaPx,
    larguraPx: largura,
    alturaPx: altura,
    rodado: false,
    barcodeBase64,
  });
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) throw new Error('Não foi possível abrir janela de impressão');
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return { method: 'browser-window' };
}
