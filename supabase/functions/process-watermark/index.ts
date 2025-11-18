import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, StandardFonts, degrees } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


interface WatermarkRequest {
  filePath: string;
  email: string;
  userId: string;
  fileName: string;
}

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

    // Helper to process a single file path and return processedId
    const processOne = async (path: string, displayName?: string) => {
      console.log("Processing watermark for:", { filePath: path, email, userId, fileName: displayName });

      // Download the original PDF
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("pdf-files")
        .download(path);

      if (downloadError) {
        throw new Error(`Failed to download file: ${downloadError.message}`);
      }

      // Load PDF
      const pdfBytes = await fileData.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Add metadata watermark (hidden but traceable)
      pdfDoc.setTitle(`Protected Document - ${userId}`);
      pdfDoc.setAuthor(email);
      pdfDoc.setSubject(`User: ${userId} | Email: ${email}`);
      pdfDoc.setKeywords([email, userId, 'protected', 'watermarked']);
      pdfDoc.setProducer(`David's PDF System - User: ${userId}`);
      pdfDoc.setCreator(`Watermarked for ${email}`);

      // Add watermark to each page
      const pages = pdfDoc.getPages();
      const fullWatermarkText = `${email} | ID: ${userId}`;
      const emailPrefix = email.split('@')[0]; // Extract email prefix only

      for (const page of pages) {
        const { width, height } = page.getSize();
        const smallFontSize = 10;
        const centerFontSize = 20;
        const hiddenFontSize = 8;
        const smallTextWidth = font.widthOfTextAtSize(fullWatermarkText, smallFontSize);
        const centerTextWidth = font.widthOfTextAtSize(fullWatermarkText, centerFontSize);

        const topX = width - smallTextWidth - 15;
        const topY = height - 20;
        const bottomX = 15;
        const bottomY = 15;
        const centerX = (width / 2) - (centerTextWidth / 2);
        const centerY = (height / 2) - 80; // Lowered by 50 pixels

        // Top watermark - multiple layers
        page.drawText(fullWatermarkText, { x: topX, y: topY, size: smallFontSize, font, color: rgb(0.9,0.9,0.9), opacity: 0.05 });
        page.drawText(fullWatermarkText, { x: topX, y: topY, size: smallFontSize, font, color: rgb(0.7,0.7,0.7), opacity: 0.15 });
        page.drawText(fullWatermarkText, { x: topX, y: topY, size: smallFontSize, font, color: rgb(0.5,0.5,0.5), opacity: 0.4 });

        // Bottom watermark - multiple layers
        page.drawText(fullWatermarkText, { x: bottomX, y: bottomY, size: smallFontSize, font, color: rgb(0.9,0.9,0.9), opacity: 0.05 });
        page.drawText(fullWatermarkText, { x: bottomX, y: bottomY, size: smallFontSize, font, color: rgb(0.7,0.7,0.7), opacity: 0.15 });
        page.drawText(fullWatermarkText, { x: bottomX, y: bottomY, size: smallFontSize, font, color: rgb(0.5,0.5,0.5), opacity: 0.4 });

        // Center watermark - diagonal with multiple layers
        page.drawText(fullWatermarkText, { x: centerX, y: centerY, size: centerFontSize, font, color: rgb(0.95,0.95,0.95), opacity: 0.03, rotate: degrees(45) });
        page.drawText(fullWatermarkText, { x: centerX, y: centerY, size: centerFontSize, font, color: rgb(0.8,0.8,0.8), opacity: 0.08, rotate: degrees(45) });
        page.drawText(fullWatermarkText, { x: centerX, y: centerY, size: centerFontSize, font, color: rgb(0.6,0.6,0.6), opacity: 0.18, rotate: degrees(45) });

        // Hidden forensic watermarks with email prefix only
        page.drawText(fullWatermarkText, { x: centerX + 5, y: centerY + 5, size: centerFontSize - 2, font, color: rgb(0.98,0.98,0.98), opacity: 0.02, rotate: degrees(30) });
        page.drawText(fullWatermarkText, { x: centerX - 5, y: centerY - 5, size: centerFontSize - 2, font, color: rgb(0.98,0.98,0.98), opacity: 0.02, rotate: degrees(60) });

        // Scattered hidden watermarks with email prefix only - spread across the page
        // More positions for better coverage
        const positions = [
          { x: width * 0.15, y: height * 0.25, angle: 15 },
          { x: width * 0.85, y: height * 0.75, angle: -15 },
          { x: width * 0.25, y: height * 0.65, angle: 25 },
          { x: width * 0.75, y: height * 0.35, angle: -25 },
          { x: width * 0.35, y: height * 0.85, angle: 35 },
          { x: width * 0.65, y: height * 0.15, angle: -35 },
          { x: width * 0.45, y: height * 0.55, angle: 20 },
          { x: width * 0.55, y: height * 0.45, angle: -20 },
          { x: width * 0.20, y: height * 0.90, angle: 10 },
          { x: width * 0.80, y: height * 0.10, angle: -10 },
          { x: width * 0.10, y: height * 0.50, angle: 40 },
          { x: width * 0.90, y: height * 0.50, angle: -40 },
          { x: width * 0.30, y: height * 0.30, angle: 50 },
          { x: width * 0.70, y: height * 0.70, angle: -50 },
          { x: width * 0.40, y: height * 0.20, angle: 30 },
          { x: width * 0.60, y: height * 0.80, angle: -30 },
          { x: width * 0.12, y: height * 0.40, angle: 18 },
          { x: width * 0.88, y: height * 0.60, angle: -18 },
          { x: width * 0.22, y: height * 0.55, angle: 22 },
          { x: width * 0.78, y: height * 0.45, angle: -22 },
          { x: width * 0.32, y: height * 0.72, angle: 28 },
          { x: width * 0.68, y: height * 0.28, angle: -28 },
          { x: width * 0.42, y: height * 0.38, angle: 32 },
          { x: width * 0.58, y: height * 0.62, angle: -32 },
          { x: width * 0.18, y: height * 0.78, angle: 12 },
          { x: width * 0.82, y: height * 0.22, angle: -12 },
          { x: width * 0.28, y: height * 0.48, angle: 38 },
          { x: width * 0.72, y: height * 0.52, angle: -38 },
          { x: width * 0.38, y: height * 0.68, angle: 42 },
          { x: width * 0.62, y: height * 0.32, angle: -42 },
          { x: width * 0.48, y: height * 0.82, angle: 16 },
          { x: width * 0.52, y: height * 0.18, angle: -16 },
        ];

        for (const pos of positions) {
          // Detectable watermarks with subtle tone shifts - higher opacity for AI detection
          // Use slight color variations to create detectable patterns
          page.drawText(emailPrefix, { x: pos.x, y: pos.y, size: hiddenFontSize, font, color: rgb(0.96,0.96,0.96), opacity: 0.04, rotate: degrees(pos.angle) });
          page.drawText(emailPrefix, { x: pos.x + 2, y: pos.y + 2, size: hiddenFontSize, font, color: rgb(0.94,0.94,0.95), opacity: 0.05, rotate: degrees(pos.angle + 5) });
          page.drawText(emailPrefix, { x: pos.x - 2, y: pos.y - 2, size: hiddenFontSize, font, color: rgb(0.95,0.95,0.94), opacity: 0.06, rotate: degrees(pos.angle - 5) });
          // Additional layer with different tone for better AI detection
          page.drawText(emailPrefix, { x: pos.x + 1, y: pos.y + 1, size: hiddenFontSize, font, color: rgb(0.93,0.94,0.94), opacity: 0.05, rotate: degrees(pos.angle + 10) });
          page.drawText(emailPrefix, { x: pos.x - 1, y: pos.y - 1, size: hiddenFontSize, font, color: rgb(0.94,0.93,0.94), opacity: 0.05, rotate: degrees(pos.angle - 10) });
        }
      }

      // Determine safe output name
      const orig = displayName || (path.split('/').pop() || 'document.pdf');
      const safeOriginal = sanitizeFileName(orig);
      const base = safeOriginal.replace(/\.pdf$/i, '');
      const processedFileName = `${base}_${userId}.pdf`;

      // Upload processed file
      const processedPath = `processed/${processedFileName}`;
      const processedPdfBytes = await pdfDoc.save();
      const { error: uploadError } = await supabase.storage
        .from("pdf-files")
        .upload(processedPath, processedPdfBytes, { contentType: "application/pdf", upsert: true });
      if (uploadError) {
        throw new Error(`Failed to upload processed file: ${uploadError.message}`);
      }

      return processedPath;
    };

    let filesOut: { originalId?: string; processedId: string }[] = [];

    if (Array.isArray(body.fileIds)) {
      for (const fp of body.fileIds as string[]) {
        try {
          const processedId = await processOne(fp);
          filesOut.push({ originalId: fp, processedId });
        } catch (err) {
          console.error('Error processing file', fp, err);
        }
      }
    } else if (body.filePath) {
      const processedId = await processOne(body.filePath, body.fileName);
      filesOut.push({ processedId });
    } else {
      return new Response(JSON.stringify({ error: 'No files provided' }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }

    return new Response(JSON.stringify({ success: true, files: filesOut }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in process-watermark:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});