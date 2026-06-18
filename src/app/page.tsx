"use client";

import { useEffect, useRef, useState } from "react";
import {
  Pencil,
  Eraser,
  Trash2,
  RotateCcw,
  RotateCw,
  Eye,
  Trophy,
  Compass,
  Settings,
  Play,
  SkipForward,
  Brain,
  Loader2,
  CheckCircle,
  XCircle,
  X,
  Volume2,
  AlertTriangle,
  Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface GuessLog {
  text: string;
  time: number;
  isMatch: boolean;
}

export default function GamePage() {
  // Connection and model states
  const [ollamaConnected, setOllamaConnected] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [activeModel, setActiveModel] = useState("");
  const [connectionStatusText, setConnectionStatusText] = useState("Checking Ollama...");

  // Gemini API states
  const [userGeminiKey, setUserGeminiKey] = useState("");
  const [geminiConfiguredInBackend, setGeminiConfiguredInBackend] = useState(false);

  // Groq API states
  const [userGroqKey, setUserGroqKey] = useState("");
  const [groqConfiguredInBackend, setGroqConfiguredInBackend] = useState(false);
  const [apiRateLimitExceeded, setApiRateLimitExceeded] = useState(false);

  // Drawing configurations
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(8);
  const [isEraser, setIsEraser] = useState(false);

  // Undo/Redo button states
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // App game loop states
  const [currentGameMode, setCurrentGameMode] = useState<"sandbox" | "game">("sandbox");
  const [autoGuess, setAutoGuess] = useState(true);
  const [isThinking, setIsThinking] = useState(false);

  // Sandbox states
  const [sandboxGuesses, setSandboxGuesses] = useState<string[]>([]);
  const [sandboxDescription, setSandboxDescription] = useState("");
  const [showSandboxPlaceholder, setShowSandboxPlaceholder] = useState(true);

  // Challenge Game states
  const [gameScore, setGameScore] = useState(0);
  const [gameHighScore, setGameHighScore] = useState(0);
  const [gameTimeLeft, setGameTimeLeft] = useState(40);
  const [targetWord, setTargetWord] = useState("---");
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [gameGuessesLog, setGameGuessesLog] = useState<GuessLog[]>([]);
  const [gameWordList, setGameWordList] = useState<string[]>([]);

  // Settings & Pull states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [ollamaHost, setOllamaHost] = useState("http://localhost:11434");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState("");
  const [downloadPercent, setDownloadPercent] = useState(0);

  // Banner state
  const [banner, setBanner] = useState<{ message: string; type: "success" | "error" | "warning" | "info" } | null>(null);

  // Canvas and Logic Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const lastXRef = useRef(0);
  const lastYRef = useRef(0);
  const canvasIsDirtyRef = useRef(false);
  const lastGuessImageRef = useRef("");

  // Undo/Redo memory buffers (stored in refs to prevent render spam)
  const undoStackRef = useRef<ImageData[]>([]);
  const redoStackRef = useRef<ImageData[]>([]);

  // Timers Refs
  const gameTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gameGuessIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoGuessIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial setups and API pings
  useEffect(() => {
    // Load high score
    const cachedScore = localStorage.getItem("scribble_high_score");
    if (cachedScore) setGameHighScore(parseInt(cachedScore));

    // Load Ollama host
    const cachedHost = localStorage.getItem("ollama_host");
    if (cachedHost) setOllamaHost(cachedHost);

    // Load Gemini local API Key
    const cachedGeminiKey = localStorage.getItem("gemini_api_key");
    if (cachedGeminiKey) setUserGeminiKey(cachedGeminiKey);

    // Load Groq local API Key
    const cachedGroqKey = localStorage.getItem("groq_api_key");
    if (cachedGroqKey) setUserGroqKey(cachedGroqKey);

    // Initial check
    checkStatus();

    return () => {
      clearAllIntervals();
    };
  }, []);

  // Set up auto-guess watcher for sandbox mode
  useEffect(() => {
    if (autoGuessIntervalRef.current) clearInterval(autoGuessIntervalRef.current);

    const isGemini = activeModel.startsWith("gemini-");
    const intervalTime = isGemini ? 5000 : 2500; // Increase interval for Gemini to respect rate limits

    autoGuessIntervalRef.current = setInterval(() => {
      if (
        currentGameMode === "sandbox" &&
        autoGuess &&
        canvasIsDirtyRef.current &&
        (ollamaConnected || isGemini) &&
        activeModel
      ) {
        triggerGuess(true);
      }
    }, intervalTime);

    return () => {
      if (autoGuessIntervalRef.current) clearInterval(autoGuessIntervalRef.current);
    };
  }, [currentGameMode, autoGuess, ollamaConnected, activeModel]);

  // Set up ResizeObserver to handle initial sizing and any dynamic size adjustments
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    let initialResized = false;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const entry = entries[0];
      const { width, height } = entry.contentRect;

      if (width > 0 && height > 0) {
        const dpr = window.devicePixelRatio || 1;

        if (contextRef.current) {
          // Keep existing canvas content during resizing
          const tempImage = new Image();
          tempImage.src = canvas.toDataURL();
          tempImage.onload = () => {
            canvas.width = width * dpr;
            canvas.height = height * dpr;

            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.setTransform(1, 0, 0, 1, 0, 0);
              ctx.scale(dpr, dpr);
              ctx.lineCap = "round";
              ctx.lineJoin = "round";
              contextRef.current = ctx;

              // Fill with solid white background
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, width, height);

              // Restore content
              ctx.drawImage(tempImage, 0, 0, width, height);
            }
          };
        } else {
          // Initialize canvas dimensions and contexts
          canvas.width = width * dpr;
          canvas.height = height * dpr;

          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            contextRef.current = ctx;

            // Fill with solid white background
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);

            // Initialize undo stack
            if (!initialResized) {
              initialResized = true;
              const initialImgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              undoStackRef.current = [initialImgData];
              redoStackRef.current = [];
              setCanUndo(false);
              setCanRedo(false);
            }
          }
        }
      }
    });

    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Clear intervals utility
  const clearAllIntervals = () => {
    if (gameTimerIntervalRef.current) clearInterval(gameTimerIntervalRef.current);
    if (gameGuessIntervalRef.current) clearInterval(gameGuessIntervalRef.current);
    if (autoGuessIntervalRef.current) clearInterval(autoGuessIntervalRef.current);
  };

  // Check Ollama, Gemini and Groq status
  const checkStatus = async () => {
    setConnectionStatusText("Checking status...");
    try {
      const res = await fetch("/api/status");
      const data = await res.json();

      setGeminiConfiguredInBackend(data.gemini_configured || false);
      setGroqConfiguredInBackend(data.groq_configured || false);

      const cachedGeminiKey = localStorage.getItem("gemini_api_key") || "";
      const hasGemini = data.gemini_configured || !!cachedGeminiKey;
      const geminiModels = hasGemini ? ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"] : [];

      const cachedGroqKey = localStorage.getItem("groq_api_key") || "";
      const hasGroq = data.groq_configured || !!cachedGroqKey;
      const groqModels = hasGroq ? [
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "qwen/qwen3.6-27b",
        "qwen/qwen3-32b"
      ] : [];

      if (data.ollama_connected) {
        setOllamaConnected(true);
        let statusText = "Ollama Ready";
        if (hasGemini && hasGroq) {
          statusText = "Ollama, Gemini & Groq Ready";
        } else if (hasGemini) {
          statusText = "Ollama & Gemini Ready";
        } else if (hasGroq) {
          statusText = "Ollama & Groq Ready";
        }
        setConnectionStatusText(statusText);
        
        const allModels = [...geminiModels, ...groqModels, ...(data.vision_models || [])];
        setAvailableModels(allModels);

        if (allModels.length > 0) {
          // Set active model to default if not already configured
          setActiveModel(prev => {
            if (prev && allModels.includes(prev)) return prev;
            return allModels.find(m => m.includes("qwen")) || allModels.find(m => m.includes("gemini-2.5-flash")) || allModels.find(m => m.includes("moondream")) || allModels[0];
          });
        }
      } else {
        setOllamaConnected(false);
        let statusText = "Ollama Offline";
        if (hasGemini && hasGroq) {
          statusText = "Gemini & Groq Active";
        } else if (hasGemini) {
          statusText = "Gemini Active";
        } else if (hasGroq) {
          statusText = "Groq Active";
        }
        setConnectionStatusText(statusText);
        
        const allModels = [...geminiModels, ...groqModels];
        setAvailableModels(allModels);
        if (allModels.length > 0) {
          setActiveModel(prev => {
            if (prev && allModels.includes(prev)) return prev;
            return allModels.find(m => m.includes("qwen")) || allModels[0];
          });
        }
        
        if (!hasGemini && !hasGroq) {
          showBanner("Cannot reach Ollama server and cloud APIs are not configured.", "warning");
        }
      }
    } catch (e) {
      setOllamaConnected(false);
      setConnectionStatusText("Backend Offline");
      showBanner("Cannot connect to the scribble server.", "error");
    }
  };

  const handleSaveGeminiKey = () => {
    localStorage.setItem("gemini_api_key", userGeminiKey);
    showBanner("Gemini API Key updated! Re-verifying...", "success");
    checkStatus();
  };

  const handleSaveGroqKey = () => {
    localStorage.setItem("groq_api_key", userGroqKey);
    showBanner("Groq API Key updated! Re-verifying...", "success");
    checkStatus();
  };

  // Banner display utility
  const showBanner = (message: string, type: "success" | "error" | "warning" | "info" = "info") => {
    setBanner({ message, type });
    setTimeout(() => {
      setBanner(null);
    }, 4000);
  };

  // 2. Canvas Operations
  const clearCanvas = (recordState = true) => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    
    canvasIsDirtyRef.current = true;

    if (recordState) {
      saveCanvasState();
      redoStackRef.current = [];
      setCanRedo(false);
    }
  };

  const saveCanvasState = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current.push(imgData);
    if (undoStackRef.current.length > 25) {
      undoStackRef.current.shift();
    }
    setCanUndo(undoStackRef.current.length > 1);
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx || undoStackRef.current.length <= 1) return;

    const currentState = undoStackRef.current.pop()!;
    redoStackRef.current.push(currentState);
    setCanRedo(true);

    const prevState = undoStackRef.current[undoStackRef.current.length - 1];
    ctx.putImageData(prevState, 0, 0);
    canvasIsDirtyRef.current = true;
    setCanUndo(undoStackRef.current.length > 1);
  };

  const handleRedo = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx || redoStackRef.current.length === 0) return;

    const nextState = redoStackRef.current.pop()!;
    undoStackRef.current.push(nextState);
    ctx.putImageData(nextState, 0, 0);
    canvasIsDirtyRef.current = true;
    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
  };

  // Drawing mouse/touch coords calculator
  const getCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ("touches" in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Normalize coordinate scale between CSS style size and actual bounding rect size (useful for zooming)
    const scaleX = canvas.style.width ? (parseFloat(canvas.style.width) / rect.width) : 1;
    const scaleY = canvas.style.height ? (parseFloat(canvas.style.height) / rect.height) : 1;

    return {
      x: x * scaleX,
      y: y * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ("touches" in e) {
      e.preventDefault(); // prevent touch scrolls
    }
    isDrawingRef.current = true;
    const coords = getCoords(e);
    lastXRef.current = coords.x;
    lastYRef.current = coords.y;
    canvasIsDirtyRef.current = true;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !contextRef.current) return;
    if ("touches" in e) {
      e.preventDefault();
    }

    const coords = getCoords(e);
    const ctx = contextRef.current;

    ctx.beginPath();
    ctx.moveTo(lastXRef.current, lastYRef.current);
    ctx.lineTo(coords.x, coords.y);

    ctx.strokeStyle = isEraser ? "#ffffff" : brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastXRef.current = coords.x;
    lastYRef.current = coords.y;
  };

  const stopDrawing = () => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      saveCanvasState();
      redoStackRef.current = [];
      setCanRedo(false);
    }
  };

  // client-side white-background image builder
  const prepareImageForAi = (): string => {
    const canvas = canvasRef.current;
    if (!canvas) return "";

    const offscreen = document.createElement("canvas");
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;

    const octx = offscreen.getContext("2d");
    if (!octx) return "";

    // Fill with solid white
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, offscreen.width, offscreen.height);

    // Draw the drawing on top
    octx.drawImage(canvas, 0, 0);

    // Convert to JPEG base64 (removes transparent elements which break vision models)
    return offscreen.toDataURL("image/jpeg", 0.85);
  };

  // 3. AI Prediction Pipeline
  const triggerGuess = async (isAuto = false) => {
    const isGemini = activeModel.startsWith("gemini-");
    if ((!ollamaConnected && !isGemini) || !activeModel) {
      if (!isAuto) showBanner("AI model is not ready yet.", "warning");
      return;
    }

    const imageData = prepareImageForAi();
    if (!imageData || imageData === lastGuessImageRef.current) return;

    canvasIsDirtyRef.current = false;
    lastGuessImageRef.current = imageData;

    if (!isAuto) setIsThinking(true);

    try {
      const promptText = (currentGameMode === "sandbox")
        ? "Identify the object in this simple drawing/sketch. " +
        "List 3 possible one-word guesses, separated by commas, in order of confidence. " +
        "Example output format: 'cat, tiger, face'. " +
        "Keep the output extremely short. Do not write full sentences."
        : `The user wants to draw a '${targetWord}'. Give 3 possible brief labels representing what they drew, separated by commas.`;

      const cachedGeminiKey = localStorage.getItem("gemini_api_key") || "";
      const cachedGroqKey = localStorage.getItem("groq_api_key") || "";

      const response = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageData,
          model: activeModel,
          prompt: promptText,
          geminiApiKey: cachedGeminiKey,
          groqApiKey: cachedGroqKey
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.isRateLimit) {
          setApiRateLimitExceeded(true);
        }
        throw new Error(errorData.error || "API call failed");
      }
      const data = await response.json();

      if (data.success) {
        setApiRateLimitExceeded(false);
        if (currentGameMode === "sandbox") {
          setShowSandboxPlaceholder(false);
          setSandboxGuesses(data.guesses);

          // Generate a playful crayon interpretation locally
          let desc = data.raw_response;
          if (desc.includes("\n")) {
            desc = desc.split("\n").pop() || desc;
          }
          setSandboxDescription(desc);
        } else if (currentGameMode === "game" && isGameRunning) {
          processGameGuesses(data.guesses);
        }
      }
    } catch (e) {
      console.error("Failed to fetch guess prediction:", e);
    } finally {
      if (!isAuto) setIsThinking(false);
    }
  };

  // 4. Model Downloading (Pull) Handler
  const startPullModel = async (modelName: string) => {
    setIsDownloading(true);
    setDownloadProgress("Initiating connection...");
    setDownloadPercent(0);

    try {
      const response = await fetch("/api/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName }),
      });

      if (!response.body) throw new Error("Piping stream unavailable");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        // Ollama streams NDJSON lines
        const lines = chunk.split("\n").filter(l => l.trim().length > 0);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            const status = data.status || "";

            if (data.total && data.completed) {
              const pct = (data.completed / data.total) * 100;
              setDownloadPercent(pct);
              setDownloadProgress(`${status} (${pct.toFixed(1)}%)`);
            } else {
              setDownloadProgress(status);
            }

            if (status.includes("success") || status === "success") {
              showBanner(`Successfully pulled ${modelName}!`, "success");
              setIsDownloading(false);
              checkStatus(); // Reload active model selection list
            }
          } catch {
            // parsing error on incomplete lines
          }
        }
      }
    } catch (e) {
      showBanner(`Pull failed: ${e instanceof Error ? e.message : String(e)}`, "error");
      setIsDownloading(false);
    }
  };

  // Save Ollama Host configuration settings
  const handleSaveHost = () => {
    localStorage.setItem("ollama_host", ollamaHost);
    showBanner("Host settings updated! Connecting...", "success");
    checkStatus();
  };

  // 5. Challenge Game Mode Loops
  const fetchWords = async (): Promise<string[]> => {
    try {
      const res = await fetch("/api/words");
      const data = await res.json();
      return data.words || [];
    } catch {
      return ["cat", "dog", "house", "sun", "flower", "tree", "car", "apple", "clock", "chair"];
    }
  };

  const startChallenge = async () => {
    const isGemini = activeModel.startsWith("gemini-");
    if ((!ollamaConnected && !isGemini) || !activeModel) {
      showBanner("Vision AI is not ready. Select a model or set Gemini API key.", "warning");
      return;
    }

    let list = [...gameWordList];
    if (list.length === 0) {
      list = await fetchWords();
    }

    const word = list.shift() || "apple";
    setGameWordList(list);
    setTargetWord(word);

    // Clear board and states
    clearCanvas(true);
    setGameGuessesLog([]);
    setIsGameRunning(true);
    setGameTimeLeft(40);

    // Clear existing loops
    if (gameTimerIntervalRef.current) clearInterval(gameTimerIntervalRef.current);
    if (gameGuessIntervalRef.current) clearInterval(gameGuessIntervalRef.current);

    // 1. Timer countdown loop
    gameTimerIntervalRef.current = setInterval(() => {
      setGameTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(gameTimerIntervalRef.current!);
          clearInterval(gameGuessIntervalRef.current!);
          endRound(false, word);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // 2. Real-time guess poll loop (every 2.5 seconds)
    gameGuessIntervalRef.current = setInterval(() => {
      if (canvasIsDirtyRef.current) {
        triggerGuess(true);
      }
    }, 2500);
  };

  const skipWord = () => {
    if (gameTimerIntervalRef.current) clearInterval(gameTimerIntervalRef.current);
    if (gameGuessIntervalRef.current) clearInterval(gameGuessIntervalRef.current);
    startChallenge();
  };

  const processGameGuesses = (guesses: string[]) => {
    const target = targetWord.toLowerCase().trim();

    setGameGuessesLog(prev => {
      const currentLog = [...prev];
      let matchFound = false;

      guesses.forEach(guess => {
        const cleaned = guess.toLowerCase().trim();
        if (currentLog.some(log => log.text.toLowerCase() === cleaned)) return;

        const isMatch = (cleaned === target || cleaned.includes(target) || target.includes(cleaned));

        currentLog.push({
          text: cleaned,
          time: 40 - gameTimeLeft,
          isMatch
        });

        if (isMatch) matchFound = true;
      });

      if (matchFound) {
        setTimeout(() => endRound(true, target), 100);
      }

      return currentLog;
    });
  };

  const endRound = (isSuccess: boolean, currentTarget: string) => {
    setIsGameRunning(false);
    if (gameTimerIntervalRef.current) clearInterval(gameTimerIntervalRef.current);
    if (gameGuessIntervalRef.current) clearInterval(gameGuessIntervalRef.current);

    if (isSuccess) {
      const roundScore = 100 + (gameTimeLeft * 5);
      setGameScore(prev => {
        const nextScore = prev + roundScore;
        if (nextScore > gameHighScore) {
          setGameHighScore(nextScore);
          localStorage.setItem("scribble_high_score", nextScore.toString());
        }
        return nextScore;
      });
      showBanner(`Correct! You earned ${roundScore} points!`, "success");
      setTargetWord("CORRECT!");
    } else {
      showBanner(`Time's Up! The word was: ${currentTarget}`, "error");
      setGameScore(0); // reset score on round loss
      setTargetWord("ROUND OVER");
    }
  };

  const handleModeChange = (mode: "sandbox" | "game") => {
    setCurrentGameMode(mode);
    setIsGameRunning(false);
    if (gameTimerIntervalRef.current) clearInterval(gameTimerIntervalRef.current);
    if (gameGuessIntervalRef.current) clearInterval(gameGuessIntervalRef.current);

    if (mode === "sandbox") {
      setSandboxGuesses([]);
      setSandboxDescription("");
      setShowSandboxPlaceholder(true);
    } else {
      setTargetWord("---");
      setGameScore(0);
      setGameGuessesLog([]);
    }
  };

  return (
    <div className="flex flex-col flex-grow p-4 md:p-6 w-full max-w-[1400px] mx-auto min-h-screen">

      {/* Rate Limit Alarm Modal */}
      {apiRateLimitExceeded && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#fff0f0] border-[4px] border-[#ff3333] border-radius-crayon shadow-flat-lg p-6 max-w-md w-full animate-pulse-glow filter-wobble">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-[#ff3333] p-3 rounded-full border-2 border-slate-900 animate-alarm-shake text-white">
                <Bell className="w-8 h-8 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-3xl text-[#ff3333] tracking-wide">
                  LIMIT EXCEEDED!
                </h3>
                <p className="text-xs font-bold text-slate-500 uppercase">
                  Free API Limit Reached
                </p>
              </div>
            </div>

            <p className="font-heading font-extrabold text-xl text-slate-800 leading-snug mb-5">
              The free tier limit for your {activeModel.startsWith("gemini-") ? "Gemini" : "Groq"} API key is over! Please configure a different key or wait for the quota to reset.
            </p>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setApiRateLimitExceeded(false);
                  setIsSettingsOpen(true);
                }}
                className="flex-1 bg-[#ffcc00] hover:bg-[#e6b800] border-[2.5px] border-slate-900 border-radius-btn shadow-flat font-heading font-extrabold text-lg p-4 cursor-pointer text-slate-900"
              >
                Update API Key
              </Button>
              <Button
                onClick={() => setApiRateLimitExceeded(false)}
                className="bg-white hover:bg-slate-100 border-[2.5px] border-slate-900 border-radius-btn shadow-flat font-heading font-extrabold text-lg p-4 cursor-pointer text-slate-900"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Banner Notification */}
      {banner && (
        <div
          className={`fixed bottom-6 right-6 z-[1000] p-4 border-[3px] border-slate-900 border-radius-btn shadow-flat flex items-center gap-3 font-heading text-lg font-bold text-white transition-all transform animate-slideInLeft ${banner.type === "success" ? "bg-[#33cc66]" :
              banner.type === "error" ? "bg-[#ff3333]" :
                banner.type === "warning" ? "bg-amber-600" : "bg-[#ff66cc]"
            }`}
        >
          {banner.type === "success" && <CheckCircle className="w-6 h-6 stroke-[3px]" />}
          {banner.type === "error" && <XCircle className="w-6 h-6 stroke-[3px]" />}
          {banner.type === "warning" && <XCircle className="w-6 h-6 stroke-[3px]" />}
          {banner.type === "info" && <Brain className="w-6 h-6 stroke-[3px]" />}
          <span>{banner.message}</span>
        </div>
      )}

      {/* Header Container */}
      <header className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-[#faf8f5] border-[3.5px] border-slate-900 border-radius-crayon shadow-flat-lg mb-6 filter-wobble">

        {/* Rainbow crayon logo */}
        <div className="flex items-center gap-3 select-none">
          <Pencil className="w-7 h-7 text-[#ff3366] -rotate-15 drop-shadow-[2px_2px_0px_#1e293b]" />
          <h1 className="crayon-logo text-5xl font-extrabold flex gap-1.5 tracking-wider filter-wobble">
            <span className="c-red crayon-outline-text inline-block -rotate-6 transform hover:scale-115 transition-transform duration-150 cursor-pointer">d</span>
            <span className="c-orange crayon-outline-text inline-block rotate-3 transform hover:scale-115 transition-transform duration-150 translate-y-[2px] cursor-pointer">o</span>
            <span className="c-yellow crayon-outline-text inline-block -rotate-3 transform hover:scale-115 transition-transform duration-150 cursor-pointer">o</span>
            <span className="c-green crayon-outline-text inline-block rotate-6 transform hover:scale-115 transition-transform duration-150 -translate-y-[1px] cursor-pointer">d</span>
            <span className="c-cyan crayon-outline-text inline-block -rotate-6 transform hover:scale-115 transition-transform duration-150 cursor-pointer">l</span>
            <span className="c-blue crayon-outline-text inline-block rotate-3 transform hover:scale-115 transition-transform duration-150 translate-y-[1px] cursor-pointer">e</span>
            <span className="c-pink crayon-outline-text inline-block rotate-6 transform hover:scale-115 transition-transform duration-150 -translate-y-[2px] cursor-pointer">.</span>
            <span className="c-white crayon-outline-text inline-block -rotate-6 transform hover:scale-115 transition-transform duration-150 translate-y-[2px] cursor-pointer">a</span>
            <span className="c-yellow crayon-outline-text inline-block rotate-3 transform hover:scale-115 transition-transform duration-150 cursor-pointer">i</span>
          </h1>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-4 flex-wrap justify-center">

          {/* Status badge */}
          <div className="flex items-center gap-2 text-[15px] font-bold bg-slate-200 border-2 border-slate-900 p-1.5 px-3 rounded-md border-radius-btn shadow-flat-sm">
            <span className={`w-3.5 h-3.5 border-2 border-slate-900 rounded-full inline-block ${ollamaConnected ? "bg-[#33cc66]" : (connectionStatusText === "Gemini Active" ? "bg-[#b34dff]" : "bg-[#ff3333]")}`}></span>
            <span>{connectionStatusText}</span>
          </div>

          {/* Model Selector */}
          <div className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
            <Brain className="w-5 h-5" />
            <div className="relative">
              <select
                id="model-select"
                disabled={availableModels.length === 0}
                value={activeModel}
                onChange={(e) => setActiveModel(e.target.value)}
                className="bg-white border-[2.5px] border-slate-900 text-slate-900 p-1.5 pr-8 pl-3 rounded-md font-body font-semibold cursor-pointer appearance-none border-radius-btn outline-none min-w-[170px]"
              >
                {availableModels.length === 0 ? (
                  <option value="">No models detected</option>
                ) : (
                  <>
                    {availableModels.some(m => m.startsWith("gemini-")) && (
                      <optgroup label="Gemini Cloud Models">
                        {availableModels.filter(m => m.startsWith("gemini-")).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </optgroup>
                    )}
                    {availableModels.some(m => m.includes("qwen")) && (
                      <optgroup label="Groq Cloud Models">
                        {availableModels.filter(m => m.includes("qwen")).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </optgroup>
                    )}
                    {availableModels.some(m => !m.startsWith("gemini-") && !m.includes("qwen")) && (
                      <optgroup label="Ollama Local Models">
                        {availableModels.filter(m => !m.startsWith("gemini-") && !m.includes("qwen")).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </optgroup>
                    )}
                  </>
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-900">
                ▼
              </div>
            </div>
          </div>

          {/* Settings button */}
          <Button
            onClick={() => setIsSettingsOpen(true)}
            className="w-10 h-10 bg-white hover:bg-slate-100 border-[2.5px] border-slate-900 border-radius-btn shadow-flat-sm flex items-center justify-center p-0 cursor-pointer text-slate-900"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content Split Area */}
      <main className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 flex-grow">

        {/* Left Side: Canvas Drawing Board */}
        <section className="flex flex-col">
          <div className="panel canvas-panel bg-[#faf8f5] border-[3.5px] border-slate-900 border-radius-crayon shadow-flat-lg overflow-hidden flex flex-col flex-grow min-h-[500px] filter-wobble">

            {/* Canvas Panel Header */}
            <div className="flex justify-between items-center p-3 px-6 border-b-[3.5px] border-slate-900 bg-slate-100 font-heading text-2xl font-bold">
              <div className="flex items-center gap-2 text-slate-900">
                <Pencil className="w-6 h-6" />
                <span>Drawing Board</span>
              </div>
              <div className="text-sm font-body font-medium text-slate-500 bg-slate-200 border-2 border-slate-900 p-1 px-3 border-radius-btn">
                Sketch Area
              </div>
            </div>

            {/* Drawing Canvas Box */}
            <div className="flex-grow relative bg-slate-100 border-[3.5px] border-slate-900 border-radius-crayon overflow-hidden m-4 min-h-[380px] shadow-[inset_3px_3px_0px_rgba(0,0,0,0.05)]">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="absolute inset-0 w-full h-full bg-white cursor-crosshair touch-none"
              />

              {/* Prediction Loader Overlay */}
              <div className={`canvas-overlay absolute inset-0 bg-[#faf8f5]/90 flex flex-col items-center justify-center gap-3 transition-opacity duration-200 z-10 ${isThinking ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
                <Loader2 className="w-12 h-12 stroke-[3px] text-[#ffcc00] animate-spin" />
                <p className="font-heading font-extrabold text-2xl text-slate-900 animate-pulse">AI is thinking...</p>
              </div>
            </div>

            {/* Canvas Toolbar Footer */}
            <div className="bg-slate-100 border-t-[3.5px] border-slate-900 p-3 px-6 flex flex-wrap items-center gap-4">

              {/* Pencil/Eraser tools */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setIsEraser(false)}
                  className={`w-10 h-10 border-[2.5px] border-slate-900 border-radius-btn shadow-flat-sm flex items-center justify-center cursor-pointer ${!isEraser ? "bg-[#33a6ff] text-white shadow-[inset_2px_2px_0_rgba(0,0,0,0.2)] translate-y-[1px]" : "bg-white text-slate-900 hover:bg-slate-50"}`}
                  title="Brush"
                >
                  <Pencil className="w-5 h-5" />
                </Button>

                <Button
                  onClick={() => setIsEraser(true)}
                  className={`w-10 h-10 border-[2.5px] border-slate-900 border-radius-btn shadow-flat-sm flex items-center justify-center cursor-pointer ${isEraser ? "bg-[#33a6ff] text-white shadow-[inset_2px_2px_0_rgba(0,0,0,0.2)] translate-y-[1px]" : "bg-white text-slate-900 hover:bg-slate-50"}`}
                  title="Eraser"
                >
                  <Eraser className="w-5 h-5" />
                </Button>
              </div>

              <div className="w-[3px] h-7 bg-slate-900 rounded-full"></div>

              {/* Stroke Size slider */}
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold text-lg">Size:</span>
                <input
                  type="range"
                  min="2"
                  max="40"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-[90px] h-2.5 bg-slate-300 border-2 border-slate-900 rounded-full appearance-none cursor-pointer outline-none slider-thumb:border-2 slider-thumb:border-slate-900 slider-thumb:bg-[#ff4d4d]"
                />
                <span className="font-heading font-extrabold text-lg w-10 text-right">{brushSize}px</span>
              </div>

              <div className="w-[3px] h-7 bg-slate-900 rounded-full"></div>

              {/* Color Swatch list */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  "#000000", // Black
                  "#ff4d4d", // Red
                  "#3b82f6", // Blue
                  "#10b981", // Green
                  "#f59e0b", // Yellow
                  "#ff66cc", // Pink
                ].map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      setBrushColor(color);
                      setIsEraser(false);
                    }}
                    style={{ backgroundColor: color }}
                    className={`w-6 h-6 rounded-full border-[2.5px] border-slate-900 shadow-flat-sm cursor-pointer transition-transform duration-100 hover:scale-115 ${brushColor === color && !isEraser ? "scale-110 ring-2 ring-offset-2 ring-white" : ""}`}
                  />
                ))}

                {/* Custom Color input wrapper */}
                <div className={`relative w-6 h-6 rounded-full border-[2.5px] border-slate-900 overflow-hidden shadow-flat-sm cursor-pointer ${brushColor !== "#000000" && brushColor !== "#ff4d4d" && brushColor !== "#3b82f6" && brushColor !== "#10b981" && brushColor !== "#f59e0b" && brushColor !== "#ff66cc" && !isEraser ? "scale-110 ring-2 ring-offset-2 ring-white" : ""}`}>
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => {
                      setBrushColor(e.target.value);
                      setIsEraser(false);
                    }}
                    className="absolute -top-1.5 -left-1.5 w-9 h-9 border-none cursor-pointer bg-none p-0"
                  />
                </div>
              </div>

              <div className="w-[3px] h-7 bg-slate-900 rounded-full"></div>

              {/* Action operations (undo/redo/clear) */}
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className="w-10 h-10 bg-white hover:bg-slate-50 border-[2.5px] border-slate-900 border-radius-btn shadow-flat-sm flex items-center justify-center p-0 cursor-pointer disabled:opacity-40 disabled:pointer-events-none text-slate-900"
                  title="Undo (Ctrl+Z)"
                >
                  <RotateCcw className="w-5 h-5" />
                </Button>

                <Button
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className="w-10 h-10 bg-white hover:bg-slate-50 border-[2.5px] border-slate-900 border-radius-btn shadow-flat-sm flex items-center justify-center p-0 cursor-pointer disabled:opacity-40 disabled:pointer-events-none text-slate-900"
                  title="Redo (Ctrl+Y)"
                >
                  <RotateCw className="w-5 h-5" />
                </Button>

                <Button
                  onClick={() => clearCanvas(true)}
                  className="w-10 h-10 bg-white hover:bg-[#ff3333] hover:text-white border-[2.5px] border-slate-900 border-radius-btn shadow-flat-sm flex items-center justify-center p-0 cursor-pointer text-slate-900"
                  title="Clear Canvas"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Right Side: Game Modes Panels */}
        <section className="flex flex-col gap-5">

          {/* Game Mode Selector Tab capsules */}
          <div className="flex bg-slate-900/15 border-3 border-slate-900 p-1 border-radius-crayon filter-wobble">
            <button
              onClick={() => handleModeChange("sandbox")}
              className={`flex-1 font-heading text-xl font-bold p-2 text-center flex items-center justify-center gap-2 cursor-pointer border-radius-btn transition-colors ${currentGameMode === "sandbox" ? "bg-[#faf8f5] text-slate-900 border-[2.5px] border-slate-900 shadow-flat-sm font-extrabold" : "text-white text-shadow-md hover:bg-white/10"}`}
            >
              <Compass className="w-5 h-5" />
              <span>Sandbox Mode</span>
            </button>

            <button
              onClick={() => handleModeChange("game")}
              className={`flex-1 font-heading text-xl font-bold p-2 text-center flex items-center justify-center gap-2 cursor-pointer border-radius-btn transition-colors ${currentGameMode === "game" ? "bg-[#faf8f5] text-slate-900 border-[2.5px] border-slate-900 shadow-flat-sm font-extrabold" : "text-white text-shadow-md hover:bg-white/10"}`}
            >
              <Trophy className="w-5 h-5" />
              <span>AI Challenge</span>
            </button>
          </div>

          {/* Active Mode Board Content */}
          <div className="panel bg-[#faf8f5] border-[3.5px] border-slate-900 border-radius-crayon shadow-flat-lg p-5 flex-grow min-h-[400px] flex flex-col filter-wobble">

            {/* A. Sandbox Board Layout */}
            {currentGameMode === "sandbox" && (
              <div className="flex flex-col flex-grow gap-5">
                <div className="panel-intro">
                  <h3 className="font-heading font-extrabold text-2xl mb-1">Draw anything you want!</h3>
                  <p className="text-sm font-semibold text-slate-600">The local AI will guess your drawing and tell a creative story about it in real-time.</p>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center bg-slate-100 border-[2.5px] border-slate-900 p-2.5 px-4 rounded-md border-radius-btn">
                    <span className="font-heading font-extrabold text-lg flex items-center gap-2">
                      <RotateCw className="w-4.5 h-4.5" /> Auto-Guess:
                    </span>

                    {/* Auto guess Switch */}
                    <label className="relative inline-block w-11 h-6 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoGuess}
                        onChange={(e) => setAutoGuess(e.target.checked)}
                        className="opacity-0 w-0 h-0 peer"
                      />
                      <span className="absolute inset-0 bg-slate-300 border-2 border-slate-900 rounded-full transition-colors duration-200 peer-checked:bg-[#33cc66] before:content-[''] before:absolute before:w-3.5 before:h-3.5 before:bottom-[3px] before:left-[3px] before:bg-slate-900 before:rounded-full before:transition-transform before:duration-200 peer-checked:before:translate-x-5 peer-checked:before:bg-white"></span>
                    </label>
                  </div>

                  <Button
                    onClick={() => triggerGuess(false)}
                    className="w-full bg-[#ffcc00] border-[2.5px] border-slate-900 border-radius-btn shadow-flat font-heading font-extrabold text-xl p-6 hover:bg-[#e6b800] cursor-pointer text-slate-900"
                  >
                    <Eye className="w-5 h-5 mr-1" /> Ask AI to Guess
                  </Button>
                </div>

                <div className="flex flex-col flex-grow gap-3 mt-2">
                  <div className="border-b-[2.5px] border-slate-900 pb-1 font-heading text-lg font-extrabold text-slate-900">
                    AI OUTPUT INTERPRETATION
                  </div>

                  <div className="flex flex-col flex-grow">
                    {showSandboxPlaceholder ? (
                      <div className="flex flex-col items-center justify-center flex-grow p-6 text-center border-2 border-dashed border-slate-900 border-radius-crayon text-slate-500 gap-2">
                        <Pencil className="w-8 h-8" />
                        <p className="font-heading font-extrabold text-lg text-slate-900">Start drawing!</p>
                        <p className="text-xs font-semibold max-w-[240px]">Draw some crayon lines to trigger the local AI vision guessing engine.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 animate-fadeIn">

                        {/* Guesses tags list */}
                        <div className="flex flex-wrap gap-2">
                          {sandboxGuesses.map((guess, idx) => (
                            <span
                              key={idx}
                              className={`border-2 border-slate-900 border-radius-btn p-1.5 px-3 font-heading font-extrabold text-base flex items-center gap-1.5 shadow-flat-sm ${idx === 0 ? "bg-[#fef08a] text-amber-800 rotate-[-1.5deg]" : "bg-sky-100 text-sky-700"}`}
                            >
                              {idx === 0 && <Trophy className="w-4 h-4 fill-amber-300" />}
                              <span>{guess}</span>
                            </span>
                          ))}
                        </div>

                        {/* Crayon poem or interpretation text */}
                        <div className="bg-slate-50 border-[2.5px] border-slate-900 border-radius-crayon p-4 shadow-flat-sm flex flex-col gap-1.5">
                          <div className="font-heading font-extrabold text-sm uppercase text-amber-700 tracking-wider">
                            Interpretation Doodle Description
                          </div>
                          <p className="font-heading font-extrabold text-xl text-slate-800 italic leading-snug">
                            "{sandboxDescription || "No drawing interpretation generated."}"
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* B. Game Mode Board Layout */}
            {currentGameMode === "game" && (
              <div className="flex flex-col flex-grow gap-5">

                {/* Score and Stats block */}
                <div className="grid grid-cols-3 gap-2 bg-slate-200 border-[2.5px] border-slate-900 p-2 rounded-md border-radius-btn shadow-flat-sm text-center">
                  <div className="flex flex-col border-r-2 border-slate-900 justify-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Score</span>
                    <span className="font-heading font-extrabold text-xl">{gameScore}</span>
                  </div>
                  <div className="flex flex-col border-r-2 border-slate-900 justify-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Time Left</span>
                    <span className={`font-heading font-extrabold text-xl ${gameTimeLeft <= 10 ? "text-[#ff3333] animate-urgent" : "text-amber-600"}`}>
                      {gameTimeLeft}s
                    </span>
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">High</span>
                    <span className="font-heading font-extrabold text-xl">{gameHighScore}</span>
                  </div>
                </div>

                {/* Target Prompt Word Card */}
                <div className="bg-[#fef08a] border-3 border-slate-900 border-radius-crayon p-6 text-center flex flex-col items-center gap-3 shadow-flat">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Draw This Item:</span>
                  <h2 className="font-heading font-extrabold text-4xl text-slate-900 uppercase leading-none">{targetWord}</h2>

                  <div className="flex gap-2 w-full mt-2">
                    {!isGameRunning ? (
                      <Button
                        onClick={startChallenge}
                        className="flex-1 bg-[#33cc66] border-[2.5px] border-slate-900 border-radius-btn shadow-flat font-heading font-extrabold text-lg p-5 hover:bg-[#2bb356] cursor-pointer text-white"
                      >
                        <Play className="w-5 h-5 mr-1" /> {targetWord === "ROUND OVER" || targetWord === "CORRECT!" ? "Next Word" : "Start Game"}
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={skipWord}
                          className="flex-1 bg-slate-200 hover:bg-slate-300 border-[2.5px] border-slate-900 border-radius-btn shadow-flat font-heading font-extrabold text-lg p-5 cursor-pointer text-slate-900"
                        >
                          <SkipForward className="w-5 h-5 mr-1" /> Skip
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Real-time guess logger */}
                <div className="flex flex-col flex-grow gap-2 mt-2">
                  <div className="border-b-[2.5px] border-slate-900 pb-1 font-heading text-lg font-extrabold text-slate-900 uppercase">
                    AI Shout-out Guesses
                  </div>

                  <div className="game-guesses-log border-[2.5px] border-slate-900 bg-white rounded-md border-radius-btn p-3 flex-grow overflow-y-auto max-h-[220px] flex flex-col gap-2 shadow-[inset_2px_2px_0_rgba(0,0,0,0.05)]">
                    {gameGuessesLog.length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-center gap-2 text-slate-400 py-6">
                        <Brain className="w-8 h-8" />
                        <p className="font-heading font-extrabold text-sm text-slate-800">No AI guesses yet.</p>
                        <p className="text-[10px] font-semibold">Start the game, draw the word, and watch the AI guess!</p>
                      </div>
                    ) : (
                      gameGuessesLog.map((log, index) => (
                        <div
                          key={index}
                          className={`border-2 border-slate-900 p-2 rounded-md border-radius-btn font-heading font-extrabold text-lg flex justify-between items-center shadow-flat-sm animate-slideInLeft ${log.isMatch ? "bg-[#d1fae5] text-emerald-800" : "bg-slate-50"}`}
                        >
                          <span>Is it a <span className="underline">{log.text}</span>?</span>
                          <span className="font-body text-xs font-semibold text-slate-500 bg-slate-200 border border-slate-900 p-0.5 px-2 rounded-md">
                            {log.time}s
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Settings Modal Drawer Popup */}
      <div className={`modal-overlay fixed inset-0 bg-[#2c5a93]/70 backdrop-blur-sm flex items-center justify-center z-100 transition-opacity duration-200 ${isSettingsOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        <div className={`modal bg-[#faf8f5] border-[3.5px] border-slate-900 border-radius-crayon shadow-flat-lg w-full max-w-[480px] overflow-hidden transition-transform duration-200 filter-wobble ${isSettingsOpen ? "scale-100" : "scale-95"}`}>

          <div className="flex justify-between items-center p-4 px-6 border-b-3 border-slate-900 bg-slate-200">
            <h3 className="font-heading font-extrabold text-2xl text-slate-900 flex items-center gap-2">
              <Settings className="w-6 h-6" /> ScribbleAI Settings
            </h3>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="text-slate-500 hover:text-slate-900 text-3xl font-extrabold leading-none cursor-pointer"
            >
              &times;
            </button>
          </div>

          <div className="p-5 flex flex-col gap-5">
            {/* Host connection configuration */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="host-input" className="text-sm font-bold text-slate-800">Ollama Local Server Host:</label>
              <div className="flex gap-2">
                <input
                  id="host-input"
                  type="text"
                  value={ollamaHost}
                  onChange={(e) => setOllamaHost(e.target.value)}
                  className="flex-grow bg-white border-[2.5px] border-slate-900 p-2 pl-3 rounded-md border-radius-btn font-body font-semibold outline-none text-slate-900"
                />
                <Button
                  onClick={handleSaveHost}
                  className="bg-slate-300 hover:bg-slate-400 border-[2.5px] border-slate-900 border-radius-btn shadow-flat-sm text-slate-900 font-heading font-extrabold text-md px-4 cursor-pointer"
                >
                  Save
                </Button>
              </div>
              <p className="text-[10px] font-semibold text-slate-500">Usually http://localhost:11434. Restart server connection on change.</p>
            </div>

            <hr className="border-t-3 border-slate-900" />

            {/* Gemini API Key configuration */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="gemini-key-input" className="text-sm font-bold text-slate-800">Gemini Cloud API Key:</label>
              <div className="flex gap-2">
                <input
                  id="gemini-key-input"
                  type="password"
                  placeholder={geminiConfiguredInBackend ? "Configured on backend (.env)" : "Enter Gemini API Key"}
                  value={userGeminiKey}
                  onChange={(e) => setUserGeminiKey(e.target.value)}
                  className="flex-grow bg-white border-[2.5px] border-slate-900 p-2 pl-3 rounded-md border-radius-btn font-body font-semibold outline-none text-slate-900"
                />
                <Button
                  onClick={handleSaveGeminiKey}
                  className="bg-purple-300 hover:bg-purple-400 border-[2.5px] border-slate-900 border-radius-btn shadow-flat-sm text-slate-900 font-heading font-extrabold text-md px-4 cursor-pointer"
                >
                  Save
                </Button>
              </div>
              <p className="text-[10px] font-semibold text-slate-500">Enable cloud vision features. Key is stored locally in your browser.</p>
            </div>

            <hr className="border-t-3 border-slate-900" />

            {/* Groq API Key configuration */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="groq-key-input" className="text-sm font-bold text-slate-800">Groq Cloud API Key:</label>
              <div className="flex gap-2">
                <input
                  id="groq-key-input"
                  type="password"
                  placeholder={groqConfiguredInBackend ? "Configured on backend (.env)" : "Enter Groq API Key"}
                  value={userGroqKey}
                  onChange={(e) => setUserGroqKey(e.target.value)}
                  className="flex-grow bg-white border-[2.5px] border-slate-900 p-2 pl-3 rounded-md border-radius-btn font-body font-semibold outline-none text-slate-900"
                />
                <Button
                  onClick={handleSaveGroqKey}
                  className="bg-orange-300 hover:bg-orange-400 border-[2.5px] border-slate-900 border-radius-btn shadow-flat-sm text-slate-900 font-heading font-extrabold text-md px-4 cursor-pointer"
                >
                  Save
                </Button>
              </div>
              <p className="text-[10px] font-semibold text-slate-500">Enable Groq Qwen vision models. Key is stored locally in your browser.</p>
            </div>

            <hr className="border-t-3 border-slate-900" />

            {/* Downloader model trigger */}
            <div className="flex flex-col gap-2">
              <h4 className="font-heading font-extrabold text-lg">Download Local Vision Models</h4>
              <p className="text-[11px] font-semibold text-slate-500">Ensure Ollama serve daemon is active before downloading.</p>

              <div className="flex flex-col gap-2.5 mt-1">
                {[
                  { name: "moondream", label: "Moondream (1.6B)", size: "~800MB", desc: "Fast & Light (Recommended)" },
                  { name: "llava", label: "LLaVA (7B)", size: "~4.7GB", desc: "Balanced visual parser" },
                  { name: "llama3.2-vision", label: "Llama 3.2 Vision (11B)", size: "~7.9GB", desc: "High accuracy (requires 8GB VRAM)" },
                ].map((model) => (
                  <div key={model.name} className="flex justify-between items-center bg-white border-[2.5px] border-slate-900 p-3 rounded-md border-radius-btn">
                    <div className="flex flex-col">
                      <strong className="text-xs font-bold text-slate-900">{model.label}</strong>
                      <span className="text-[10px] text-slate-500 font-medium">{model.size} | {model.desc}</span>
                    </div>

                    <Button
                      onClick={() => startPullModel(model.name)}
                      disabled={isDownloading}
                      className="bg-[#faf8f5] hover:bg-[#ffcc00] border-2 border-slate-900 border-radius-btn shadow-flat-sm font-heading font-extrabold text-sm p-1.5 px-3 cursor-pointer text-slate-900 disabled:opacity-40"
                    >
                      Download
                    </Button>
                  </div>
                ))}
              </div>

              {/* Real-time streaming Progress display */}
              {isDownloading && (
                <div className="bg-white border-[2.5px] border-slate-900 border-radius-btn p-3 mt-3 flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span>Downloading Model:</span>
                    <span>{downloadPercent.toFixed(1)}%</span>
                  </div>

                  {/* Progress bar border radius wobbly custom */}
                  <div className="bg-slate-200 border-2 border-slate-900 rounded-full h-3 overflow-hidden">
                    <div
                      style={{ width: `${downloadPercent}%` }}
                      className="bg-purple-500 h-full transition-all duration-150"
                    />
                  </div>

                  <span className="text-[10px] font-semibold text-slate-500 text-center uppercase tracking-wider">{downloadProgress}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
