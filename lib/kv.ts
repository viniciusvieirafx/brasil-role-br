// Wrapper minimalista para Upstash Redis via REST API
// Sem dependências — só fetch nativo do Node/Edge

const URL   = () => process.env.KV_REST_API_URL!
const TOKEN = () => process.env.KV_REST_API_TOKEN!

async function _cmd(args: string[]): Promise<any> {
  const res = await fetch(`${URL()}/${args.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${TOKEN()}` },
  })
  const data = await res.json()
  return data.result
}

export async function kvSet(key: string, value: string): Promise<void> {
  await _cmd(['set', key, value])
}

export async function kvGet(key: string): Promise<string | null> {
  return await _cmd(['get', key])
}

export async function kvDel(key: string): Promise<void> {
  await _cmd(['del', key])
}

export async function kvKeys(pattern: string): Promise<string[]> {
  const result = await _cmd(['keys', pattern])
  return Array.isArray(result) ? result : []
}
