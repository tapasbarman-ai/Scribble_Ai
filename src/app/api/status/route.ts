import { NextResponse } from "next/server";

export async function GET() {
  const ollamaUrl = process.env.OLLAMA_HOST || "http://localhost:11434";
  const geminiConfigured = !!process.env.GEMINI_API_KEY;
  const groqConfigured = !!process.env.GROQ_API_KEY;
  
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000), // Timeout after 3 seconds
    });
    
    if (!res.ok) {
      return NextResponse.json({
        ollama_connected: false,
        error: `Ollama returned status ${res.status}`,
        vision_models: [],
        default_model_available: false,
        gemini_configured: geminiConfigured,
        groq_configured: groqConfigured,
      });
    }
    
    const data = await res.json();
    const models = (data.models || []).map((m: { name: string }) => m.name);
    
    // Check for common vision models
    const visionKeywords = ["moondream", "llava", "vision", "bakllava"];
    const visionModels = models.filter((m: string) => 
      visionKeywords.some(keyword => m.toLowerCase().includes(keyword))
    );
    
    return NextResponse.json({
      ollama_connected: true,
      all_models: models,
      vision_models: visionModels,
      default_model_available: models.some((m: string) => m.toLowerCase().includes("moondream")),
      gemini_configured: geminiConfigured,
      groq_configured: groqConfigured,
    });
  } catch (e) {
    return NextResponse.json({
      ollama_connected: false,
      error: e instanceof Error ? e.message : String(e),
      vision_models: [],
      default_model_available: false,
      gemini_configured: geminiConfigured,
      groq_configured: groqConfigured,
    });
  }
}
