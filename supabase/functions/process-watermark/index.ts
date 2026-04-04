import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, StandardFonts, degrees } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sanitize file names for storage keys (ASCII-only, safe characters)
function sanitizeFileName(name: string) {
  const extMatch = name.match(/\.([A-Za-z0-9]+)$/);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '.pdf';
  const base = name.replace(/\.[^/.]+$/, "");

  const safeBase = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1f\s]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!safeBase) {
    const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    return `file-${unique}${ext}`;
  }
  return `${safeBase}${ext}`;
}

// ── Font cache (module-level, survives across warm invocations) ──
let cachedFontBytes: { regular: Uint8Array; bold: Uint8Array } | null = null;

async function loadHebrewFontBytes(): Promise<{ regular: Uint8Array; bold: Uint8Array } | null> {
  if (cachedFontBytes) {
    console.log("Using cached Hebrew font bytes");
    return cachedFontBytes;
  }

  const fontSources = [
    {
      regular: "https://fonts.cdnfonts.com/s/19158/Rubik-Regular.ttf",
      bold: "https://fonts.cdnfonts.com/s/19158/Rubik-Bold.ttf"
    },
    {
      regular: "https://raw.githubusercontent.com/nicola02nb/FullFont-HeeboFont/main/Heebo-Regular.ttf",
      bold: "https://raw.githubusercontent.com/nicola02nb/FullFont-HeeboFont/main/Heebo-Bold.ttf"
    },
    {
      regular: "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansHebrew/NotoSansHebrew-Regular.ttf",
      bold: "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansHebrew/NotoSansHebrew-Bold.ttf"
    }
  ];

  for (const source of fontSources) {
    try {
      console.log("Trying to load Hebrew fonts from:", source.regular);
      const [regularRes, boldRes] = await Promise.all([
        fetch(source.regular, { headers: { 'Accept': '*/*' } }),
        fetch(source.bold, { headers: { 'Accept': '*/*' } })
      ]);

      if (regularRes.ok && boldRes.ok) {
        const regularBytes = new Uint8Array(await regularRes.arrayBuffer());
        const boldBytes = new Uint8Array(await boldRes.arrayBuffer());

        if (regularBytes.length > 5000 && boldBytes.length > 5000) {
          cachedFontBytes = { regular: regularBytes, bold: boldBytes };
          console.log("Hebrew font bytes cached successfully");
          return cachedFontBytes;
        }
      }
    } catch (fontError) {
      console.error("Error loading fonts from source:", fontError);
    }
  }

  console.warn("All Hebrew font sources failed");
  return null;
}

// ── Text helpers ──

const isHebrew = (char: string) => /[\u0590-\u05FF]/.test(char);

function splitMixedText(text: string): Array<{ text: string; isHebrew: boolean }> {
  const segments: Array<{ text: string; isHebrew: boolean }> = [];
  let currentSegment = '';
  let currentIsHebrew = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const charIsHebrew = isHebrew(char);

    if (i === 0) {
      currentIsHebrew = charIsHebrew;
      currentSegment = char;
    } else if (charIsHebrew === currentIsHebrew) {
      currentSegment += char;
    } else {
      if (currentSegment) segments.push({ text: currentSegment, isHebrew: currentIsHebrew });
      currentSegment = char;
      currentIsHebrew = charIsHebrew;
    }
  }
  if (currentSegment) segments.push({ text: currentSegment, isHebrew: currentIsHebrew });
  return segments;
}

// ── Fonts context for a single PDF ──
interface FontsCtx {
  font: any;
  boldFont: any;
  hebrewFont: any | null;
  hebrewBoldFont: any | null;
  fontsLoaded: boolean;
}

function drawMixedText(page: any, text: string, x: number, y: number, fontSize: number, useBold: boolean, color: any, ctx: FontsCtx) {
  if (!ctx.fontsLoaded) {
    page.drawText(text, { x, y, size: fontSize, font: useBold ? ctx.boldFont : ctx.font, color });
    return;
  }

  const segments = splitMixedText(text);
  const segmentWidths: number[] = [];
  for (const segment of segments) {
    const f = segment.isHebrew ? (useBold ? ctx.hebrewBoldFont : ctx.hebrewFont) : (useBold ? ctx.boldFont : ctx.font);
    try { segmentWidths.push(f.widthOfTextAtSize(segment.text, fontSize)); } catch { segmentWidths.push(fontSize * segment.text.length * 0.5); }
  }

  let currentX = x;
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];
    const f = segment.isHebrew ? (useBold ? ctx.hebrewBoldFont : ctx.hebrewFont) : (useBold ? ctx.boldFont : ctx.font);
    try {
      page.drawText(segment.text, { x: currentX, y, size: fontSize, font: f, color });
      currentX += segmentWidths[i];
    } catch {
      page.drawText(segment.text, { x: currentX, y, size: fontSize, font: useBold ? ctx.boldFont : ctx.font, color });
      currentX += fontSize * segment.text.length * 0.5;
    }
  }
}

