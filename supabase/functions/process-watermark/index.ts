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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { filePath, email, userId, fileName }: WatermarkRequest = await req.json();
    console.log("Processing watermark for:", { filePath, email, userId, fileName });

    // Download the original PDF
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("pdf-files")
      .download(filePath);

    if (downloadError) {
      console.error("Error downloading file:", downloadError);
      return new Response(
        JSON.stringify({ error: `Failed to download file: ${downloadError.message}` }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
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
    const watermarkText = `${email} | ID: ${userId}`;

    for (const page of pages) {
      const { width, height } = page.getSize();
      const smallFontSize = 10;
      const centerFontSize = 20;
      const smallTextWidth = font.widthOfTextAtSize(watermarkText, smallFontSize);
      const centerTextWidth = font.widthOfTextAtSize(watermarkText, centerFontSize);

      const topX = width - smallTextWidth - 15;
      const topY = height - 20;
      const bottomX = 15;
      const bottomY = 15;
      const centerX = (width / 2) - (centerTextWidth / 2);
      const centerY = (height / 2) - 30;

      // Top watermark - multiple layers
      page.drawText(watermarkText, {
        x: topX,
        y: topY,
        size: smallFontSize,
        font: font,
        color: rgb(0.9, 0.9, 0.9),
        opacity: 0.05,
      });
      
      page.drawText(watermarkText, {
        x: topX,
        y: topY,
        size: smallFontSize,
        font: font,
        color: rgb(0.7, 0.7, 0.7),
        opacity: 0.15,
      });
      
      page.drawText(watermarkText, {
        x: topX,
        y: topY,
        size: smallFontSize,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.4,
      });

      // Bottom watermark - multiple layers
      page.drawText(watermarkText, {
        x: bottomX,
        y: bottomY,
        size: smallFontSize,
        font: font,
        color: rgb(0.9, 0.9, 0.9),
        opacity: 0.05,
      });
      
      page.drawText(watermarkText, {
        x: bottomX,
        y: bottomY,
        size: smallFontSize,
        font: font,
        color: rgb(0.7, 0.7, 0.7),
        opacity: 0.15,
      });
      
      page.drawText(watermarkText, {
        x: bottomX,
        y: bottomY,
        size: smallFontSize,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.4,
      });

      // Center watermark - diagonal with multiple layers
      page.drawText(watermarkText, {
        x: centerX,
        y: centerY,
        size: centerFontSize,
        font: font,
        color: rgb(0.95, 0.95, 0.95),
        opacity: 0.03,
        rotate: degrees(45),
      });
      
      page.drawText(watermarkText, {
        x: centerX,
        y: centerY,
        size: centerFontSize,
        font: font,
        color: rgb(0.8, 0.8, 0.8),
        opacity: 0.08,
        rotate: degrees(45),
      });
      
      page.drawText(watermarkText, {
        x: centerX,
        y: centerY,
        size: centerFontSize,
        font: font,
        color: rgb(0.6, 0.6, 0.6),
        opacity: 0.18,
        rotate: degrees(45),
      });

      // Hidden forensic watermarks
      page.drawText(watermarkText, {
        x: centerX + 5,
        y: centerY + 5,
        size: centerFontSize - 2,
        font: font,
        color: rgb(0.98, 0.98, 0.98),
        opacity: 0.02,
        rotate: degrees(30),
      });
      
      page.drawText(watermarkText, {
        x: centerX - 5,
        y: centerY - 5,
        size: centerFontSize - 2,
        font: font,
        color: rgb(0.98, 0.98, 0.98),
        opacity: 0.02,
        rotate: degrees(60),
      });
    }

    // Save processed PDF with original name + userId
    const processedPdfBytes = await pdfDoc.save();
    const fileNameWithoutExt = fileName.replace(/\.pdf$/i, '');
    const processedFileName = `${fileNameWithoutExt}_${userId}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("pdf-files")
      .upload(`processed/${processedFileName}`, processedPdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading processed file:", uploadError);
      return new Response(
        JSON.stringify({ error: `Failed to upload processed file: ${uploadError.message}` }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    const fileId = `processed/${processedFileName}`;
    console.log("Processed file:", fileId);

    return new Response(JSON.stringify({ success: true, fileId }), {
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