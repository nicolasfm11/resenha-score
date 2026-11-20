import { getStore } from '@netlify/blobs'

const STORE_NAME = 'resenhascore'
const PLAYERS_KEY = 'players.json'
const POSITIONS = new Set(['Goleiro', 'Zagueiro', 'Lateral', 'Meia', 'Atacante'])

const defaultPlayers = [
  { id: 'j1', nome: "Carlos 'Imperador' Silva", posicao: 'Atacante', gols: 24, assistencias: 9, vitorias: 14, partidas: 18, notaMedia: 8.9 },
  { id: 'j2', nome: "Lucas 'Maestro' Mendes", posicao: 'Meia', gols: 12, assistencias: 21, vitorias: 15, partidas: 19, notaMedia: 9.1 },
  { id: 'j3', nome: "Rafael 'Muralha' Costa", posicao: 'Goleiro', gols: 1, assistencias: 3, vitorias: 13, partidas: 17, notaMedia: 8.6 },
  { id: 'j4', nome: "Bruno 'Xerife' Alves", posicao: 'Zagueiro', gols: 5, assistencias: 4, vitorias: 12, partidas: 18, notaMedia: 8.2 },
  { id: 'j5', nome: "Diego 'Foguete' Santos", posicao: 'Lateral', gols: 9, assistencias: 14, vitorias: 11, partidas: 16, notaMedia: 8.4 },
  { id: 'j6', nome: "Thiago 'Tanque' Oliveira", posicao: 'Atacante', gols: 19, assistencias: 6, vitorias: 10, partidas: 15, notaMedia: 8.3 },
  { id: 'j7', nome: "Matheus 'Motorzinho' Lima", posicao: 'Meia', gols: 8, assistencias: 12, vitorias: 11, partidas: 17, notaMedia: 8 },
  { id: 'j8', nome: "Gabriel 'Parede' Rocha", posicao: 'Zagueiro', gols: 3, assistencias: 2, vitorias: 9, partidas: 14, notaMedia: 7.8 }
]

const headers = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8'
}

const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers })
const asText = (value, maxLength = 80) => String(value ?? '').trim().slice(0, maxLength)
const asNumber = (value, max = Number.MAX_SAFE_INTEGER) => Math.min(max, Math.max(0, Number(value) || 0))

function sanitizePlayer(input, id) {
  const nome = asText(input?.nome)
  if (!nome) throw new Error('Informe o nome do jogador.')

  const posicao = POSITIONS.has(input?.posicao) ? input.posicao : 'Meia'
  const notaInformada = Number(input?.notaMedia)
  return {
    id,
    nome,
    posicao,
    gols: asNumber(input?.gols),
    assistencias: asNumber(input?.assistencias),
    vitorias: asNumber(input?.vitorias),
    partidas: asNumber(input?.partidas),
    notaMedia: Number.isFinite(notaInformada) ? Math.min(10, Math.max(0, notaInformada)) : 7.5
  }
}

async function readPlayers(store) {
  const saved = await store.get(PLAYERS_KEY, { type: 'json' })
  if (Array.isArray(saved)) return saved

  await store.setJSON(PLAYERS_KEY, defaultPlayers)
  return defaultPlayers
}

function canWrite(request) {
  const password = process.env.ADMIN_PASSWORD
  return !password || request.headers.get('x-admin-password') === password
}

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    throw new Error('Envie um JSON válido.')
  }
}

export default async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })

  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) {
    return response({ error: 'Método não permitido.' }, 405)
  }

  try {
    if (request.method !== 'GET' && !canWrite(request)) {
      return response({ error: 'Senha de administrador necessária.' }, 401)
    }

    const store = getStore(STORE_NAME)
    const players = await readPlayers(store)
    const url = new URL(request.url)

    if (request.method === 'GET') return response({ players })

    if (request.method === 'POST') {
      const { player } = await readJson(request)
      const created = sanitizePlayer(player, `j_${crypto.randomUUID()}`)
      const next = [created, ...players]
      await store.setJSON(PLAYERS_KEY, next)
      return response({ player: created }, 201)
    }

    if (request.method === 'PUT') {
      const payload = await readJson(request)

      if (Array.isArray(payload.players)) {
        const replacement = payload.players.map((player, index) => {
          const id = asText(player?.id, 100) || `j_import_${Date.now()}_${index}`
          return sanitizePlayer(player, id)
        })
        await store.setJSON(PLAYERS_KEY, replacement)
        return response({ players: replacement })
      }

      const id = asText(url.searchParams.get('id'), 100)
      const index = players.findIndex((player) => player.id === id)
      if (index === -1) return response({ error: 'Jogador não encontrado.' }, 404)

      const updated = sanitizePlayer(payload.player, id)
      const next = [...players]
      next[index] = updated
      await store.setJSON(PLAYERS_KEY, next)
      return response({ player: updated })
    }

    const id = asText(url.searchParams.get('id'), 100)
    const next = players.filter((player) => player.id !== id)
    if (next.length === players.length) return response({ error: 'Jogador não encontrado.' }, 404)

    await store.setJSON(PLAYERS_KEY, next)
    return response({ deletedId: id })
  } catch (error) {
    console.error('Falha na API de jogadores:', error)
    return response({ error: error instanceof Error ? error.message : 'Erro inesperado.' }, 400)
  }
}