function getMixedTextWidth(text: string, fontSize: number, useBold: boolean, ctx: FontsCtx): number {
  if (!ctx.fontsLoaded) {
    try { return (useBold ? ctx.boldFont : ctx.font).widthOfTextAtSize(text, fontSize); } catch { return fontSize * text.length * 0.5; }
  }
  const segments = splitMixedText(text);
  let total = 0;
  for (const segment of segments) {
    const f = segment.isHebrew ? (useBold ? ctx.hebrewBoldFont : ctx.hebrewFont) : (useBold ? ctx.boldFont : ctx.font);
    try { total += f.widthOfTextAtSize(segment.text, fontSize); } catch { total += fontSize * segment.text.length * 0.5; }
  }
  return total;
}

function getHebrewLabelWidth(hebrewText: string, symbol: string, fontSize: number, useBold: boolean, ctx: FontsCtx): number {
  if (!ctx.fontsLoaded) {
    try { return (useBold ? ctx.boldFont : ctx.font).widthOfTextAtSize(symbol + hebrewText, fontSize); } catch { return fontSize * (symbol.length + hebrewText.length) * 0.5; }
  }
  const hf = useBold ? ctx.hebrewBoldFont : ctx.hebrewFont;
  const sf = useBold ? ctx.boldFont : ctx.font;
  let hw = 0, sw = 0;
  try { hw = hf.widthOfTextAtSize(hebrewText, fontSize); sw = sf.widthOfTextAtSize(symbol, fontSize); } catch { hw = fontSize * hebrewText.length * 0.5; sw = fontSize * symbol.length * 0.3; }
  return hw + sw;
}

