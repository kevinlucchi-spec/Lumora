import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSeriesForUser, createSeries } from "@/lib/services/series.service"
import { z } from "zod"

const CreateSeriesSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const series = await getSeriesForUser(session.user.id)
  return NextResponse.json(series)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const parsed = CreateSeriesSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const series = await createSeries(session.user.id, parsed.data)
  return NextResponse.json(series, { status: 201 })
}
