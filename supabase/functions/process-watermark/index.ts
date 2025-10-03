import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, StandardFonts, degrees } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WatermarkRequest {
  fileIds: string[];
  email: string;
  userId: string;
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

    const { fileIds, email, userId }: WatermarkRequest = await req.json();
    console.log("Processing watermark for:", { fileIds, email, userId });

    const processedFiles = [];

    for (const fileId of fileIds) {
      // Download the original PDF
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("pdf-files")
        .download(fileId);

      if (downloadError) {
        console.error("Error downloading file:", downloadError);
        continue;
      }

      // Load PDF
      const pdfBytes = await fileData.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Add watermark to each page
      const pages = pdfDoc.getPages();
      const watermarkText = `${email} | ID: ${userId}`;

      for (const page of pages) {
        const { width, height } = page.getSize();
        const fontSize = 24;
        const smallFontSize = 10;
        const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
        const smallTextWidth = font.widthOfTextAtSize(watermarkText, smallFontSize);

        // Calculate center position - slightly lower for better centering
        const centerX = width / 2;
        const centerY = (height / 2) - 50;

        // Draw diagonal watermark in center (large, more transparent)
        page.drawText(watermarkText, {
          x: centerX - (textWidth / 2),
          y: centerY,
          size: fontSize,
          font: font,
          color: rgb(0.7, 0.7, 0.7),
          opacity: 0.15,
          rotate: degrees(45),
        });

        // Add small watermark at top right
        page.drawText(watermarkText, {
          x: width - smallTextWidth - 20,
          y: height - 30,
          size: smallFontSize,
          font: font,
          color: rgb(0.5, 0.5, 0.5),
          opacity: 0.5,
        });

        // Add small watermark at bottom left
        page.drawText(watermarkText, {
          x: 20,
          y: 20,
          size: smallFontSize,
          font: font,
          color: rgb(0.5, 0.5, 0.5),
          opacity: 0.5,
        });
      }

      // Save processed PDF with original name + userId
      const processedPdfBytes = await pdfDoc.save();
      const originalFileName = fileId.split('/').pop() || 'document.pdf';
      const fileNameWithoutExt = originalFileName.replace(/\.pdf$/i, '');
      const processedFileName = `${fileNameWithoutExt}_${userId}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("pdf-files")
        .upload(`processed/${processedFileName}`, processedPdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        console.error("Error uploading processed file:", uploadError);
        continue;
      }

      processedFiles.push({
        originalId: fileId,
        processedId: `processed/${processedFileName}`,
        fileName: processedFileName,
      });
    }

    console.log("Processed files:", processedFiles);

    return new Response(JSON.stringify({ success: true, files: processedFiles }), {
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