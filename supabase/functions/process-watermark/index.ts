import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

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
        const fontSize = 12;
        const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);

        // Add watermark at bottom center
        page.drawText(watermarkText, {
          x: (width - textWidth) / 2,
          y: 30,
          size: fontSize,
          font: font,
          color: rgb(0.5, 0.5, 0.5),
          opacity: 0.5,
        });

        // Add watermark at top right
        page.drawText(watermarkText, {
          x: width - textWidth - 20,
          y: height - 30,
          size: fontSize,
          font: font,
          color: rgb(0.5, 0.5, 0.5),
          opacity: 0.5,
        });
      }

      // Save processed PDF
      const processedPdfBytes = await pdfDoc.save();
      const processedFileName = `watermarked_${Date.now()}_${fileId.split('/').pop()}`;

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
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});