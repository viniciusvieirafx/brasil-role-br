import localUpdates from '@/data/updates.json'

type ChangeType = 'new' | 'fix' | 'improve' | 'remove'
type Lang = 'pt' | 'en' | 'es'

export interface Change { type: ChangeType; text: string }
export interface Update {
  version: string
  date: string
  tags: string[]
  changes: Record<Lang, Change[]>
}

interface GitHubRelease {
  tag_name: string
  published_at: string
  body: string | null
  draft: boolean
  prerelease: boolean
}

function detectType(line: string): ChangeType {
  if (/^(novo|new|nuevo|adicionado|added|añadido)\s*:/i.test(line)) return 'new'
  if (/^(fix|correção|corrección|bug)\s*:/i.test(line)) return 'fix'
  if (/^(melhoria|improve|mejora|atualizado|updated|actualizado)\s*:/i.test(line)) return 'improve'
  if (/^(removido|removed|eliminado)\s*:/i.test(line)) return 'remove'
  return 'new'
}

function stripPrefix(line: string): string {
  return line.replace(/^\w+\s*:\s*/i, '').trim()
}

function parseRelease(r: GitHubRelease): Update {
  const version = r.tag_name.replace(/^v/, '')
  const body = r.body ?? ''

  // Optional: override publish date with "date: YYYY-MM-DD" in the body
  const dateMatch = body.match(/^date\s*:\s*(\d{4}-\d{2}-\d{2})/im)
  const date = dateMatch ? dateMatch[1] : r.published_at.split('T')[0]

  const tagsMatch = body.match(/^tags?\s*:\s*(.+)$/im)
  const tags = tagsMatch
    ? tagsMatch[1].split(',').map(t => t.trim().toLowerCase())
    : ['mapa']

  const changes: Change[] = body
    .split('\n')
    .map(l => l.replace(/^[-*]\s+/, '').trim())
    .filter(l => l && !/^(tags?|date)\s*:/i.test(l) && !l.startsWith('#'))
    .map(line => ({ type: detectType(line), text: stripPrefix(line) || line }))

  // GitHub releases are written in PT; same content shown across all langs
  return { version, date, tags, changes: { pt: changes, en: changes, es: changes } }
}

export async function getUpdates(): Promise<Update[]> {
  const repo = process.env.GITHUB_REPO
  if (!repo) return localUpdates as Update[]

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
    }

    const res = await fetch(
      `https://api.github.com/repos/${repo}/releases?per_page=20`,
      { headers, next: { revalidate: 3600 } }
    )
    if (!res.ok) throw new Error(`GitHub API ${res.status}`)

    const releases: GitHubRelease[] = await res.json()
    const parsed = releases.filter(r => !r.draft && !r.prerelease).map(parseRelease)

    return parsed.length > 0 ? parsed : (localUpdates as Update[])
  } catch {
    return localUpdates as Update[]
  }
}