function drawHebrewLabelRTL(page: any, hebrewText: string, symbol: string, rightX: number, y: number, fontSize: number, useBold: boolean, color: any, ctx: FontsCtx) {
  if (!ctx.fontsLoaded) {
    const fullText = symbol + hebrewText;
    const f = useBold ? ctx.boldFont : ctx.font;
    let tw = 0;
    try { tw = f.widthOfTextAtSize(fullText, fontSize); } catch { tw = fontSize * fullText.length * 0.5; }
    page.drawText(fullText, { x: rightX - tw, y, size: fontSize, font: f, color });
    return;
  }
  const hf = useBold ? ctx.hebrewBoldFont : ctx.hebrewFont;
  const sf = useBold ? ctx.boldFont : ctx.font;
  let hw = 0, sw = 0;
  try { hw = hf.widthOfTextAtSize(hebrewText, fontSize); sw = sf.widthOfTextAtSize(symbol, fontSize); } catch { hw = fontSize * hebrewText.length * 0.5; sw = fontSize * symbol.length * 0.3; }
  const startX = rightX - hw - sw;
  page.drawText(symbol, { x: startX, y, size: fontSize, font: sf, color });
  page.drawText(hebrewText, { x: startX + sw, y, size: fontSize, font: hf, color });
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: any = await req.json();
    const email: string = body.email;
    const userId: string = body.userId;

    // ── Load settings + fonts in parallel ──
    const [settingsResult, fontBytes] = await Promise.all([
      supabase.from("watermark_settings").select("*").eq("id", "00000000-0000-0000-0000-000000000001").single(),
      loadHebrewFontBytes(),
    ]);

    if (settingsResult.error) console.error("Error loading watermark settings:", settingsResult.error);

    const watermarkConfig = settingsResult.data || {
      positions: [
        { type: "top-right", enabled: true },
        { type: "top-left", enabled: false },
        { type: "bottom-right", enabled: true },
        { type: "bottom-left", enabled: true },
        { type: "center", enabled: true }
      ],
      font_size: 10,
      opacity: 0.4,
      center_rotation: 45,
      hidden_watermark_enabled: true,
      hidden_watermark_font_size: 24,
      hidden_watermark_opacity: 0.12,
      hidden_watermark_row_spacing: 15,
      hidden_watermark_col_spacing: 10,
      cover_email_label: "אימייל",
      cover_id_label: "תעודת זהות",
      cover_success_text: "בהצלחה!"
    };

    // ── Resolve file paths and display names ──
    let filePaths: string[] = [];
    let singleFilePath: string | null = null;
    let singleFileName: string | undefined = body.fileName;

    if (Array.isArray(body.fileIds)) {
      filePaths = body.fileIds as string[];
    } else if (body.filePath) {
      singleFilePath = body.filePath;
    } else {
      return new Response(JSON.stringify({ error: 'No files provided' }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }

    // Batch-fetch template names for all file paths at once
    const allPaths = singleFilePath ? [singleFilePath] : filePaths;
    const { data: allTemplates } = await supabase
      .from('pdf_templates')
      .select('name, file_path')
      .in('file_path', allPaths);

    const templateNameMap = new Map<string, string>();
    (allTemplates || []).forEach((t: any) => { templateNameMap.set(t.file_path, t.name); });

    // ── Process a single file ──
    const processOne = async (path: string, displayName?: string) => {
      console.log("Processing watermark for:", { filePath: path, email, userId, fileName: displayName });

      const { data: fileData, error: downloadError } = await supabase.storage
        .from("pdf-files")
        .download(path);

      if (downloadError) throw new Error(`Failed to download file: ${downloadError.message}`);

      const pdfBytes = await fileData.arrayBuffer();
      const originalPdf = await PDFDocument.load(pdfBytes);
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);

      // Embed fonts (from cached bytes — no network call)
      let hebrewFont: any = null;
      let hebrewBoldFont: any = null;
      let fontsLoaded = false;

      if (fontBytes) {
        try {
          hebrewFont = await pdfDoc.embedFont(fontBytes.regular);
          hebrewBoldFont = await pdfDoc.embedFont(fontBytes.bold);
          fontsLoaded = true;
        } catch (e) {
          console.error("Error embedding cached fonts:", e);
        }
      }

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const ctx: FontsCtx = { font, boldFont, hebrewFont, hebrewBoldFont, fontsLoaded };

      // Metadata
      pdfDoc.setTitle(`Protected Document - ${userId}`);
      pdfDoc.setAuthor(email);
      pdfDoc.setSubject(`User: ${userId} | Email: ${email}`);
      pdfDoc.setKeywords([email, userId, 'protected', 'watermarked']);
      pdfDoc.setProducer(`David's PDF System - User: ${userId}`);
      pdfDoc.setCreator(`Watermarked for ${email}`);

      const originalFileName = displayName || (path.split('/').pop() || 'document.pdf');
      const fileNameWithoutExt = originalFileName.replace(/\.pdf$/i, '');

      // ── Cover page ──
      const coverPage = pdfDoc.addPage([595, 842]);
      const { width: coverWidth, height: coverHeight } = coverPage.getSize();

      coverPage.drawRectangle({ x: 0, y: coverHeight * 0.6, width: coverWidth, height: coverHeight * 0.4, color: rgb(0.97, 0.97, 0.98) });

      const titleText = fileNameWithoutExt;
      const titleFontSize = 28;
      const titleWidth = getMixedTextWidth(titleText, titleFontSize, true, ctx);

      try {
        drawMixedText(coverPage, titleText, (coverWidth - titleWidth) / 2, coverHeight * 0.7, titleFontSize, true, rgb(0.2, 0.2, 0.3), ctx);
      } catch {
        const fallbackTitle = "Document";
        const fallbackWidth = boldFont.widthOfTextAtSize(fallbackTitle, titleFontSize);
        coverPage.drawText(fallbackTitle, { x: (coverWidth - fallbackWidth) / 2, y: coverHeight * 0.7, size: titleFontSize, font: boldFont, color: rgb(0.2, 0.2, 0.3) });
      }

      coverPage.drawLine({ start: { x: coverWidth * 0.3, y: coverHeight * 0.68 }, end: { x: coverWidth * 0.7, y: coverHeight * 0.68 }, thickness: 2, color: rgb(0.3, 0.4, 0.6) });

      const detailsFontSize = 16;
      const detailsY = coverHeight * 0.5;
      const detailsLineHeight = 35;

      if (fontsLoaded) {
        try {
          const emailLabelText = watermarkConfig.cover_email_label || "אימייל";
          const idLabelText = watermarkConfig.cover_id_label || "תעודת זהות";
          const successText = watermarkConfig.cover_success_text || "בהצלחה!";
          const rightEdge = coverWidth * 0.85;

          const emailLabelWidth = getHebrewLabelWidth(emailLabelText, ":", detailsFontSize, true, ctx);
          drawHebrewLabelRTL(coverPage, emailLabelText, ":", rightEdge, detailsY, detailsFontSize, true, rgb(0.3, 0.3, 0.4), ctx);
          const emailWidth = font.widthOfTextAtSize(email, detailsFontSize);
          coverPage.drawText(email, { x: rightEdge - emailLabelWidth - 15 - emailWidth, y: detailsY, size: detailsFontSize, font, color: rgb(0.4, 0.4, 0.5) });

          const idLabelWidth = getHebrewLabelWidth(idLabelText, ":", detailsFontSize, true, ctx);
          drawHebrewLabelRTL(coverPage, idLabelText, ":", rightEdge, detailsY - detailsLineHeight, detailsFontSize, true, rgb(0.3, 0.3, 0.4), ctx);
          const idWidth = font.widthOfTextAtSize(userId, detailsFontSize);
          coverPage.drawText(userId, { x: rightEdge - idLabelWidth - 15 - idWidth, y: detailsY - detailsLineHeight, size: detailsFontSize, font, color: rgb(0.4, 0.4, 0.5) });

          const successFontSize = 24;
          const successWidth = getMixedTextWidth(successText, successFontSize, true, ctx);
          drawMixedText(coverPage, successText, (coverWidth - successWidth) / 2, coverHeight * 0.15, successFontSize, true, rgb(0.3, 0.5, 0.7), ctx);
        } catch {
          drawEnglishLabels(coverPage, coverWidth, detailsFontSize, detailsY, detailsLineHeight, email, userId, boldFont, font);
        }
      } else {
        drawEnglishLabels(coverPage, coverWidth, detailsFontSize, detailsY, detailsLineHeight, email, userId, boldFont, font);
      }

      // Decorative dots
      coverPage.drawCircle({ x: coverWidth * 0.25, y: coverHeight * 0.15, size: 4, color: rgb(0.3, 0.5, 0.7) });
      coverPage.drawCircle({ x: coverWidth * 0.75, y: coverHeight * 0.15, size: 4, color: rgb(0.3, 0.5, 0.7) });

      // ── Watermark all pages ──
      const copiedPages = await pdfDoc.copyPages(originalPdf, originalPdf.getPageIndices());
      const fullWatermarkText = `${email} | ID: ${userId}`;
      const emailPrefix = email.split('@')[0];

      const visibleFontSize = watermarkConfig.font_size;
      const visibleOpacity = watermarkConfig.opacity;
      const centerFontSize = visibleFontSize * 2;
      const hiddenFontSize = watermarkConfig.hidden_watermark_font_size || 24;
      const hiddenOpacity = watermarkConfig.hidden_watermark_opacity || 0.12;
      const hiddenRowSpacing = watermarkConfig.hidden_watermark_row_spacing || 15;
      const hiddenColSpacing = watermarkConfig.hidden_watermark_col_spacing || 10;
      const hiddenEnabled = watermarkConfig.hidden_watermark_enabled !== false;

      for (const page of copiedPages) {
        pdfDoc.addPage(page);
        const { width, height } = page.getSize();
        const smallTextWidth = font.widthOfTextAtSize(fullWatermarkText, visibleFontSize);
        const centerTextWidth = font.widthOfTextAtSize(fullWatermarkText, centerFontSize);
        const hiddenTextWidth = font.widthOfTextAtSize(emailPrefix, hiddenFontSize);

        const positions = watermarkConfig.positions || [];
        positions.forEach((pos: any) => {
          if (!pos.enabled) return;
          let x = 0, y = 0, size = visibleFontSize, rotation = 0;

          switch (pos.type) {
            case "top-right": x = width - smallTextWidth - 15; y = height - 20; break;
            case "top-left": x = 15; y = height - 20; break;
            case "bottom-right": x = width - smallTextWidth - 15; y = 15; break;
            case "bottom-left": x = 15; y = 15; break;
            case "center":
              x = (width / 2) - (centerTextWidth / 2);
              y = (height / 2) - 80;
              size = centerFontSize;
              rotation = watermarkConfig.center_rotation || 45;
              break;
          }

          page.drawText(fullWatermarkText, { x, y, size, font, color: rgb(0.9, 0.9, 0.9), opacity: visibleOpacity * 0.1, rotate: rotation ? degrees(rotation) : undefined });
          page.drawText(fullWatermarkText, { x, y, size, font, color: rgb(0.7, 0.7, 0.7), opacity: visibleOpacity * 0.4, rotate: rotation ? degrees(rotation) : undefined });
          page.drawText(fullWatermarkText, { x, y, size, font, color: rgb(0.5, 0.5, 0.5), opacity: visibleOpacity, rotate: rotation ? degrees(rotation) : undefined });
        });

        if (hiddenEnabled) {
          const centerX = (width / 2) - (centerTextWidth / 2);
          const centerY = (height / 2) - 80;
          page.drawText(fullWatermarkText, { x: centerX + 5, y: centerY + 5, size: centerFontSize - 2, font, color: rgb(0.98, 0.98, 0.98), opacity: 0.02, rotate: degrees(30) });
          page.drawText(fullWatermarkText, { x: centerX - 5, y: centerY - 5, size: centerFontSize - 2, font, color: rgb(0.98, 0.98, 0.98), opacity: 0.02, rotate: degrees(60) });

          const numRows = hiddenRowSpacing;
          const repeatsPerRow = Math.floor(width / (hiddenTextWidth + hiddenColSpacing));
          for (let row = 0; row < numRows; row++) {
            const hy = height * ((row + 1) / (numRows + 1));
            for (let col = 0; col < repeatsPerRow; col++) {
              const hx = col * (hiddenTextWidth + hiddenColSpacing) + 10;
              page.drawText(emailPrefix, { x: hx, y: hy, size: hiddenFontSize, font, color: rgb(0.92, 0.92, 0.92), opacity: hiddenOpacity });
            }
          }
        }
      }

      // ── Save & upload ──
      const orig = displayName || (path.split('/').pop() || 'document.pdf');
      const safeOriginal = sanitizeFileName(orig);
      const base = safeOriginal.replace(/\.pdf$/i, '');
      const processedFileName = `${base}_${userId}.pdf`;
      const processedPath = `processed/${processedFileName}`;

      const processedPdfBytes = await pdfDoc.save();
      const { error: uploadError } = await supabase.storage
        .from("pdf-files")
        .upload(processedPath, processedPdfBytes, { contentType: "application/pdf", upsert: true });
      if (uploadError) throw new Error(`Failed to upload processed file: ${uploadError.message}`);

      return processedPath;
    };

    // ── Execute ──
    let filesOut: { originalId?: string; processedId: string; originalName?: string }[] = [];

    if (filePaths.length > 0) {
      // Process files sequentially to avoid memory/timeout issues with large batches
      for (const fp of filePaths) {
        try {
          const displayName = templateNameMap.get(fp);
          const processedId = await processOne(fp, displayName);
          filesOut.push({ originalId: fp, processedId, originalName: displayName });
        } catch (err) {
          console.error('Error processing file:', fp, err);
        }
      }
    } else if (singleFilePath) {
      const displayName = singleFileName || templateNameMap.get(singleFilePath);
      const processedId = await processOne(singleFilePath, displayName);
      filesOut.push({ processedId, originalName: displayName });
    }

    return new Response(JSON.stringify({ success: true, files: filesOut }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in process-watermark:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// ── English fallback labels ──
function drawEnglishLabels(coverPage: any, coverWidth: number, detailsFontSize: number, detailsY: number, detailsLineHeight: number, email: string, userId: string, boldFont: any, font: any) {
  coverPage.drawText("Email:", { x: coverWidth * 0.25, y: detailsY, size: detailsFontSize, font: boldFont, color: rgb(0.3, 0.3, 0.4) });
  coverPage.drawText(email, { x: coverWidth * 0.40, y: detailsY, size: detailsFontSize, font, color: rgb(0.4, 0.4, 0.5) });
  coverPage.drawText("ID:", { x: coverWidth * 0.25, y: detailsY - detailsLineHeight, size: detailsFontSize, font: boldFont, color: rgb(0.3, 0.3, 0.4) });
  coverPage.drawText(userId, { x: coverWidth * 0.40, y: detailsY - detailsLineHeight, size: detailsFontSize, font, color: rgb(0.4, 0.4, 0.5) });
  const successText = "Good Luck!";
  const successFontSize = 24;
  const successWidth = boldFont.widthOfTextAtSize(successText, successFontSize);
  coverPage.drawText(successText, { x: (coverWidth - successWidth) / 2, y: 842 * 0.15, size: successFontSize, font: boldFont, color: rgb(0.3, 0.5, 0.7) });
}
