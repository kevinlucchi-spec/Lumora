/**
 * Gemini-based image editing.
 * Takes an existing image (base64) + a text edit instruction,
 * returns a modified image.
 *
 * Uses gemini-2.5-flash-image via generateContent with multimodal input.
 */

const EDIT_MODEL = "gemini-2.5-flash-preview-image"
const API_VERSION = "v1beta"

export interface ImageEditRequest {
  /** Base64-encoded image data (no data: prefix) */
  imageBase64: string
  /** MIME type of the image */
  mimeType: string
  /** User's edit instruction, e.g. "Make the eyes greener" */
  editInstruction: string
}

export interface ImageEditResponse {
  /** Base64-encoded result image */
  imageBase64: string
  mimeType: string
}

export async function editImageWithGemini(
  apiKey: string,
  request: ImageEditRequest,
): Promise<ImageEditResponse> {
  const url = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${EDIT_MODEL}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: request.mimeType,
                data: request.imageBase64,
              },
            },
            {
              text: `Edit this image: ${request.editInstruction}. Keep the same art style, composition, and character identity. Only change what was requested.`,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
        // Prefer image output
      },
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    console.error(`[gemini-edit] API error (${response.status}):`, errBody)

    if (errBody.includes("paid plan") || errBody.includes("quota") || errBody.includes("RESOURCE_EXHAUSTED")) {
      throw new Error(
        "Image editing requires a paid Google AI plan. Check your billing at https://ai.dev/projects."
      )
    }
    throw new Error(`Image editing failed (${response.status})`)
  }

  const data = await response.json()

  // Find the image part in the response
  const candidates = data.candidates ?? []
  for (const candidate of candidates) {
    const parts = candidate.content?.parts ?? []
    for (const part of parts) {
      if (part.inlineData?.data) {
        return {
          imageBase64: part.inlineData.data,
          mimeType: part.inlineData.mimeType ?? "image/png",
        }
      }
    }
  }

  console.error("[gemini-edit] No image in response:", JSON.stringify(data).slice(0, 500))
  throw new Error("Image editing returned no image. Try a different edit instruction.")
}
