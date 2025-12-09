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
      
      // Load Hebrew-supporting font that includes numbers and Latin characters
      // Rubik font supports Hebrew, Latin, and numbers
      const fontSources = [
        // Rubik from cdnfonts (supports Hebrew + Latin + numbers)
        {
          regular: "https://fonts.cdnfonts.com/s/19158/Rubik-Regular.ttf",
          bold: "https://fonts.cdnfonts.com/s/19158/Rubik-Bold.ttf"
        },
        // Alternative: Heebo from raw GitHub
        {
          regular: "https://raw.githubusercontent.com/nicola02nb/FullFont-HeeboFont/main/Heebo-Regular.ttf",
          bold: "https://raw.githubusercontent.com/nicola02nb/FullFont-HeeboFont/main/Heebo-Bold.ttf"
        },
        // Noto Sans Hebrew (Hebrew only, as last resort)
        {
          regular: "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansHebrew/NotoSansHebrew-Regular.ttf",
          bold: "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansHebrew/NotoSansHebrew-Bold.ttf"
        }
      ];
      
      let hebrewFont: any = null;
      let hebrewBoldFont: any = null;
      let fontsLoaded = false;
      
      for (const source of fontSources) {
        if (fontsLoaded) break;
        
        try {
          console.log("Trying to load Hebrew fonts from:", source.regular);
          
          const [regularRes, boldRes] = await Promise.all([
            fetch(source.regular, { 
              headers: { 'Accept': '*/*' }
            }),
            fetch(source.bold, { 
              headers: { 'Accept': '*/*' }
            })
          ]);
          
          console.log("Font fetch status - Regular:", regularRes.status, "Bold:", boldRes.status);
          
          if (regularRes.ok && boldRes.ok) {
            const regularBytes = new Uint8Array(await regularRes.arrayBuffer());
            const boldBytes = new Uint8Array(await boldRes.arrayBuffer());
            
            console.log("Font sizes - Regular:", regularBytes.length, "Bold:", boldBytes.length);
            
            // Check if we got valid TTF files (minimum reasonable size)
            if (regularBytes.length > 5000 && boldBytes.length > 5000) {
              hebrewFont = await pdfDoc.embedFont(regularBytes);
              hebrewBoldFont = await pdfDoc.embedFont(boldBytes);
              fontsLoaded = true;
              console.log("Hebrew fonts embedded successfully from source!");
            } else {
              console.log("Font files too small, trying next source");
            }
          }
        } catch (fontError) {
          console.error("Error loading fonts from source:", fontError);
        }
      }
      
      if (!fontsLoaded) {
        console.warn("All Hebrew font sources failed - will skip Hebrew cover page elements");
      }
      
      // Standard fonts for ASCII text and watermarks (always available, supports Latin + numbers)
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Simple helper to draw Hebrew text (just use Hebrew font, no reversal needed)
      // PDF-lib handles the text as-is, the font contains proper glyph ordering
      const drawHebrewText = (page: any, hebrewText: string, symbolText: string, x: number, y: number, fontSize: number, useBold: boolean, color: any, drawSymbolFirst: boolean = false) => {
        if (!fontsLoaded) {
          // Fallback to standard font
          page.drawText(hebrewText + symbolText, {
            x, y,
            size: fontSize,
            font: useBold ? boldFont : font,
            color,
          });
          return;
        }
        
        const hebrewFontToUse = useBold ? hebrewBoldFont : hebrewFont;
        
        if (drawSymbolFirst && symbolText) {
          // Draw symbol first (e.g., "!" at the end for "בהצלחה!")
          // For RTL, the "!" should appear on the left
          let symbolWidth = 0;
          try {
            symbolWidth = font.widthOfTextAtSize(symbolText, fontSize);
          } catch (e) {
            symbolWidth = fontSize * symbolText.length * 0.3;
          }
          
          // Draw symbol with standard font
          page.drawText(symbolText, {
            x: x,
            y,
            size: fontSize,
            font: useBold ? boldFont : font,
            color,
          });
          
          // Draw Hebrew text after the symbol
          page.drawText(hebrewText, {
            x: x + symbolWidth,
            y,
            size: fontSize,
            font: hebrewFontToUse,
            color,
          });
        } else if (symbolText) {
          // Draw Hebrew first, then symbol (e.g., "אימייל:")
          let hebrewWidth = 0;
          try {
            hebrewWidth = hebrewFontToUse.widthOfTextAtSize(hebrewText, fontSize);
          } catch (e) {
            hebrewWidth = fontSize * hebrewText.length * 0.5;
          }
          
          // Draw Hebrew text
          page.drawText(hebrewText, {
            x: x,
            y,
            size: fontSize,
            font: hebrewFontToUse,
            color,
          });
          
          // Draw symbol after Hebrew text with standard font
          page.drawText(symbolText, {
            x: x + hebrewWidth,
            y,
            size: fontSize,
            font: useBold ? boldFont : font,
            color,
          });
        } else {
          // Just Hebrew text, no symbol
          page.drawText(hebrewText, {
            x, y,
            size: fontSize,
            font: hebrewFontToUse,
            color,
          });
        }
      };
      
      // Helper to draw title text (just use the appropriate font based on content)
      const drawTitleText = (page: any, text: string, x: number, y: number, fontSize: number, color: any) => {
        const hasHebrew = /[\u0590-\u05FF]/.test(text);
        
        if (!fontsLoaded || !hasHebrew) {
          page.drawText(text, {
            x, y,
            size: fontSize,
            font: boldFont,
            color,
          });
          return;
        }
        
        // For mixed content, draw the text as-is with Hebrew font
        // The Hebrew font should handle the text properly
        page.drawText(text, {
          x, y,
          size: fontSize,
          font: hebrewBoldFont,
          color,
        });
      };
      
      // Helper to get text width
      const getTextWidth = (text: string, fontSize: number, useHebrew: boolean, useBold: boolean): number => {
        const fontToUse = useHebrew && fontsLoaded 
          ? (useBold ? hebrewBoldFont : hebrewFont)
          : (useBold ? boldFont : font);
        try {
          return fontToUse.widthOfTextAtSize(text, fontSize);
        } catch (e) {
          return fontSize * text.length * 0.5;
        }
      };
      
      // Helper to calculate title width
      const getTitleWidth = (text: string, fontSize: number): number => {
        const hasHebrew = /[\u0590-\u05FF]/.test(text);
        const fontToUse = hasHebrew && fontsLoaded ? hebrewBoldFont : boldFont;
        try {
          return fontToUse.widthOfTextAtSize(text, fontSize);
        } catch (e) {
          return fontSize * text.length * 0.5;
        }
      };

      // Add metadata watermark (hidden but traceable)
      pdfDoc.setTitle(`Protected Document - ${userId}`);
      pdfDoc.setAuthor(email);
      pdfDoc.setSubject(`User: ${userId} | Email: ${email}`);
      pdfDoc.setKeywords([email, userId, 'protected', 'watermarked']);
      pdfDoc.setProducer(`David's PDF System - User: ${userId}`);
      pdfDoc.setCreator(`Watermarked for ${email}`);

      // Get original file name for the cover page - ALWAYS use displayName if provided
      const originalFileName = displayName || (path.split('/').pop() || 'document.pdf');
      const fileNameWithoutExt = originalFileName.replace(/\.pdf$/i, '');
      
      console.log("Cover page title:", fileNameWithoutExt, "fontsLoaded:", fontsLoaded);

      // Create cover page (A4 size: 595 x 842 points)
      const coverPage = pdfDoc.addPage([595, 842]);
      const { width: coverWidth, height: coverHeight } = coverPage.getSize();

      // Background subtle gradient effect (using rectangles with different opacities)
      coverPage.drawRectangle({
        x: 0,
        y: coverHeight * 0.6,
        width: coverWidth,
        height: coverHeight * 0.4,
        color: rgb(0.97, 0.97, 0.98),
      });

      // Title section - show file name
      const titleText = fileNameWithoutExt;
      const titleFontSize = 28;
      
      // Calculate title width for centering
      const titleWidth = getTitleWidth(titleText, titleFontSize);
      
      try {
        drawTitleText(
          coverPage, 
          titleText, 
          (coverWidth - titleWidth) / 2, 
          coverHeight * 0.7, 
          titleFontSize, 
          rgb(0.2, 0.2, 0.3)
        );
      } catch (titleError) {
        console.error("Error drawing title:", titleError);
        // Fallback to simple English text
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

      if (fontsLoaded) {
        try {
          // Draw "אימייל" with Hebrew font, then ":" with standard font
          const emailLabelHebrew = "אימייל";
          const emailLabelX = coverWidth * 0.65;
          drawHebrewText(coverPage, emailLabelHebrew, ":", emailLabelX, detailsY, detailsFontSize, true, rgb(0.3, 0.3, 0.4), false);
          
          // Use standard font for email (Latin characters)
          coverPage.drawText(email, {
            x: coverWidth * 0.15,
            y: detailsY,
            size: detailsFontSize,
            font: font,
            color: rgb(0.4, 0.4, 0.5),
          });

          // Draw "תעודת זהות" with Hebrew font, then ":" with standard font
          const idLabelHebrew = "תעודת זהות";
          const idLabelX = coverWidth * 0.55;
          drawHebrewText(coverPage, idLabelHebrew, ":", idLabelX, detailsY - detailsLineHeight, detailsFontSize, true, rgb(0.3, 0.3, 0.4), false);
          
          // Use standard font for ID (numbers)
          coverPage.drawText(userId, {
            x: coverWidth * 0.35,
            y: detailsY - detailsLineHeight,
            size: detailsFontSize,
            font: font,
            color: rgb(0.4, 0.4, 0.5),
          });

          // Draw "בהצלחה" with Hebrew font, then "!" with standard font
          const successHebrew = "בהצלחה";
          const successFontSize = 24;
          
          // Calculate widths for centering
          let hebrewWidth = 0;
          let symbolWidth = 0;
          try {
            hebrewWidth = hebrewBoldFont.widthOfTextAtSize(successHebrew, successFontSize);
            symbolWidth = boldFont.widthOfTextAtSize("!", successFontSize);
          } catch (e) {
            hebrewWidth = successFontSize * successHebrew.length * 0.5;
            symbolWidth = successFontSize * 0.3;
          }
          
          const totalSuccessWidth = hebrewWidth + symbolWidth;
          const successX = (coverWidth - totalSuccessWidth) / 2;
          
          // For RTL: draw "!" first (on left), then Hebrew text
          drawHebrewText(coverPage, successHebrew, "!", successX, coverHeight * 0.15, successFontSize, true, rgb(0.3, 0.5, 0.7), true);
        } catch (hebrewError) {
          console.error("Error drawing Hebrew labels, falling back to English:", hebrewError);
          // Fall through to English labels
          drawEnglishLabels();
        }
      } else {
        drawEnglishLabels();
      }
      
      function drawEnglishLabels() {
        coverPage.drawText("Email:", {
          x: coverWidth * 0.25,
          y: detailsY,
          size: detailsFontSize,
          font: boldFont,
          color: rgb(0.3, 0.3, 0.4),
        });
        coverPage.drawText(email, {
          x: coverWidth * 0.40,
          y: detailsY,
          size: detailsFontSize,
          font: font,
          color: rgb(0.4, 0.4, 0.5),
        });

        coverPage.drawText("ID:", {
          x: coverWidth * 0.25,
          y: detailsY - detailsLineHeight,
          size: detailsFontSize,
          font: boldFont,
          color: rgb(0.3, 0.3, 0.4),
        });
        coverPage.drawText(userId, {
          x: coverWidth * 0.40,
          y: detailsY - detailsLineHeight,
          size: detailsFontSize,
          font: font,
          color: rgb(0.4, 0.4, 0.5),
        });

        // English success message
        const successText = "Good Luck!";
        const successFontSize = 24;
        const successWidth = boldFont.widthOfTextAtSize(successText, successFontSize);
        
        coverPage.drawText(successText, {
          x: (coverWidth - successWidth) / 2,
          y: coverHeight * 0.15,
          size: successFontSize,
          font: boldFont,
          color: rgb(0.3, 0.5, 0.7),
        });
      }

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

    let filesOut: { originalId?: string; processedId: string; originalName?: string }[] = [];

    if (Array.isArray(body.fileIds)) {
      for (const fp of body.fileIds as string[]) {
        try {
          // Get the original Hebrew name from pdf_templates table
          let displayName: string | undefined;
          
          // Try to find the template with this file_path
          const { data: templateData } = await supabase
            .from('pdf_templates')
            .select('name, file_path')
            .eq('file_path', fp)
            .maybeSingle();
          
          if (templateData?.name) {
            displayName = templateData.name;
            console.log("Found template name:", displayName, "for path:", fp);
          } else {
            console.log("No template found for path:", fp, "- using filename from path");
          }
          
          const processedId = await processOne(fp, displayName);
          // Return the original name so send-watermarked-files can use it
          filesOut.push({ originalId: fp, processedId, originalName: displayName });
        } catch (err) {
          console.error('Error processing file', fp, err);
        }
      }
    } else if (body.filePath) {
      // For single file, use provided fileName or look up from DB
      let displayName = body.fileName;
      
      if (!displayName) {
        const { data: templateData } = await supabase
          .from('pdf_templates')
          .select('name')
          .eq('file_path', body.filePath)
          .maybeSingle();
        
        if (templateData?.name) {
          displayName = templateData.name;
        }
      }
      
      console.log("Single file processing - displayName:", displayName, "for path:", body.filePath);
      
      const processedId = await processOne(body.filePath, displayName);
      filesOut.push({ processedId, originalName: displayName });
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