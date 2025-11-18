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

        // Scattered hidden watermarks with email prefix only - evenly distributed across the entire page
        // Grid-based positioning to avoid overlap and ensure readability
        const positions = [];
        const gridRows = 8;
        const gridCols = 10;
        const angles = [15, -15, 25, -25, 20, -20, 18, -18];
        
        for (let row = 0; row < gridRows; row++) {
          for (let col = 0; col < gridCols; col++) {
            // Calculate position with some randomness to avoid perfect grid
            const baseX = (col + 0.5) / gridCols;
            const baseY = (row + 0.5) / gridRows;
            const offsetX = (Math.random() - 0.5) * 0.03; // Small random offset
            const offsetY = (Math.random() - 0.5) * 0.03;
            
            positions.push({
              x: width * (baseX + offsetX),
              y: height * (baseY + offsetY),
              angle: angles[(row + col) % angles.length]
            });
          }
        }

        for (const pos of positions) {
          // Single layer watermark to avoid overlap and maintain readability
          page.drawText(emailPrefix, { 
            x: pos.x, 
            y: pos.y, 
            size: hiddenFontSize, 
            font, 
            color: rgb(0.95,0.95,0.95), 
            opacity: 0.05, 
            rotate: degrees(pos.angle) 
          });
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