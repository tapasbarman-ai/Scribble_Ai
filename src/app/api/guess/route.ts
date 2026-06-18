import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const ollamaUrl = process.env.OLLAMA_HOST || "http://localhost:11434";
  
  try {
    const { image, prompt, model } = await req.json();
    
    if (!image) {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 });
    }
    
    // Extract base64 payload from data URI header
    let base64Image = image;
    if (image.includes(",")) {
      base64Image = image.split(",")[1];
    }
    
    const activeModel = model || "moondream";
    const promptText = prompt || (
      "Identify the object in this simple drawing/sketch. " +
      "List 3 possible one-word guesses, separated by commas, in order of confidence. " +
      "Example output format: 'cat, tiger, face'. " +
      "Keep the output extremely short. Do not write full sentences."
    );
    
    const payload = {
      model: activeModel,
      prompt: promptText,
      images: [base64Image],
      stream: false,
      options: {
        temperature: 0.1,
        top_k: 20,
        top_p: 0.9,
      }
    };
    
    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // Timeout after 30 seconds
    });
    
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Ollama error: ${errText}` }, { status: res.status });
    }
    
    const result = await res.json();
    const rawResponse = result.response || "";
    
    // Parse guesses from response (split by comma, newline, semicolon, slash)
    const guesses = rawResponse
      .split(/[,;\n/]/)
      .map((g: string) => g.trim().toLowerCase())
      .filter((g: string) => g.length > 0)
      .slice(0, 3);
      
    return NextResponse.json({
      success: true,
      raw_response: rawResponse,
      guesses: guesses,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
