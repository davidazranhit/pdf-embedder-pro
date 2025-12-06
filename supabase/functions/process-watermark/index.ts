import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, StandardFonts, degrees } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

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
      center_rotation: 45,
      hidden_watermark_enabled: true,
      hidden_watermark_font_size: 24,
      hidden_watermark_opacity: 0.12,
      hidden_watermark_row_spacing: 15,
      hidden_watermark_col_spacing: 10
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

      // Load original PDF
      const pdfBytes = await fileData.arrayBuffer();
      const originalPdf = await PDFDocument.load(pdfBytes);
      
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();
      
      // Register fontkit for custom font embedding
      pdfDoc.registerFontkit(fontkit);
      
      // Load Hebrew-supporting font (Heebo from GitHub - direct TTF)
      // Using Heebo font which has excellent Hebrew support
      const hebrewFontUrl = "https://raw.githubusercontent.com/AzizStark/Snigdha-UI/main/src/assets/fonts/Heebo-Regular.ttf";
      const hebrewFontBoldUrl = "https://raw.githubusercontent.com/AzizStark/Snigdha-UI/main/src/assets/fonts/Heebo-Bold.ttf";
      
      let hebrewFont = null;
      let hebrewBoldFont = null;
      let fontsLoaded = false;
      
      try {
        console.log("Attempting to load Hebrew fonts...");
        const [fontResponse, boldFontResponse] = await Promise.all([
          fetch(hebrewFontUrl),
          fetch(hebrewFontBoldUrl)
        ]);
        
        if (fontResponse.ok && boldFontResponse.ok) {
          const fontBytes = await fontResponse.arrayBuffer();
          const boldFontBytes = await boldFontResponse.arrayBuffer();
          
          console.log("Font bytes received, regular:", fontBytes.byteLength, "bold:", boldFontBytes.byteLength);
          
          if (fontBytes.byteLength > 1000 && boldFontBytes.byteLength > 1000) {
            hebrewFont = await pdfDoc.embedFont(fontBytes);
            hebrewBoldFont = await pdfDoc.embedFont(boldFontBytes);
            fontsLoaded = true;
            console.log("Hebrew fonts loaded successfully!");
          } else {
            console.log("Font files too small, likely not valid TTF");
          }
        } else {
          console.log("Font fetch failed:", fontResponse.status, boldFontResponse.status);
        }
      } catch (fontError) {
        console.error("Failed to load Hebrew fonts:", fontError);
      }
      
      // Standard fonts for fallback and ASCII text
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Use Hebrew fonts if available, otherwise fallback to English-only cover page
      const coverTitleFont = hebrewBoldFont || boldFont;
      const coverTextFont = hebrewFont || font;
      const useHebrewLabels = fontsLoaded;

      // Add metadata watermark (hidden but traceable)
      pdfDoc.setTitle(`Protected Document - ${userId}`);
      pdfDoc.setAuthor(email);
      pdfDoc.setSubject(`User: ${userId} | Email: ${email}`);
      pdfDoc.setKeywords([email, userId, 'protected', 'watermarked']);
      pdfDoc.setProducer(`David's PDF System - User: ${userId}`);
      pdfDoc.setCreator(`Watermarked for ${email}`);

      // Get original file name for the cover page
      const originalFileName = displayName || (path.split('/').pop() || 'document.pdf');
      const fileNameWithoutExt = originalFileName.replace(/\.pdf$/i, '');

      // Create cover page (A4 size: 595 x 842 points)
      const coverPage = pdfDoc.addPage([595, 842]);
      const { width: coverWidth, height: coverHeight } = coverPage.getSize();

      // Draw elegant cover page
      // Background subtle gradient effect (using rectangles with different opacities)
      coverPage.drawRectangle({
        x: 0,
        y: coverHeight * 0.6,
        width: coverWidth,
        height: coverHeight * 0.4,
        color: rgb(0.97, 0.97, 0.98),
      });

      // Title section - Hebrew text support
      const titleText = fileNameWithoutExt;
      const titleFontSize = 28;
      
      // Only draw title if we can render it (Hebrew fonts loaded or ASCII-only)
      const hasHebrewChars = /[\u0590-\u05FF]/.test(titleText);
      const canRenderTitle = fontsLoaded || !hasHebrewChars;
      
      if (canRenderTitle) {
        let titleWidth = coverWidth * 0.6;
        try {
          titleWidth = coverTitleFont.widthOfTextAtSize(titleText, titleFontSize);
        } catch (e) {
          console.log("Could not calculate title width, using default positioning");
        }
        
        coverPage.drawText(titleText, {
          x: (coverWidth - titleWidth) / 2,
          y: coverHeight * 0.7,
          size: titleFontSize,
          font: coverTitleFont,
          color: rgb(0.2, 0.2, 0.3),
        });
      } else {
        // Fallback: show "Document" as title when Hebrew can't be rendered
        const fallbackTitle = "Document";
        const fallbackWidth = boldFont.widthOfTextAtSize(fallbackTitle, titleFontSize);
        coverPage.drawText(fallbackTitle, {
          x: (coverWidth - fallbackWidth) / 2,
          y: coverHeight * 0.7,
          size: titleFontSize,
          font: boldFont,
          color: rgb(0.2, 0.2, 0.3),
        });
      }

      // Decorative line under title
      coverPage.drawLine({
        start: { x: coverWidth * 0.3, y: coverHeight * 0.68 },
        end: { x: coverWidth * 0.7, y: coverHeight * 0.68 },
        thickness: 2,
        color: rgb(0.3, 0.4, 0.6),
      });

      // User details section
      const detailsFontSize = 16;
      const detailsY = coverHeight * 0.5;
      const detailsLineHeight = 35;

      // Email label and value
      const emailLabel = useHebrewLabels ? "אימייל:" : "Email:";
      coverPage.drawText(emailLabel, {
        x: useHebrewLabels ? coverWidth * 0.65 : coverWidth * 0.3,
        y: detailsY,
        size: detailsFontSize,
        font: coverTitleFont,
        color: rgb(0.3, 0.3, 0.4),
      });
      coverPage.drawText(email, {
        x: useHebrewLabels ? coverWidth * 0.2 : coverWidth * 0.45,
        y: detailsY,
        size: detailsFontSize,
        font: coverTextFont,
        color: rgb(0.4, 0.4, 0.5),
      });

      // ID label and value
      const idLabel = useHebrewLabels ? "תעודת זהות:" : "ID:";
      coverPage.drawText(idLabel, {
        x: useHebrewLabels ? coverWidth * 0.58 : coverWidth * 0.3,
        y: detailsY - detailsLineHeight,
        size: detailsFontSize,
        font: coverTitleFont,
        color: rgb(0.3, 0.3, 0.4),
      });
      coverPage.drawText(userId, {
        x: useHebrewLabels ? coverWidth * 0.35 : coverWidth * 0.45,
        y: detailsY - detailsLineHeight,
        size: detailsFontSize,
        font: coverTextFont,
        color: rgb(0.4, 0.4, 0.5),
      });

      // Success message at bottom
      const successText = useHebrewLabels ? "בהצלחה!" : "Good Luck!";
      const successFontSize = 24;
      
      let successWidth = coverWidth * 0.2;
      try {
        successWidth = coverTitleFont.widthOfTextAtSize(successText, successFontSize);
      } catch (e) {
        console.log("Could not calculate success text width, using default positioning");
      }
      
      coverPage.drawText(successText, {
        x: (coverWidth - successWidth) / 2,
        y: coverHeight * 0.15,
        size: successFontSize,
        font: coverTitleFont,
        color: rgb(0.3, 0.5, 0.7),
      });

      // Decorative elements (small dots or circles)
      const dotSize = 4;
      coverPage.drawCircle({
        x: coverWidth * 0.25,
        y: coverHeight * 0.15,
        size: dotSize,
        color: rgb(0.3, 0.5, 0.7),
      });
      coverPage.drawCircle({
        x: coverWidth * 0.75,
        y: coverHeight * 0.15,
        size: dotSize,
        color: rgb(0.3, 0.5, 0.7),
      });

      // Copy all pages from original PDF and add watermarks
      const copiedPages = await pdfDoc.copyPages(originalPdf, originalPdf.getPageIndices());
      const pages = copiedPages;
      const fullWatermarkText = `${email} | ID: ${userId}`;
      const emailPrefix = email.split('@')[0]; // Extract email prefix only

      // Get settings from config
      const visibleFontSize = watermarkConfig.font_size;
      const visibleOpacity = watermarkConfig.opacity;
      const centerFontSize = visibleFontSize * 2;
      const hiddenFontSize = watermarkConfig.hidden_watermark_font_size || 24;
      const hiddenOpacity = watermarkConfig.hidden_watermark_opacity || 0.12;
      const hiddenRowSpacing = watermarkConfig.hidden_watermark_row_spacing || 15;
      const hiddenColSpacing = watermarkConfig.hidden_watermark_col_spacing || 10;
      const hiddenEnabled = watermarkConfig.hidden_watermark_enabled !== false;

      // Add copied pages to the document and apply watermarks
      for (const page of pages) {
        pdfDoc.addPage(page);
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

        // Hidden forensic watermarks (only if enabled)
        if (hiddenEnabled) {
          const centerX = (width / 2) - (centerTextWidth / 2);
          const centerY = (height / 2) - 80;
          page.drawText(fullWatermarkText, { x: centerX + 5, y: centerY + 5, size: centerFontSize - 2, font, color: rgb(0.98,0.98,0.98), opacity: 0.02, rotate: degrees(30) });
          page.drawText(fullWatermarkText, { x: centerX - 5, y: centerY - 5, size: centerFontSize - 2, font, color: rgb(0.98,0.98,0.98), opacity: 0.02, rotate: degrees(60) });

          // Hidden watermarks in organized rows across the entire page
          const numRows = hiddenRowSpacing;
          const repeatsPerRow = Math.floor(width / (hiddenTextWidth + hiddenColSpacing));
          
          for (let row = 0; row < numRows; row++) {
            const y = height * ((row + 1) / (numRows + 1));
            
            // Draw the email multiple times in each row
            for (let col = 0; col < repeatsPerRow; col++) {
              const x = col * (hiddenTextWidth + hiddenColSpacing) + 10;
              page.drawText(emailPrefix, { 
                x: x, 
                y: y, 
                size: hiddenFontSize, 
                font, 
                color: rgb(0.92,0.92,0.92), 
                opacity: hiddenOpacity
              });
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