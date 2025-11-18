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

    // Load watermark settings from database
    const { data: settings, error: settingsError } = await supabase
      .from("watermark_settings")
      .select("*")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .single();

    if (settingsError) {
      console.error("Error loading watermark settings:", settingsError);
      // Use default settings if load fails
    }

    const watermarkConfig = settings || {
      positions: [
        { type: "top-right", enabled: true },
        { type: "top-left", enabled: false },
        { type: "bottom-right", enabled: true },
        { type: "bottom-left", enabled: true },
        { type: "center", enabled: true }
      ],
      font_size: 10,
      opacity: 0.4,
      center_rotation: 45
    };

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

      // Get settings from config
      const visibleFontSize = watermarkConfig.font_size;
      const visibleOpacity = watermarkConfig.opacity;
      const centerFontSize = visibleFontSize * 2;
      const hiddenFontSize = 24;

      for (const page of pages) {
        const { width, height } = page.getSize();
        const smallTextWidth = font.widthOfTextAtSize(fullWatermarkText, visibleFontSize);
        const centerTextWidth = font.widthOfTextAtSize(fullWatermarkText, centerFontSize);
        const hiddenTextWidth = font.widthOfTextAtSize(emailPrefix, hiddenFontSize);

        // Calculate positions based on enabled settings
        const positions = watermarkConfig.positions || [];
        
        positions.forEach((pos: any) => {
          if (!pos.enabled) return;

          let x = 0, y = 0;
          let size = visibleFontSize;
          let rotation = 0;

          switch (pos.type) {
            case "top-right":
              x = width - smallTextWidth - 15;
              y = height - 20;
              break;
            case "top-left":
              x = 15;
              y = height - 20;
              break;
            case "bottom-right":
              x = width - smallTextWidth - 15;
              y = 15;
              break;
            case "bottom-left":
              x = 15;
              y = 15;
              break;
            case "center":
              x = (width / 2) - (centerTextWidth / 2);
              y = (height / 2) - 80;
              size = centerFontSize;
              rotation = watermarkConfig.center_rotation || 45;
              break;
          }

          // Draw visible watermark with multiple layers for better visibility
          const baseColor = 0.5;
          page.drawText(fullWatermarkText, { 
            x, y, size, font, 
            color: rgb(0.9, 0.9, 0.9), 
            opacity: visibleOpacity * 0.1, 
            rotate: rotation ? degrees(rotation) : undefined 
          });
          page.drawText(fullWatermarkText, { 
            x, y, size, font, 
            color: rgb(0.7, 0.7, 0.7), 
            opacity: visibleOpacity * 0.4, 
            rotate: rotation ? degrees(rotation) : undefined 
          });
          page.drawText(fullWatermarkText, { 
            x, y, size, font, 
            color: rgb(baseColor, baseColor, baseColor), 
            opacity: visibleOpacity, 
            rotate: rotation ? degrees(rotation) : undefined 
          });
        });

        // Hidden forensic watermarks (always present, independent of visible settings)
        const centerX = (width / 2) - (centerTextWidth / 2);
        const centerY = (height / 2) - 80;
        page.drawText(fullWatermarkText, { x: centerX + 5, y: centerY + 5, size: centerFontSize - 2, font, color: rgb(0.98,0.98,0.98), opacity: 0.02, rotate: degrees(30) });
        page.drawText(fullWatermarkText, { x: centerX - 5, y: centerY - 5, size: centerFontSize - 2, font, color: rgb(0.98,0.98,0.98), opacity: 0.02, rotate: degrees(60) });

        // Hidden watermarks in organized rows across the entire page
        const numRows = 15; // Number of rows across the page
        const repeatsPerRow = Math.floor(width / (hiddenTextWidth + 10)); // How many times the email fits per row
        
        for (let row = 0; row < numRows; row++) {
          const y = height * ((row + 1) / (numRows + 1));
          
          // Draw the email multiple times in each row
          for (let col = 0; col < repeatsPerRow; col++) {
            const x = col * (hiddenTextWidth + 10) + 10;
            page.drawText(emailPrefix, { 
              x: x, 
              y: y, 
              size: hiddenFontSize, 
              font, 
              color: rgb(0.92,0.92,0.92), 
              opacity: 0.12
            });
          }
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