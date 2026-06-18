import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const ollamaUrl = process.env.OLLAMA_HOST || "http://localhost:11434";
  
  try {
    const { image, prompt, model, geminiApiKey, groqApiKey } = await req.json();
    
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
    
    // If Gemini model is selected
    if (activeModel.startsWith("gemini-")) {
      const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "Missing Gemini API Key. Set it in settings." }, { status: 400 });
      }

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Image
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 150
        }
      };

      const res = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000), // Timeout after 15 seconds
      });

      if (!res.ok) {
        const errText = await res.text();
        let isRateLimit = res.status === 429;
        try {
          const errObj = JSON.parse(errText);
          if (errObj.error?.code === 429 || String(errObj.error?.message).toLowerCase().includes("rate limit") || String(errObj.error?.message).toLowerCase().includes("quota")) {
            isRateLimit = true;
          }
        } catch (_) {}
        return NextResponse.json({ error: `Gemini API error: ${errText}`, isRateLimit }, { status: res.status });
      }

      const result = await res.json();
      const rawResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Parse guesses from response
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
    }

    // If Groq model (Qwen / Llama 4 Scout) is selected
    if (activeModel.startsWith("qwen/") || activeModel.startsWith("meta-llama/")) {
      const apiKey = groqApiKey || process.env.GROQ_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "Missing Groq API Key. Set it in settings." }, { status: 400 });
      }

      const groqUrl = "https://api.groq.com/openai/v1/chat/completions";
      const payload = {
        model: activeModel,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: promptText },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 150
      };

      const res = await fetch(groqUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000), // Timeout after 15 seconds
      });

      if (!res.ok) {
        const errText = await res.text();
        let isRateLimit = res.status === 429;
        try {
          const errObj = JSON.parse(errText);
          if (errObj.error?.code === "rate_limit_exceeded" || errObj.error?.type === "rate_limit_exceeded" || String(errObj.error?.message).toLowerCase().includes("rate limit") || String(errObj.error?.message).toLowerCase().includes("quota")) {
            isRateLimit = true;
          }
        } catch (_) {}
        return NextResponse.json({ error: `Groq API error: ${errText}`, isRateLimit }, { status: res.status });
      }

      const result = await res.json();
      const rawResponse = result.choices?.[0]?.message?.content || "";

      // Parse guesses from response
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
    }
    
    // Otherwise, fallback to Ollama endpoint
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
