import { NextResponse } from "next/server";

const GAME_WORDS = [
  "cat", "dog", "car", "house", "tree", "flower", "sun", "moon", "cloud",
  "bird", "fish", "apple", "banana", "hat", "shirt", "shoe", "cup", "clock",
  "book", "chair", "table", "computer", "phone", "bicycle", "face",
  "smile", "star", "heart", "guitar", "glasses", "umbrella", "pencil", "spider",
  "airplane", "boat", "pizza", "cookie", "ball", "key", "door", "window"
];

export async function GET() {
  // Return 15 random words
  const shuffled = [...GAME_WORDS].sort(() => 0.5 - Math.random());
  const words = shuffled.slice(0, 15);
  
  return NextResponse.json({ words });
}
