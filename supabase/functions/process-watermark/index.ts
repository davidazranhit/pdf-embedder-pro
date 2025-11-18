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
      position_settings: [
        { type: 'top-right', enabled: true, fontSize: 10, opacity: 0.4, rotation: 0 },
        { type: 'top-left', enabled: false, fontSize: 10, opacity: 0.4, rotation: 0 },
        { type: 'bottom-right', enabled: true, fontSize: 10, opacity: 0.4, rotation: 0 },
        { type: 'bottom-left', enabled: true, fontSize: 10, opacity: 0.4, rotation: 0 },
        { type: 'center', enabled: true, fontSize: 10, opacity: 0.4, rotation: 45 }
      ],
      hidden_watermark_enabled: true,
      hidden_watermark_font_size: 4,
      hidden_watermark_opacity: 0.02,
      hidden_watermark_row_spacing: 100,
      hidden_watermark_col_spacing: 150
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

      for (const page of pages) {
        const { width, height } = page.getSize();
        
        // Add visible watermarks based on position_settings
        const positionSettings = watermarkConfig.position_settings || [];
        
        for (const posSetting of positionSettings) {
          if (!posSetting.enabled) continue;

          const watermarkText = `Mail: ${email} | ID: ${userId}`;
          let x = 0, y = 0;
          const fontSize = posSetting.fontSize || 10;
          const opacity = posSetting.opacity || 0.4;
          const rotation = posSetting.rotation || 0;

          switch (posSetting.type) {
            case "top-right":
              x = width - 100;
              y = height - 20;
              break;
            case "top-left":
              x = 100;
              y = height - 20;
              break;
            case "bottom-right":
              x = width - 100;
              y = 20;
              break;
            case "bottom-left":
              x = 100;
              y = 20;
              break;
            case "center":
              x = width / 2;
              y = height / 2 + 50;
              break;
          }

          // Draw watermark with three layers for better visibility
          for (let layer = 0; layer < 3; layer++) {
            const layerOpacity = opacity * (1 - layer * 0.15);
            const grayValue = 0.9 - layer * 0.2;
            
            page.drawText(watermarkText, {
              x,
              y,
              size: fontSize,
              font,
              color: rgb(grayValue, grayValue, grayValue),
              opacity: layerOpacity,
              rotate: degrees(rotation),
            });
          }
        }

        // Add hidden forensic watermarks if enabled
        if (watermarkConfig.hidden_watermark_enabled !== false) {
          const hiddenText = emailPrefix;
          const hiddenFontSize = watermarkConfig.hidden_watermark_font_size || 4;
          const hiddenOpacity = watermarkConfig.hidden_watermark_opacity || 0.02;
          const rowSpacing = watermarkConfig.hidden_watermark_row_spacing || 100;
          const colSpacing = watermarkConfig.hidden_watermark_col_spacing || 150;
          
          for (let row = 0; row < Math.ceil(height / rowSpacing); row++) {
            for (let col = 0; col < Math.ceil(width / colSpacing); col++) {
              const hiddenX = col * colSpacing + 50;
              const hiddenY = row * rowSpacing + 50;
              
              if (hiddenX < width && hiddenY < height) {
                page.drawText(hiddenText, {
                  x: hiddenX,
                  y: hiddenY,
                  size: hiddenFontSize,
                  font,
                  color: rgb(0.5, 0.5, 0.5),
                  opacity: hiddenOpacity,
                });
              }
            }
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