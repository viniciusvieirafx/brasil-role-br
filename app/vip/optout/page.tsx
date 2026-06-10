export default async function OptOutPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const ok = status === 'ok'

  return (
    <div className="min-h-screen bg-br-dark flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        {ok ? (
          <>
            <p className="text-br-yellow text-2xl font-bold mb-4">Pronto!</p>
            <p className="text-white/70 mb-2">
              Você não vai mais receber lembretes de renovação de VIP.
            </p>
            <p className="text-white/40 text-sm mt-4">
              Se mudar de ideia, basta renovar normalmente pelo{' '}
              <a href="/" className="text-br-yellow underline">
                site
              </a>{' '}
              — os lembretes serão reativados automaticamente.
            </p>
          </>
        ) : (
          <>
            <p className="text-red-400 text-xl font-bold mb-4">Link inválido</p>
            <p className="text-white/50 text-sm">
              Esse link não é válido. Verifique se copiou o endereço corretamente.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
