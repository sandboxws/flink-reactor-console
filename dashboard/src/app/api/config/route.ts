import { NextResponse } from "next/server"
import { getPublicConfig } from "@/lib/config"

export function GET() {
  return NextResponse.json(getPublicConfig())
}
