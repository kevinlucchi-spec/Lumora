import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSeriesById, updateSeries, deleteSeries } from "@/lib/services/series.service"
import { z } from "zod"

const UpdateSeriesSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId } = await params
  const series = await getSeriesById(seriesId, session.user.id)
  if (!series) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(series)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId } = await params
  const body = await req.json()
  const parsed = UpdateSeriesSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  await updateSeries(seriesId, session.user.id, parsed.data)
  const updated = await getSeriesById(seriesId, session.user.id)
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { seriesId } = await params
  const result = await deleteSeries(seriesId, session.user.id)
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
