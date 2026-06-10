import { NextResponse } from 'next/server'
import { listGrupos } from '@/lib/grupos'

export async function GET() {
  const grupos = await listGrupos()
  // Retorna apenas slug e nome (sem senha hash nem detalhes internos)
  return NextResponse.json({
    grupos: grupos
      .filter(g => g.ativo)
      .map(g => ({ slug: g.slug, nome: g.nome })),
  })
}
