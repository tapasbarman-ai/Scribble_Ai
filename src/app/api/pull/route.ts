import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const ollamaUrl = process.env.OLLAMA_HOST || "http://localhost:11434";
  
  try {
    const { model } = await req.json();
    
    if (!model) {
      return NextResponse.json({ error: "Missing model name" }, { status: 400 });
    }
    
    const res = await fetch(`${ollamaUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model, stream: true }),
    });
    
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Ollama pull failed: ${errText}` }, 
        { status: res.status }
      );
    }
    
    // Stream the response body directly back to the browser
    return new Response(res.body, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
